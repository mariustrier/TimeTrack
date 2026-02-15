import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, isAdminOrManager } from "@/lib/auth";
import { expandRecurringExpenses } from "@/lib/expense-utils";
import { getEffectiveWeeklyCapacity } from "@/lib/calculations";
import { differenceInCalendarDays } from "date-fns";

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdminOrManager(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const approvalFilter = searchParams.get("approvalFilter") || "all";

    const dateFilter: Record<string, unknown> = {};
    if (startDate && endDate) {
      dateFilter.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    if (approvalFilter === "approved_only") {
      dateFilter.approvalStatus = { in: ["approved", "locked"] };
    }

    const company = await db.company.findUnique({
      where: { id: user.companyId },
      select: { currency: true, defaultHourlyRate: true, useUniversalRate: true },
    });

    const members = await db.user.findMany({
      where: { companyId: user.companyId, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        hourlyRate: true,
        costRate: true,
        weeklyTarget: true,
        isHourly: true,
        employmentType: true,
      },
    });

    const entries = await db.timeEntry.findMany({
      where: {
        companyId: user.companyId,
        ...dateFilter,
      },
      select: {
        userId: true,
        hours: true,
        billingStatus: true,
      },
    });

    const weeksInRange = startDate && endDate
      ? Math.max(1, (differenceInCalendarDays(new Date(endDate), new Date(startDate)) + 1) / 7)
      : 1;

    let totalRevenue = 0;
    let totalCost = 0;
    let totalHours = 0;
    let billableHours = 0;

    const employeeStats = members.map((member) => {
      const memberEntries = entries.filter((e) => e.userId === member.id);
      const hours = memberEntries.reduce((sum, e) => sum + e.hours, 0);
      const memberBillableHours = memberEntries
        .filter((e) => e.billingStatus === "billable")
        .reduce((sum, e) => sum + e.hours, 0);
      const isFreelancer = member.employmentType === "freelancer";
      const effectiveRate = (company?.useUniversalRate && !isFreelancer && company.defaultHourlyRate)
        ? company.defaultHourlyRate
        : member.hourlyRate;
      const revenue = memberBillableHours * effectiveRate;
      const cost = hours * member.costRate;

      totalRevenue += revenue;
      totalCost += cost;
      totalHours += hours;
      billableHours += memberBillableHours;

      return {
        id: member.id,
        name: `${member.firstName || ""} ${member.lastName || ""}`.trim() || member.email,
        email: member.email,
        hours,
        billableHours: memberBillableHours,
        revenue,
        cost,
        profit: revenue - cost,
        hourlyRate: effectiveRate,
        employmentType: member.employmentType,
        costRate: member.costRate,
        weeklyTarget: member.weeklyTarget,
        isHourly: member.isHourly,
        utilization: member.isHourly ? null : (hours / (getEffectiveWeeklyCapacity(member) * weeksInRange)) * 100,
      };
    });

    // Fetch projects with budgets for the company
    const projects = await db.project.findMany({
      where: { companyId: user.companyId, OR: [{ budgetHours: { not: null } }, { fixedPrice: { not: null } }] },
      include: {
        allocations: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        },
      },
      orderBy: { name: "asc" },
    });

    // Fetch ALL time entries for project budgets (no date filter - budgets are cumulative)
    // Used hours = submitted + approved + locked (committed time)
    const allProjectEntries = await db.timeEntry.findMany({
      where: {
        companyId: user.companyId,
        approvalStatus: { in: ["submitted", "approved", "locked"] },
      },
      select: {
        projectId: true,
        userId: true,
        hours: true,
      },
    });

    // Compute ALL-TIME hours used per project (for budget tracking)
    const projectHoursMap: Record<string, number> = {};
    const projectUserHoursMap: Record<string, Record<string, number>> = {};
    for (const entry of allProjectEntries) {
      projectHoursMap[entry.projectId] = (projectHoursMap[entry.projectId] || 0) + entry.hours;
      if (!projectUserHoursMap[entry.projectId]) projectUserHoursMap[entry.projectId] = {};
      projectUserHoursMap[entry.projectId][entry.userId] = (projectUserHoursMap[entry.projectId][entry.userId] || 0) + entry.hours;
    }

    // Build member rate map
    const memberRateMap: Record<string, number> = {};
    for (const m of members) {
      const isFreelancer = m.employmentType === "freelancer";
      memberRateMap[m.id] = (company?.useUniversalRate && !isFreelancer && company.defaultHourlyRate)
        ? company.defaultHourlyRate
        : m.hourlyRate;
    }

    // Build project budget stats
    const projectStats = projects.map((p) => {
      const hoursUsed = Math.round((projectHoursMap[p.id] || 0) * 10) / 10;

      // Calculate effective rate and budget in hours for fixed-price projects
      let effectiveRate = 0;
      let budgetTotalHours: number | null = null;

      if (p.pricingType === "fixed_price" && p.fixedPrice) {
        const rm = p.rateMode || "COMPANY_RATE";
        if (rm === "PROJECT_RATE") {
          effectiveRate = p.projectRate || company?.defaultHourlyRate || 0;
        } else if (rm === "EMPLOYEE_RATES") {
          // Average of allocated member rates (fall back to company rate)
          const allocUserIds = p.allocations.map((a) => a.userId);
          const rates = allocUserIds.length > 0
            ? allocUserIds.map((uid) => memberRateMap[uid] || company?.defaultHourlyRate || 0)
            : Object.values(memberRateMap);
          effectiveRate = rates.length > 0 ? rates.reduce((s, r) => s + r, 0) / rates.length : 0;
        } else {
          effectiveRate = company?.defaultHourlyRate || 0;
        }
        budgetTotalHours = effectiveRate > 0 ? Math.floor(p.fixedPrice / effectiveRate) : null;
      } else {
        budgetTotalHours = p.budgetHours;
      }

      // Calculate estimated non-billable hours from budget
      const estimatedNonBillableHours = (p.estimatedNonBillablePercent && budgetTotalHours)
        ? Math.round(budgetTotalHours * p.estimatedNonBillablePercent / 100 * 10) / 10
        : null;

      return {
        id: p.id,
        name: p.name,
        client: p.client,
        color: p.color,
        budgetHours: p.budgetHours,
        pricingType: p.pricingType,
        fixedPrice: p.fixedPrice,
        rateMode: p.rateMode,
        projectRate: p.projectRate,
        effectiveRate,
        budgetTotalHours,
        hoursUsed,
        estimatedNonBillablePercent: p.estimatedNonBillablePercent,
        estimatedNonBillableHours,
        locked: p.locked,
        archived: p.archived,
        systemManaged: p.systemManaged,
        allocations: p.allocations.map((a) => ({
          userId: a.userId,
          userName: `${a.user.firstName || ""} ${a.user.lastName || ""}`.trim() || a.user.email,
          hours: a.hours,
          hoursUsed: Math.round((projectUserHoursMap[p.id]?.[a.userId] || 0) * 10) / 10,
        })),
      };
    });

    const targetHours = members.reduce((sum, m) => sum + (m.isHourly ? 0 : getEffectiveWeeklyCapacity(m)), 0);

    // Fetch approved project expenses for the date range
    const expenseDateFilter: Record<string, unknown> = {};
    if (startDate && endDate) {
      expenseDateFilter.date = { gte: new Date(startDate), lte: new Date(endDate) };
    }
    const projectExpenses = await db.expense.findMany({
      where: {
        companyId: user.companyId,
        approvalStatus: "approved",
        ...expenseDateFilter,
      },
    });
    const totalProjectExpenses = Math.round(projectExpenses.reduce((s, e) => s + e.amount, 0) * 100) / 100;

    // Fetch company overhead expenses and expand recurring ones into the date range
    const rawCompanyExpenses = await db.companyExpense.findMany({
      where: { companyId: user.companyId },
    });
    const totalOverhead = startDate && endDate
      ? Math.round(expandRecurringExpenses(rawCompanyExpenses, startDate, endDate).reduce((s, e) => s + e.amount, 0) * 100) / 100
      : 0;

    const totalExpenses = totalProjectExpenses + totalOverhead;

    return NextResponse.json({
      totalRevenue,
      totalCost,
      totalProfit: totalRevenue - totalCost,
      totalHours,
      billableHours,
      utilization: targetHours > 0 ? (totalHours / (targetHours * weeksInRange)) * 100 : 0,
      employeeStats,
      projectStats,
      totalProjectExpenses,
      totalOverhead,
      totalExpenses,
      currency: company?.currency || "USD",
      defaultHourlyRate: company?.defaultHourlyRate || null,
      useUniversalRate: company?.useUniversalRate || false,
    });
  } catch (error) {
    console.error("[ADMIN_STATS]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
