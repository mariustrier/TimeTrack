import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { updateResourceAllocationSchema } from "@/lib/schemas";

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  imageUrl: true,
  weeklyTarget: true,
  isHourly: true,
  employmentType: true,
};

const projectSelect = {
  id: true,
  name: true,
  color: true,
  client: true,
};

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

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
        user: { select: userSelect },
        project: { select: projectSelect },
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

    const { startDate, endDate, hoursPerDay, totalHours, status, notes, editDate } = result.data;

    // ── Single-day edit within a multi-day span ──
    if (editDate) {
      const editDay = new Date(editDate);
      editDay.setHours(0, 0, 0, 0);

      const existingStart = new Date(existing.startDate);
      existingStart.setHours(0, 0, 0, 0);
      const existingEnd = new Date(existing.endDate);
      existingEnd.setHours(0, 0, 0, 0);

      if (editDay < existingStart || editDay > existingEnd) {
        return NextResponse.json({ error: "editDate is outside the allocation range" }, { status: 400 });
      }

      // If the allocation is already a single day, just update it normally
      if (isSameDay(existingStart, existingEnd)) {
        const allocation = await db.resourceAllocation.update({
          where: { id: params.id },
          data: {
            hoursPerDay: hoursPerDay ?? existing.hoursPerDay,
            status: status ?? existing.status,
            notes: notes !== undefined ? notes : existing.notes,
            totalHours: null,
          },
          include: {
            user: { select: userSelect },
            project: { select: projectSelect },
          },
        });
        return NextResponse.json(allocation);
      }

      // Split: delete original, create up to 3 new allocations
      const hasBefore = editDay > existingStart;
      const hasAfter = editDay < existingEnd;

      const creates: Parameters<typeof db.resourceAllocation.create>[0]["data"][] = [];

      // "Before" segment
      if (hasBefore) {
        creates.push({
          companyId: user.companyId,
          userId: existing.userId,
          projectId: existing.projectId,
          startDate: existingStart,
          endDate: addDays(editDay, -1),
          hoursPerDay: existing.hoursPerDay,
          totalHours: null,
          status: existing.status,
          notes: existing.notes,
        });
      }

      // "Edited day" segment
      creates.push({
        companyId: user.companyId,
        userId: existing.userId,
        projectId: existing.projectId,
        startDate: editDay,
        endDate: editDay,
        hoursPerDay: hoursPerDay ?? existing.hoursPerDay,
        totalHours: null,
        status: status ?? existing.status,
        notes: notes !== undefined ? notes : existing.notes,
      });

      // "After" segment
      if (hasAfter) {
        creates.push({
          companyId: user.companyId,
          userId: existing.userId,
          projectId: existing.projectId,
          startDate: addDays(editDay, 1),
          endDate: existingEnd,
          hoursPerDay: existing.hoursPerDay,
          totalHours: null,
          status: existing.status,
          notes: existing.notes,
        });
      }

      // Execute in transaction
      const results = await db.$transaction(async (tx) => {
        await tx.resourceAllocation.delete({ where: { id: params.id } });
        const created = [];
        for (const data of creates) {
          created.push(await tx.resourceAllocation.create({ data }));
        }
        return created;
      });

      // Return the edited-day allocation (index 0 if no before, 1 if before)
      const editedIndex = hasBefore ? 1 : 0;
      const editedAlloc = await db.resourceAllocation.findUnique({
        where: { id: results[editedIndex].id },
        include: {
          user: { select: userSelect },
          project: { select: projectSelect },
        },
      });

      return NextResponse.json(editedAlloc);
    }

    // ── Standard full-allocation update ──
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
        user: { select: userSelect },
        project: { select: projectSelect },
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

    // Check for ?date= query param — single-day removal from a span
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");

    if (dateParam) {
      const removeDay = new Date(dateParam);
      removeDay.setHours(0, 0, 0, 0);

      const existingStart = new Date(existing.startDate);
      existingStart.setHours(0, 0, 0, 0);
      const existingEnd = new Date(existing.endDate);
      existingEnd.setHours(0, 0, 0, 0);

      if (removeDay < existingStart || removeDay > existingEnd) {
        return NextResponse.json({ error: "date is outside the allocation range" }, { status: 400 });
      }

      // If single-day allocation, just delete
      if (isSameDay(existingStart, existingEnd)) {
        await db.resourceAllocation.delete({ where: { id: params.id } });
        return NextResponse.json({ success: true });
      }

      // Split: remove the day, keep before and/or after segments
      const hasBefore = removeDay > existingStart;
      const hasAfter = removeDay < existingEnd;

      await db.$transaction(async (tx) => {
        await tx.resourceAllocation.delete({ where: { id: params.id } });

        if (hasBefore) {
          await tx.resourceAllocation.create({
            data: {
              companyId: user.companyId,
              userId: existing.userId,
              projectId: existing.projectId,
              startDate: existingStart,
              endDate: addDays(removeDay, -1),
              hoursPerDay: existing.hoursPerDay,
              totalHours: null,
              status: existing.status,
              notes: existing.notes,
            },
          });
        }

        if (hasAfter) {
          await tx.resourceAllocation.create({
            data: {
              companyId: user.companyId,
              userId: existing.userId,
              projectId: existing.projectId,
              startDate: addDays(removeDay, 1),
              endDate: existingEnd,
              hoursPerDay: existing.hoursPerDay,
              totalHours: null,
              status: existing.status,
              notes: existing.notes,
            },
          });
        }
      });

      return NextResponse.json({ success: true });
    }

    // Standard full-allocation delete
    await db.resourceAllocation.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[RESOURCE_ALLOCATION_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
