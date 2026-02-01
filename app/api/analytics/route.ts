import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import {
  aggregateEmployeeTimeDistribution,
  aggregateEmployeeUtilizationTrend,
  aggregateEmployeeProfitability,
  aggregateTeamUtilization,
  aggregateTeamProfitability,
  aggregateTeamTimeMix,
  aggregateProjectBurndown,
  aggregateProjectProfitability,
  aggregateProjectBillableMix,
  aggregateCompanyRevenueOverhead,
  aggregateNonBillableTrend,
  aggregateUnbilledWork,
} from "@/lib/analytics-utils";

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
      where: { companyId: user.companyId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        hourlyRate: true,
        costRate: true,
        weeklyTarget: true,
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
      },
    });

    const entries = await db.timeEntry.findMany({
      where: {
        companyId: user.companyId,
        ...dateFilter,
      },
      include: {
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

        return NextResponse.json({
          timeDistribution: aggregateEmployeeTimeDistribution(employeeEntries),
          utilizationTrend: aggregateEmployeeUtilizationTrend(employeeEntries, member, from, to, granularity),
          profitability: aggregateEmployeeProfitability(employeeEntries, member, from, to, granularity),
          currency,
        });
      }

      case "team": {
        return NextResponse.json({
          utilization: aggregateTeamUtilization(castEntries, members, from, to, granularity),
          profitability: aggregateTeamProfitability(castEntries, members),
          timeMix: aggregateTeamTimeMix(castEntries, members),
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
            billableMix: aggregateProjectBillableMix(castEntries, projects),
            currency,
          });
        }
        const project = projects.find((p) => p.id === projectId);
        if (!project) {
          return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        return NextResponse.json({
          burndown: aggregateProjectBurndown(castEntries, project, from, to, granularity),
          profitability: aggregateProjectProfitability(castEntries, projectId, from, to, granularity),
          billableMix: aggregateProjectBillableMix(castEntries, projects),
          currency,
        });
      }

      case "company": {
        return NextResponse.json({
          revenueOverhead: aggregateCompanyRevenueOverhead(castEntries, from, to, granularity),
          nonBillableTrend: aggregateNonBillableTrend(castEntries, from, to, granularity),
          unbilledWork: aggregateUnbilledWork(castEntries),
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
