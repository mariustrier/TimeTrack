import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { createProjectSchema } from "@/lib/schemas";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Non-admins should not see archived projects
    const projectWhere = user.role === "admin"
      ? { companyId: user.companyId }
      : { companyId: user.companyId, archived: false };

    const [projects, hoursUsedAgg, allocations, myHoursUsedAgg, company, users, billableAgg] =
      await Promise.all([
        db.project.findMany({
          where: projectWhere,
          include: {
            _count: { select: { timeEntries: true } },
            currentPhase: { select: { id: true, name: true, sortOrder: true, color: true } },
          },
          orderBy: { name: "asc" },
        }),

        // Total hours per project (including drafts so budget bars reflect real usage)
        db.timeEntry.groupBy({
          by: ["projectId"],
          where: {
            companyId: user.companyId,
          },
          _sum: { hours: true },
        }),

        // Current user's allocation per project
        db.projectAllocation.findMany({
          where: { userId: user.id, companyId: user.companyId },
          select: { projectId: true, hours: true },
        }),

        // Current user's hours per project (including drafts)
        db.timeEntry.groupBy({
          by: ["projectId"],
          where: {
            userId: user.id,
            companyId: user.companyId,
          },
          _sum: { hours: true },
        }),

        // Company settings for universal rate
        db.company.findUnique({
          where: { id: user.companyId },
          select: { defaultHourlyRate: true, useUniversalRate: true, phasesEnabled: true },
        }),

        // User rates for moneyUsed calculation
        db.user.findMany({
          where: { companyId: user.companyId },
          select: { id: true, hourlyRate: true, employmentType: true },
        }),

        // Billable hours grouped by project+user (committed only)
        db.timeEntry.groupBy({
          by: ["projectId", "userId"],
          where: {
            companyId: user.companyId,
            billingStatus: { in: ["billable", "included"] },
            approvalStatus: { in: ["submitted", "approved", "locked"] },
          },
          _sum: { hours: true },
        }),
      ]);

    const hoursMap: Record<string, number> = {};
    for (const entry of hoursUsedAgg) {
      hoursMap[entry.projectId] = entry._sum.hours || 0;
    }

    const allocationMap: Record<string, number | null> = {};
    for (const alloc of allocations) {
      allocationMap[alloc.projectId] = alloc.hours;
    }

    const myHoursMap: Record<string, number> = {};
    for (const entry of myHoursUsedAgg) {
      myHoursMap[entry.projectId] = entry._sum.hours || 0;
    }

    const userRateMap: Record<string, number> = {};
    for (const u of users) {
      const isFreelancer = u.employmentType === "freelancer";
      userRateMap[u.id] = (company?.useUniversalRate && !isFreelancer && company.defaultHourlyRate)
        ? company.defaultHourlyRate
        : u.hourlyRate;
    }

    const moneyUsedMap: Record<string, number> = {};
    for (const agg of billableAgg) {
      const rate = userRateMap[agg.userId] || 0;
      moneyUsedMap[agg.projectId] = (moneyUsedMap[agg.projectId] || 0) + (agg._sum.hours || 0) * rate;
    }

    const enriched = projects.map((p) => {
      // Calculate budget in hours for fixed-price projects
      let budgetTotalHours: number | null = null;
      let effectiveRate = 0;
      if (p.pricingType === "fixed_price" && p.fixedPrice) {
        const rm = p.rateMode || "COMPANY_RATE";
        if (rm === "PROJECT_RATE") {
          effectiveRate = p.projectRate || company?.defaultHourlyRate || 0;
        } else {
          effectiveRate = company?.defaultHourlyRate || 0;
        }
        budgetTotalHours = effectiveRate > 0 ? Math.floor(p.fixedPrice / effectiveRate) : null;
      } else {
        budgetTotalHours = p.budgetHours;
      }
      return {
        ...p,
        hoursUsed: hoursMap[p.id] || 0,
        myAllocation: allocationMap[p.id] || null,
        myHoursUsed: myHoursMap[p.id] || 0,
        moneyUsed: moneyUsedMap[p.id] || 0,
        budgetTotalHours,
        effectiveRate,
      };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("[PROJECTS_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const result = validate(createProjectSchema, body);
    if (!result.success) return result.response;
    const { name, client, color, budgetHours, billable, currency, pricingType, fixedPrice, rateMode, projectRate } = result.data;

    // Auto-assign first phase if company has phases enabled
    let currentPhaseId: string | null = null;
    const usePhasesForProject = body.phasesEnabled !== false;
    if (user.company.phasesEnabled && usePhasesForProject) {
      const firstPhase = await db.phase.findFirst({
        where: { companyId: user.companyId, active: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      });
      if (firstPhase) currentPhaseId = firstPhase.id;
    }

    const project = await db.project.create({
      data: {
        name,
        client: client || null,
        color: color || "#3B82F6",
        budgetHours: budgetHours || null,
        billable: billable !== false,
        currency: currency || null,
        pricingType: pricingType || "hourly",
        fixedPrice: fixedPrice || null,
        rateMode: rateMode || "COMPANY_RATE",
        projectRate: projectRate || null,
        companyId: user.companyId,
        phasesEnabled: usePhasesForProject,
        currentPhaseId,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("[PROJECTS_POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
