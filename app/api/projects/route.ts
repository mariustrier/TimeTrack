import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [projects, hoursUsedAgg, allocations, myHoursUsedAgg] =
      await Promise.all([
        db.project.findMany({
          where: { companyId: user.companyId },
          include: {
            _count: { select: { timeEntries: true } },
          },
          orderBy: { name: "asc" },
        }),

        // Total billable/included hours per project
        db.timeEntry.groupBy({
          by: ["projectId"],
          where: {
            companyId: user.companyId,
            billingStatus: { in: ["billable", "included"] },
          },
          _sum: { hours: true },
        }),

        // Current user's allocation per project
        db.projectAllocation.findMany({
          where: { userId: user.id, companyId: user.companyId },
          select: { projectId: true, hours: true },
        }),

        // Current user's billable/included hours per project
        db.timeEntry.groupBy({
          by: ["projectId"],
          where: {
            userId: user.id,
            companyId: user.companyId,
            billingStatus: { in: ["billable", "included"] },
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

    // Fetch company settings for universal rate
    const company = await db.company.findUnique({
      where: { id: user.companyId },
      select: { defaultHourlyRate: true, useUniversalRate: true },
    });

    // Fetch user rates for moneyUsed calculation
    const users = await db.user.findMany({
      where: { companyId: user.companyId },
      select: { id: true, hourlyRate: true, employmentType: true },
    });
    const userRateMap: Record<string, number> = {};
    for (const u of users) {
      const isFreelancer = u.employmentType === "freelancer";
      userRateMap[u.id] = (company?.useUniversalRate && !isFreelancer && company.defaultHourlyRate)
        ? company.defaultHourlyRate
        : u.hourlyRate;
    }

    // Fetch billable time entries for moneyUsed calculation
    const billableEntries = await db.timeEntry.findMany({
      where: {
        companyId: user.companyId,
        billingStatus: { in: ["billable", "included"] },
      },
      select: { projectId: true, userId: true, hours: true },
    });

    const moneyUsedMap: Record<string, number> = {};
    for (const entry of billableEntries) {
      const rate = userRateMap[entry.userId] || 0;
      moneyUsedMap[entry.projectId] = (moneyUsedMap[entry.projectId] || 0) + entry.hours * rate;
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
    const { name, client, color, budgetHours, billable, currency, pricingType, fixedPrice, rateMode, projectRate } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const project = await db.project.create({
      data: {
        name,
        client: client || null,
        color: color || "#3B82F6",
        budgetHours: budgetHours ? parseFloat(budgetHours) : null,
        billable: billable !== false,
        currency: currency || null,
        pricingType: pricingType || "hourly",
        fixedPrice: fixedPrice ? parseFloat(fixedPrice) : null,
        rateMode: rateMode || "COMPANY_RATE",
        projectRate: projectRate ? parseFloat(projectRate) : null,
        companyId: user.companyId,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("[PROJECTS_POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
