import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
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
      select: { currency: true },
    });

    const members = await db.user.findMany({
      where: { companyId: user.companyId },
    });

    const entries = await db.timeEntry.findMany({
      where: {
        companyId: user.companyId,
        ...dateFilter,
      },
      include: {
        user: true,
        project: true,
      },
    });

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
      const revenue = memberBillableHours * member.hourlyRate;
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
        hourlyRate: member.hourlyRate,
        costRate: member.costRate,
        weeklyTarget: member.weeklyTarget,
        utilization: member.weeklyTarget > 0 ? (hours / member.weeklyTarget) * 100 : 0,
      };
    });

    const targetHours = members.reduce((sum, m) => sum + m.weeklyTarget, 0);

    return NextResponse.json({
      totalRevenue,
      totalCost,
      totalProfit: totalRevenue - totalCost,
      totalHours,
      billableHours,
      utilization: targetHours > 0 ? (totalHours / targetHours) * 100 : 0,
      employeeStats,
      currency: company?.currency || "USD",
    });
  } catch (error) {
    console.error("[ADMIN_STATS]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
