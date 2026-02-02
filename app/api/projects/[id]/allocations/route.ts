import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const project = await db.project.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });
    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [allocations, hoursUsedAgg] = await Promise.all([
      db.projectAllocation.findMany({
        where: { projectId: params.id, companyId: user.companyId },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),

      db.timeEntry.groupBy({
        by: ["userId"],
        where: {
          projectId: params.id,
          companyId: user.companyId,
          billingStatus: { in: ["billable", "included"] },
        },
        _sum: { hours: true },
      }),
    ]);

    const hoursUsedMap: Record<string, number> = {};
    for (const entry of hoursUsedAgg) {
      hoursUsedMap[entry.userId] = entry._sum.hours || 0;
    }

    const enriched = allocations.map((a) => ({
      id: a.id,
      userId: a.userId,
      userName: [a.user.firstName, a.user.lastName].filter(Boolean).join(" ") || a.user.email,
      hours: a.hours,
      hoursUsed: hoursUsedMap[a.userId] || 0,
    }));

    return NextResponse.json({
      allocations: enriched,
      budgetHours: project.budgetHours,
      projectName: project.name,
      pricingType: project.pricingType,
      fixedPrice: project.fixedPrice,
      rateMode: project.rateMode,
      projectRate: project.projectRate,
    });
  } catch (error) {
    console.error("[ALLOCATIONS_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const project = await db.project.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });
    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!project.budgetHours && !project.fixedPrice) {
      return NextResponse.json({ error: "Project has no budget" }, { status: 400 });
    }

    const body = await req.json();
    const { allocations } = body;

    if (!allocations || !Array.isArray(allocations)) {
      return NextResponse.json({ error: "Allocations array is required" }, { status: 400 });
    }

    const filtered = allocations.filter(
      (a: { userId: string; hours: number }) => a.hours
    );

    const result = await db.$transaction(async (tx) => {
      await tx.projectAllocation.deleteMany({
        where: { projectId: params.id, companyId: user.companyId },
      });

      if (filtered.length > 0) {
        await tx.projectAllocation.createMany({
          data: filtered.map((a: { userId: string; hours: number }) => ({
            projectId: params.id,
            userId: a.userId,
            hours: a.hours,
            companyId: user.companyId,
          })),
        });
      }

      return tx.projectAllocation.findMany({
        where: { projectId: params.id, companyId: user.companyId },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[ALLOCATIONS_PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
