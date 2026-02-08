import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { getCompanyHolidaysInRange, type CustomHoliday } from "@/lib/holidays";
import { ensureHolidayAbsenceReason } from "@/lib/seed-holidays";

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const currentYear = new Date().getFullYear();
    const startDate = new Date(currentYear, 0, 1);
    const endDate = new Date(currentYear, 11, 31);

    const company = await db.company.findUnique({
      where: { id: user.companyId },
      select: { disabledHolidays: true },
    });

    const customHolidaysDb = await db.companyHoliday.findMany({
      where: { companyId: user.companyId },
    });
    const customHols: CustomHoliday[] = customHolidaysDb.map((ch) => ({
      name: ch.name,
      month: ch.month,
      day: ch.day,
      year: ch.year,
    }));

    const holidays = getCompanyHolidaysInRange(
      startDate,
      endDate,
      company?.disabledHolidays ?? [],
      customHols,
    );

    // Get absence project
    const absenceProject = await db.project.findFirst({
      where: { companyId: user.companyId, systemType: "absence" },
    });
    if (!absenceProject) {
      return NextResponse.json({ error: "No absence project found" }, { status: 400 });
    }

    const holidayReasonId = await ensureHolidayAbsenceReason(user.companyId);

    // Get active employees
    const users = await db.user.findMany({
      where: {
        companyId: user.companyId,
        deletedAt: null,
      },
      select: { id: true, weeklyTarget: true },
    });

    let entriesCreated = 0;
    let alreadyExisted = 0;

    for (const holiday of holidays) {
      const holidayDate = new Date(holiday.date);
      holidayDate.setHours(0, 0, 0, 0);

      const dayOfWeek = holidayDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends

      for (const u of users) {
        const existing = await db.timeEntry.findFirst({
          where: {
            userId: u.id,
            companyId: user.companyId,
            date: holidayDate,
            absenceReasonId: holidayReasonId,
          },
        });

        if (existing) {
          alreadyExisted++;
          continue;
        }

        const monThu = Math.round((u.weeklyTarget / 5) * 2) / 2;
        const fri = u.weeklyTarget - monThu * 4;
        const hours = dayOfWeek === 5 ? fri : monThu;

        await db.timeEntry.create({
          data: {
            hours,
            date: holidayDate,
            comment: holiday.name,
            userId: u.id,
            projectId: absenceProject.id,
            companyId: user.companyId,
            approvalStatus: "approved",
            billingStatus: "non_billable",
            absenceReasonId: holidayReasonId,
            approvedAt: new Date(),
            approvedBy: "system",
          },
        });

        entriesCreated++;
      }
    }

    return NextResponse.json({ success: true, entriesCreated, alreadyExisted });
  } catch (error) {
    console.error("[FILL_HOLIDAYS]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
