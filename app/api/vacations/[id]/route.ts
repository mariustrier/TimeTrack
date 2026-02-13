import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { createVacationEntries, deleteVacationEntries } from "@/lib/vacation-entries";

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const vacation = await db.vacationRequest.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });

    if (!vacation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();

    // Admin can approve/reject any request
    if (user.role === "admin") {
      const { status } = body;
      if (status && ["approved", "rejected"].includes(status)) {
        const updated = await db.vacationRequest.update({
          where: { id: params.id },
          data: {
            status,
            reviewedBy: user.id,
            reviewedAt: new Date(),
          },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        });

        // Auto-create or clean up absence time entries
        if (status === "approved") {
          await createVacationEntries(vacation, user.companyId);
        } else if (status === "rejected" && vacation.status === "approved") {
          await deleteVacationEntries(vacation, user.companyId);
        }

        return NextResponse.json(updated);
      }
    }

    // Employee can update their own pending request
    if (vacation.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (vacation.status !== "pending") {
      return NextResponse.json({ error: "Can only update pending requests" }, { status: 400 });
    }

    const { startDate, endDate, type, note } = body;

    const updated = await db.vacationRequest.update({
      where: { id: params.id },
      data: {
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(type && { type }),
        ...(note !== undefined && { note: note || null }),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[VACATION_PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const vacation = await db.vacationRequest.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });

    if (!vacation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (user.role !== "admin" && vacation.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (user.role !== "admin" && !["pending", "approved"].includes(vacation.status)) {
      return NextResponse.json({ error: "Can only cancel pending or approved requests" }, { status: 400 });
    }

    // Clean up auto-created entries if the vacation was approved
    if (vacation.status === "approved") {
      await deleteVacationEntries(vacation, user.companyId);
    }

    // If an employee cancels their own approved vacation, mark as "cancelled"
    // so admins are notified. Otherwise hard-delete (pending or admin-initiated).
    if (user.role !== "admin" && vacation.status === "approved") {
      await db.vacationRequest.update({
        where: { id: params.id },
        data: { status: "cancelled" },
      });
    } else {
      await db.vacationRequest.delete({ where: { id: params.id } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[VACATION_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
