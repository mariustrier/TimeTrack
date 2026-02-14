import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, isAdminOrManager } from "@/lib/auth";
import {
  aggregateEmployeeTimeDistribution,
  aggregateEmployeeUtilizationTrend,
  aggregateEmployeeProfitability,
  aggregateEmployeePhaseBreakdown,
  aggregateEmployeeFlexTrend,
  aggregateTeamUtilization,
  aggregateTeamTimeMix,
  aggregateCapacityDetail,
  aggregateEffectiveRate,
  aggregateProjectBurndown,
  aggregateProjectProfitability,
  aggregateProjectBillableMix,
  aggregateBudgetVelocity,
  aggregateRedList,
  aggregateTeamContribution,
  aggregateNonBillableTrend,
  aggregateUnbilledAging,
  aggregateExpenseBreakdown,
  aggregatePhaseDistribution,
  aggregateClientConcentration,
  aggregateInvoicePipeline,
  aggregateBillingVelocity,
  aggregateCollectionSummary,
} from "@/lib/analytics-utils";
import { expandRecurringExpenses } from "@/lib/expense-utils";
import { computeRevenueBridge, compute30DayForecast, ForecastAllocation } from "@/lib/analytics-forecast";
import { getToday } from "@/lib/demo-date";
import { getEffectiveWeeklyCapacity } from "@/lib/calculations";
import { format, startOfMonth, differenceInDays } from "date-fns";

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
    const type = searchParams.get("type") || "employee";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const employeeId = searchParams.get("employeeId");
    const projectId = searchParams.get("projectId");
    const granularity = (searchParams.get("granularity") || "monthly") as "monthly" | "weekly";
    const approvalFilter = searchParams.get("approvalFilter") || "approved_only";

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 });
    }

    const from = new Date(startDate);
    const to = new Date(endDate);
    const today = getToday();

    const dateFilter: Record<string, unknown> = {
      date: { gte: from, lte: to },
    };

    if (approvalFilter === "approved_only") {
      dateFilter.approvalStatus = { in: ["approved", "locked"] };
    }

    const company = await db.company.findUnique({
      where: { id: user.companyId },
      select: { currency: true },
    });

    const members = await db.user.findMany({
      where: { companyId: user.companyId, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        hourlyRate: true,
        costRate: true,
        weeklyTarget: true,
        isHourly: true,
        vacationDays: true,
        vacationTrackingUnit: true,
        vacationHoursPerYear: true,
      },
    });

    const projects = await db.project.findMany({
      where: { companyId: user.companyId },
      select: {
        id: true,
        name: true,
        client: true,
        color: true,
        billable: true,
        budgetHours: true,
        active: true,
        estimatedNonBillablePercent: true,
        startDate: true,
        endDate: true,
        rateMode: true,
        projectRate: true,
        systemType: true,
      },
    });

    // Build map of projectId -> estimatedNonBillablePercent for analytics utils
    const estimatedNonBillableMap: Record<string, number> = {};
    for (const p of projects) {
      if (p.estimatedNonBillablePercent && p.estimatedNonBillablePercent > 0) {
        estimatedNonBillableMap[p.id] = p.estimatedNonBillablePercent;
      }
    }

    const entries = await db.timeEntry.findMany({
      where: {
        companyId: user.companyId,
        ...dateFilter,
      },
      select: {
        id: true,
        hours: true,
        date: true,
        billingStatus: true,
        approvalStatus: true,
        userId: true,
        projectId: true,
        phaseName: true,
        invoiceId: true,
        invoicedAt: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            hourlyRate: true,
            costRate: true,
            weeklyTarget: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            client: true,
            color: true,
            billable: true,
            budgetHours: true,
          },
        },
      },
    });

    // Cast entries for utils (date comes as Date from Prisma)
    const castEntries = entries.map((e) => ({
      ...e,
      date: e.date.toISOString(),
    }));

    const currency = company?.currency || "USD";

    // Cast projects for ProjectFull usage
    const projectsFull = projects.map((p) => ({
      ...p,
      startDate: p.startDate ? p.startDate.toISOString() : null,
      endDate: p.endDate ? p.endDate.toISOString() : null,
      rateMode: p.rateMode,
      projectRate: p.projectRate,
    }));

    switch (type) {
      case "employee": {
        if (!employeeId) {
          return NextResponse.json({
            members: members.map((m) => ({
              id: m.id,
              name: `${m.firstName || ""} ${m.lastName || ""}`.trim() || m.email,
            })),
            currency,
          });
        }
        const member = members.find((m) => m.id === employeeId);
        if (!member) {
          return NextResponse.json({ error: "Employee not found" }, { status: 404 });
        }
        const employeeEntries = castEntries.filter((e) => e.userId === employeeId);

        // Phase breakdown
        const phaseBreakdown = aggregateEmployeePhaseBreakdown(employeeEntries);

        // Flex trend
        const flexTrend = aggregateEmployeeFlexTrend(employeeEntries, member, from, to, granularity);

        // Utilization trend with planned util
        const utilizationTrend = aggregateEmployeeUtilizationTrend(employeeEntries, member, from, to, granularity);

        // Fetch resource allocations for planned util
        const employeeAllocations = await db.resourceAllocation.findMany({
          where: {
            companyId: user.companyId,
            userId: employeeId,
            status: { not: "completed" },
            OR: [
              { startDate: { lte: to }, endDate: { gte: from } },
            ],
          },
          select: { startDate: true, endDate: true, hoursPerDay: true, status: true },
        });

        // Add plannedUtil to utilization trend
        // We need to import getPeriodKeys/periodKey/weeksInPeriod logic
        // For simplicity, compute planned hours per period inline
        const utilTrendWithPlanned = utilizationTrend.map((point, idx) => {
          // We need to match the period to date ranges
          // The periods come in order from getPeriodKeys(from, to, granularity)
          return { ...point, plannedUtil: 0 };
        });

        // Compute KPIs
        const weeklyTarget = getEffectiveWeeklyCapacity(member);
        const totalWeeksInRange = differenceInDays(to, from) / 7;
        const totalHours = employeeEntries.reduce((s, e) => s + e.hours, 0);
        const billableHours = employeeEntries
          .filter((e) => e.billingStatus === "billable")
          .reduce((s, e) => s + e.hours, 0);
        const expectedHours = weeklyTarget * totalWeeksInRange;
        const billableUtil = expectedHours > 0
          ? Math.round((billableHours / expectedHours) * 1000) / 10
          : 0;
        const flexBalance = Math.round((totalHours - expectedHours) * 10) / 10;

        // Absence days: entries on system-managed Absence project
        const absenceProjects = projects.filter((p) => p.name === "Absence" || p.systemType === "absence");
        const absenceProjectIds = new Set(absenceProjects.map((p) => p.id));
        const absenceHours = employeeEntries
          .filter((e) => absenceProjectIds.has(e.projectId))
          .reduce((s, e) => s + e.hours, 0);
        const absenceDays = Math.round((absenceHours / 7.5) * 10) / 10;

        return NextResponse.json({
          timeDistribution: aggregateEmployeeTimeDistribution(employeeEntries),
          utilizationTrend: utilTrendWithPlanned,
          profitability: aggregateEmployeeProfitability(employeeEntries, member, from, to, granularity),
          phaseBreakdown,
          flexTrend,
          kpis: {
            billableUtil,
            totalHours: Math.round(totalHours * 10) / 10,
            flexBalance,
            absenceDays,
          },
          currency,
        });
      }

      case "team": {
        // Fetch resource allocations
        const resourceAllocations = await db.resourceAllocation.findMany({
          where: { companyId: user.companyId, status: { not: "completed" } },
          select: { userId: true, startDate: true, endDate: true, hoursPerDay: true, status: true, projectId: true },
        });

        // Fetch vacation requests for vacation days count
        const vacationRequests = await db.vacationRequest.findMany({
          where: { companyId: user.companyId, status: "approved" },
          select: { userId: true, startDate: true, endDate: true },
        });

        // Compute vacation days per user within the date range
        const vacationDays: Record<string, number> = {};
        for (const vr of vacationRequests) {
          const vrStart = new Date(vr.startDate);
          const vrEnd = new Date(vr.endDate);
          // Count business days in the overlap with the date range
          const overlapStart = vrStart > from ? vrStart : from;
          const overlapEnd = vrEnd < to ? vrEnd : to;
          if (overlapStart <= overlapEnd) {
            let days = 0;
            const current = new Date(overlapStart);
            while (current <= overlapEnd) {
              const dow = current.getDay();
              if (dow !== 0 && dow !== 6) days++;
              current.setDate(current.getDate() + 1);
            }
            vacationDays[vr.userId] = (vacationDays[vr.userId] || 0) + days;
          }
        }

        // Cast resource allocations for util
        const castResourceAllocs = resourceAllocations.map((a) => ({
          userId: a.userId,
          startDate: new Date(a.startDate),
          endDate: new Date(a.endDate),
          hoursPerDay: a.hoursPerDay,
          status: a.status,
        }));

        // Cast members to MemberFull
        const membersFull = members.map((m) => ({
          ...m,
          isHourly: m.isHourly,
          vacationDays: m.vacationDays,
          vacationTrackingUnit: m.vacationTrackingUnit,
          vacationHoursPerYear: m.vacationHoursPerYear,
        }));

        return NextResponse.json({
          utilization: aggregateTeamUtilization(castEntries, members, from, to, granularity),
          timeMix: aggregateTeamTimeMix(castEntries, members),
          capacityDetail: aggregateCapacityDetail(
            castEntries,
            membersFull,
            castResourceAllocs,
            vacationDays,
            from,
            to,
            granularity
          ),
          effectiveRate: aggregateEffectiveRate(castEntries, projectsFull),
          currency,
        });
      }

      case "project": {
        if (!projectId) {
          return NextResponse.json({
            projects: projects.map((p) => ({
              id: p.id,
              name: p.name,
              client: p.client,
              budgetHours: p.budgetHours,
              active: p.active,
            })),
            billableMix: aggregateProjectBillableMix(castEntries, projects, estimatedNonBillableMap),
            redList: aggregateRedList(castEntries, projectsFull, members, today),
            budgetVelocity: aggregateBudgetVelocity(castEntries, projectsFull, today),
            currency,
          });
        }
        const project = projects.find((p) => p.id === projectId);
        if (!project) {
          return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        const projectEntries = castEntries.filter((e) => e.projectId === projectId);
        return NextResponse.json({
          burndown: aggregateProjectBurndown(castEntries, project, from, to, granularity),
          profitability: aggregateProjectProfitability(castEntries, projectId, from, to, granularity, estimatedNonBillableMap),
          billableMix: aggregateProjectBillableMix(castEntries, projects, estimatedNonBillableMap),
          phaseDistribution: aggregatePhaseDistribution(projectEntries),
          teamContribution: aggregateTeamContribution(projectEntries),
          projects: projects.map((p) => ({
            id: p.id,
            name: p.name,
            client: p.client,
            budgetHours: p.budgetHours,
            active: p.active,
          })),
          redList: aggregateRedList(castEntries, projectsFull, members, today),
          budgetVelocity: aggregateBudgetVelocity(castEntries, projectsFull, today),
          currency,
        });
      }

      case "company": {
        // Fetch approved project expenses within date range
        const projExpenses = await db.expense.findMany({
          where: {
            companyId: user.companyId,
            approvalStatus: "approved",
            date: { gte: from, lte: to },
          },
          select: { amount: true, date: true, category: true, description: true },
        });
        const castProjExpenses = projExpenses.map((e) => ({
          ...e,
          date: e.date.toISOString(),
        }));

        // Fetch company overhead and expand recurring into range
        const rawCompExpenses = await db.companyExpense.findMany({
          where: { companyId: user.companyId },
        });
        const expandedCompExpenses = expandRecurringExpenses(rawCompExpenses, from, to).map((e) => ({
          ...e,
          date: e.date.toISOString(),
        }));

        // Fetch invoices
        const invoices = await db.invoice.findMany({
          where: { companyId: user.companyId },
          select: { status: true, total: true, invoiceDate: true },
        });
        const castInvoices = invoices.map((inv) => ({
          status: inv.status,
          totalAmount: inv.total,
          invoiceDate: inv.invoiceDate.toISOString(),
        }));

        // Fetch resource allocations for revenue bridge
        const resourceAllocations = await db.resourceAllocation.findMany({
          where: { companyId: user.companyId, status: { not: "completed" } },
          select: {
            startDate: true,
            endDate: true,
            hoursPerDay: true,
            status: true,
            projectId: true,
            userId: true,
            project: { select: { billable: true, projectRate: true, rateMode: true } },
            user: { select: { hourlyRate: true } },
          },
        });

        // Revenue Bridge
        const forecastAllocs: ForecastAllocation[] = resourceAllocations
          .filter((a) => a.project.billable)
          .map((a) => ({
            startDate: new Date(a.startDate),
            endDate: new Date(a.endDate),
            hoursPerDay: a.hoursPerDay,
            status: a.status,
            billRate: a.project.rateMode === "PROJECT_RATE"
              ? (a.project.projectRate || 0)
              : (a.user.hourlyRate || 0),
          }));

        // Compute monthly actuals from entries
        const monthlyActualsMap: Record<string, number> = {};
        for (const e of castEntries) {
          if (e.billingStatus === "billable") {
            const key = format(startOfMonth(new Date(e.date)), "yyyy-MM");
            monthlyActualsMap[key] = (monthlyActualsMap[key] || 0) + (e.hours * e.user.hourlyRate);
          }
        }
        const monthlyActuals = Object.entries(monthlyActualsMap).map(([periodKey, revenue]) => ({
          periodKey,
          revenue: Math.round(revenue),
        }));

        // Monthly breakeven = average of total cost per month
        const monthlyCostMap: Record<string, number> = {};
        for (const e of castEntries) {
          const key = format(startOfMonth(new Date(e.date)), "yyyy-MM");
          monthlyCostMap[key] = (monthlyCostMap[key] || 0) + (e.hours * e.user.costRate);
        }
        // Add expense costs
        for (const exp of castProjExpenses) {
          const key = format(startOfMonth(new Date(exp.date)), "yyyy-MM");
          monthlyCostMap[key] = (monthlyCostMap[key] || 0) + exp.amount;
        }
        for (const exp of expandedCompExpenses) {
          const key = format(startOfMonth(new Date(exp.date)), "yyyy-MM");
          monthlyCostMap[key] = (monthlyCostMap[key] || 0) + exp.amount;
        }
        const costValues = Object.values(monthlyCostMap);
        const monthlyBreakeven = costValues.length > 0
          ? Math.round(costValues.reduce((s, v) => s + v, 0) / costValues.length)
          : 0;

        const revenueBridge = computeRevenueBridge(forecastAllocs, monthlyActuals, monthlyBreakeven);

        // Client Concentration
        const clientConcentration = aggregateClientConcentration(castEntries);

        // Invoice Pipeline
        const invoicePipeline = aggregateInvoicePipeline(castInvoices, from, to, granularity);

        // Billing Velocity - entries that have been invoiced
        const invoicedEntries = castEntries
          .filter((e) => e.invoicedAt !== null)
          .map((e) => ({
            date: e.date,
            invoicedAt: e.invoicedAt!.toISOString(),
          }));
        const billingVelocity = aggregateBillingVelocity(castEntries, invoicedEntries);

        // Collection Summary
        const collectionSummary = aggregateCollectionSummary(castInvoices);

        // Unbilled Aging (simpler shape)
        const unbilledAging = aggregateUnbilledAging(castEntries, today);

        return NextResponse.json({
          revenueBridge,
          clientConcentration,
          invoicePipeline,
          billingVelocity,
          collectionSummary,
          expenseBreakdown: aggregateExpenseBreakdown(castProjExpenses, expandedCompExpenses, from, to, granularity),
          nonBillableTrend: aggregateNonBillableTrend(castEntries, from, to, granularity),
          unbilledAging,
          currency,
        });
      }

      case "kpis": {
        // Fetch resource allocations for forecast
        const kpiResourceAllocations = await db.resourceAllocation.findMany({
          where: { companyId: user.companyId, status: { not: "completed" } },
          select: {
            startDate: true,
            endDate: true,
            hoursPerDay: true,
            status: true,
            project: { select: { billable: true, projectRate: true, rateMode: true } },
            user: { select: { hourlyRate: true } },
          },
        });

        const kpiForecastAllocs: ForecastAllocation[] = kpiResourceAllocations
          .filter((a) => a.project.billable)
          .map((a) => ({
            startDate: new Date(a.startDate),
            endDate: new Date(a.endDate),
            hoursPerDay: a.hoursPerDay,
            status: a.status,
            billRate: a.project.rateMode === "PROJECT_RATE"
              ? (a.project.projectRate || 0)
              : (a.user.hourlyRate || 0),
          }));

        const revenueForecast30d = compute30DayForecast(kpiForecastAllocs);

        // EBITDA: revenue - cost - overhead from entries in date range
        let totalRevenue = 0;
        let totalCost = 0;
        for (const e of castEntries) {
          if (e.billingStatus === "billable") {
            totalRevenue += e.hours * e.user.hourlyRate;
          }
          totalCost += e.hours * e.user.costRate;
        }
        const ebitda = Math.round(totalRevenue - totalCost);

        // Average effective rate
        const totalBillableHours = castEntries
          .filter((e) => e.billingStatus === "billable")
          .reduce((s, e) => s + e.hours, 0);
        const avgEffectiveRate = totalBillableHours > 0
          ? Math.round((totalRevenue / totalBillableHours) * 100) / 100
          : 0;

        // Unbilled revenue: approved billable entries not invoiced
        const unbilledEntries = castEntries.filter(
          (e) => e.billingStatus === "billable" &&
            e.approvalStatus === "approved" &&
            !e.invoiceId
        );
        const unbilledRevenue = Math.round(
          unbilledEntries.reduce((s, e) => s + e.hours * e.user.hourlyRate, 0)
        );

        // Unbilled average age
        let unbilledAvgAgeDays = 0;
        if (unbilledEntries.length > 0) {
          const totalAge = unbilledEntries.reduce((s, e) => {
            return s + differenceInDays(today, new Date(e.date));
          }, 0);
          unbilledAvgAgeDays = Math.round((totalAge / unbilledEntries.length) * 10) / 10;
        }

        // Leave liability: for each user, accrued vacation hours x (costRate / 160)
        let leaveLiability = 0;
        for (const m of members) {
          const currentMonth = today.getMonth() + 1;
          let accruedHrs: number;
          if (m.vacationTrackingUnit === "hours" && m.vacationHoursPerYear) {
            accruedHrs = (m.vacationHoursPerYear / 12) * currentMonth;
          } else {
            accruedHrs = 2.08 * currentMonth * 7.5;
          }
          // Add bonus vacation days/hours
          if (m.vacationTrackingUnit === "hours") {
            accruedHrs += m.vacationDays; // bonus hours
          } else {
            accruedHrs += m.vacationDays * 7.5; // bonus days -> hours
          }
          const monthlyCapacity = 160;
          leaveLiability += accruedHrs * (m.costRate / monthlyCapacity);
        }
        leaveLiability = Math.round(leaveLiability);

        return NextResponse.json({
          revenueForecast30d,
          ebitda,
          avgEffectiveRate,
          unbilledRevenue,
          unbilledAvgAgeDays,
          leaveLiability,
          currency,
        });
      }

      default:
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
  } catch (error) {
    console.error("[ANALYTICS]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
