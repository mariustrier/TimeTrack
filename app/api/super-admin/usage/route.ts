import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await requireSuperAdmin();

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const companies = await db.company.findMany({
      where: { isDemo: false },
      select: { id: true, name: true },
    });
    const companyMap = new Map(companies.map((c) => [c.id, c.name]));

    const dailyUsage = await db.aIApiUsage.groupBy({
      by: ["companyId"],
      where: { createdAt: { gte: startOfDay } },
      _sum: { costCents: true },
    });

    const monthlyUsage = await db.aIApiUsage.groupBy({
      by: ["companyId"],
      where: { createdAt: { gte: startOfMonth } },
      _sum: { costCents: true },
    });

    const totalUsage = await db.aIApiUsage.groupBy({
      by: ["companyId"],
      _sum: { costCents: true },
    });

    const realCompanyIds = new Set(companies.map((c) => c.id));
    const companyIds = new Set([
      ...dailyUsage.map((d) => d.companyId),
      ...monthlyUsage.map((d) => d.companyId),
      ...totalUsage.map((d) => d.companyId),
    ].filter((id) => realCompanyIds.has(id)));

    const dailyMap = new Map(dailyUsage.map((d) => [d.companyId, d._sum.costCents ?? 0]));
    const monthlyMap = new Map(monthlyUsage.map((d) => [d.companyId, d._sum.costCents ?? 0]));
    const totalMap = new Map(totalUsage.map((d) => [d.companyId, d._sum.costCents ?? 0]));

    const usage = Array.from(companyIds).map((companyId) => ({
      companyId,
      companyName: companyMap.get(companyId) || "Unknown",
      dailyCostCents: dailyMap.get(companyId) ?? 0,
      monthlyCostCents: monthlyMap.get(companyId) ?? 0,
      totalCostCents: totalMap.get(companyId) ?? 0,
    }));

    usage.sort((a, b) => b.totalCostCents - a.totalCostCents);

    const globalDaily = dailyUsage.reduce((sum, d) => sum + (d._sum.costCents ?? 0), 0);
    const globalMonthly = monthlyUsage.reduce((sum, d) => sum + (d._sum.costCents ?? 0), 0);
    const globalTotal = totalUsage.reduce((sum, d) => sum + (d._sum.costCents ?? 0), 0);

    return NextResponse.json({
      usage,
      totals: {
        dailyCostCents: globalDaily,
        monthlyCostCents: globalMonthly,
        totalCostCents: globalTotal,
        dailyLimitCents: 500,
        monthlyLimitCents: 5000,
      },
    });
  } catch (error) {
    console.error("[SUPER_ADMIN_USAGE]", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
