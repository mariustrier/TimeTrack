import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { isCompanyHoliday, isDanishHoliday, type CustomHoliday } from "@/lib/holidays";

/** Map vacation request type to absence reason code */
const TYPE_TO_REASON_CODE: Record<string, string> = {
  vacation: "VACATION",
  sick: "SICK",
  personal: "VACATION",
};

/**
 * Create absence time entries for each business day of an approved vacation.
 * Follows the same pattern as fill-holiday-entries.
 */
async function createVacationEntries(
  vacation: { userId: string; startDate: Date; endDate: Date; type: string },
  companyId: string,
) {
  const absenceProject = await db.project.findFirst({
    where: { companyId, systemType: "absence" },
  });
  if (!absenceProject) return;

  const vacationUser = await db.user.findUnique({
    where: { id: vacation.userId },
    select: { weeklyTarget: true, isHourly: true },
  });
  if (!vacationUser || vacationUser.isHourly) return;

  const reasonCode = TYPE_TO_REASON_CODE[vacation.type] ?? "VACATION";
  const absenceReason = await db.absenceReason.findFirst({
    where: { companyId, code: reasonCode },
  });
  if (!absenceReason) return;

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { disabledHolidays: true },
  });
  const customHolidaysDb = await db.companyHoliday.findMany({
    where: { companyId },
  });
  const customHols: CustomHoliday[] = customHolidaysDb.map((ch) => ({
    name: ch.name,
    month: ch.month,
    day: ch.day,
    year: ch.year,
  }));
  const disabledCodes = company?.disabledHolidays ?? [];

  const wt = vacationUser.weeklyTarget;
  const monThu = Math.round((wt / 5) * 2) / 2;
  const fri = wt - monThu * 4;

  const start = new Date(vacation.startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(vacation.endDate);
  end.setHours(0, 0, 0, 0);

  const d = new Date(start);
  while (d <= end) {
    const dayOfWeek = d.getDay();

    // Skip weekends
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Skip holidays
      const isHoliday = disabledCodes.length > 0 || customHols.length > 0
        ? isCompanyHoliday(d, disabledCodes, customHols)
        : isDanishHoliday(d);

      if (!isHoliday) {
        const hours = dayOfWeek === 5 ? fri : monThu;

        // Don't duplicate if an absence entry already exists
        const existing = await db.timeEntry.findFirst({
          where: {
            userId: vacation.userId,
            companyId,
            date: new Date(d),
            projectId: absenceProject.id,
            absenceReasonId: absenceReason.id,
          },
        });

        if (!existing) {
          await db.timeEntry.create({
            data: {
              hours,
              date: new Date(d),
              comment: absenceReason.name,
              userId: vacation.userId,
              projectId: absenceProject.id,
              companyId,
              approvalStatus: "approved",
              billingStatus: "non_billable",
              absenceReasonId: absenceReason.id,
              approvedAt: new Date(),
              approvedBy: "system",
            },
          });
        }
      }
    }

    d.setDate(d.getDate() + 1);
  }
}

/**
 * Remove auto-created absence entries when a vacation is rejected.
 */
async function deleteVacationEntries(
  vacation: { userId: string; startDate: Date; endDate: Date; type: string },
  companyId: string,
) {
  const absenceProject = await db.project.findFirst({
    where: { companyId, systemType: "absence" },
  });
  if (!absenceProject) return;

  const reasonCode = TYPE_TO_REASON_CODE[vacation.type] ?? "VACATION";
  const absenceReason = await db.absenceReason.findFirst({
    where: { companyId, code: reasonCode },
  });
  if (!absenceReason) return;

  const start = new Date(vacation.startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(vacation.endDate);
  end.setHours(23, 59, 59, 999);

  await db.timeEntry.deleteMany({
    where: {
      userId: vacation.userId,
      companyId,
      projectId: absenceProject.id,
      absenceReasonId: absenceReason.id,
      approvedBy: "system",
      date: { gte: start, lte: end },
    },
  });
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
