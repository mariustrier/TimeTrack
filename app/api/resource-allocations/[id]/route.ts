import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { updateResourceAllocationSchema } from "@/lib/schemas";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "admin" && user.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const allocation = await db.resourceAllocation.findFirst({
      where: { id: params.id, companyId: user.companyId },
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

    if (!allocation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(allocation);
  } catch (error) {
    console.error("[RESOURCE_ALLOCATION_GET]", error);
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

    if (user.role !== "admin" && user.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existing = await db.resourceAllocation.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const result = validate(updateResourceAllocationSchema, body);
    if (!result.success) return result.response;

    const { startDate, endDate, hoursPerDay, totalHours, status, notes } = result.data;

    const updateData: Record<string, unknown> = {};
    if (startDate !== undefined) updateData.startDate = new Date(startDate);
    if (endDate !== undefined) updateData.endDate = new Date(endDate);
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    // Handle totalHours mode
    if (totalHours !== undefined) {
      updateData.totalHours = totalHours;
      if (totalHours) {
        // Recalculate hoursPerDay based on working days
        const start = startDate ? new Date(startDate) : existing.startDate;
        const end = endDate ? new Date(endDate) : existing.endDate;
        let workingDays = 0;
        const current = new Date(start);
        while (current <= end) {
          const dayOfWeek = current.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) workingDays++;
          current.setDate(current.getDate() + 1);
        }
        updateData.hoursPerDay = workingDays > 0 ? totalHours / workingDays : totalHours;
      }
    } else if (hoursPerDay !== undefined) {
      updateData.hoursPerDay = hoursPerDay;
      updateData.totalHours = null; // Clear totalHours when switching to per-day mode
    }

    const allocation = await db.resourceAllocation.update({
      where: { id: params.id },
      data: updateData,
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

    return NextResponse.json(allocation);
  } catch (error) {
    console.error("[RESOURCE_ALLOCATION_PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "admin" && user.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existing = await db.resourceAllocation.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.resourceAllocation.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[RESOURCE_ALLOCATION_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
