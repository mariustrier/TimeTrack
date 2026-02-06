import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { createResourceAllocationSchema } from "@/lib/schemas";

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admin/manager can view resource allocations
    if (user.role !== "admin" && user.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const userId = searchParams.get("userId");
    const projectId = searchParams.get("projectId");

    const whereClause: Record<string, unknown> = {
      companyId: user.companyId,
    };

    // Filter by date range if provided
    if (startDate && endDate) {
      whereClause.OR = [
        // Allocation overlaps with requested range
        {
          startDate: { lte: new Date(endDate) },
          endDate: { gte: new Date(startDate) },
        },
      ];
    }

    if (userId) {
      whereClause.userId = userId;
    }

    if (projectId) {
      whereClause.projectId = projectId;
    }

    const allocations = await db.resourceAllocation.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            imageUrl: true,
            weeklyTarget: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            color: true,
            client: true,
          },
        },
      },
      orderBy: [{ startDate: "asc" }, { userId: "asc" }],
    });

    return NextResponse.json(allocations);
  } catch (error) {
    console.error("[RESOURCE_ALLOCATIONS_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admin/manager can create allocations
    if (user.role !== "admin" && user.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const result = validate(createResourceAllocationSchema, body);
    if (!result.success) return result.response;

    const { userId, projectId, startDate, endDate, hoursPerDay, totalHours, status, notes } = result.data;

    // Verify user belongs to company
    const targetUser = await db.user.findFirst({
      where: { id: userId, companyId: user.companyId },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify project belongs to company and is not archived
    const project = await db.project.findFirst({
      where: { id: projectId, companyId: user.companyId, archived: false },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Calculate hoursPerDay from totalHours if provided
    let calculatedHoursPerDay = hoursPerDay ?? 7.5;
    if (totalHours) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      let workingDays = 0;
      const current = new Date(start);
      while (current <= end) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) workingDays++;
        current.setDate(current.getDate() + 1);
      }
      calculatedHoursPerDay = workingDays > 0 ? totalHours / workingDays : totalHours;
    }

    const allocation = await db.resourceAllocation.create({
      data: {
        companyId: user.companyId,
        userId,
        projectId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        hoursPerDay: calculatedHoursPerDay,
        totalHours: totalHours ?? null,
        status: status ?? "tentative",
        notes: notes ?? null,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            imageUrl: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            color: true,
            client: true,
          },
        },
      },
    });

    return NextResponse.json(allocation, { status: 201 });
  } catch (error) {
    console.error("[RESOURCE_ALLOCATIONS_POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
