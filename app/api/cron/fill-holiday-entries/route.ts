import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCompanyHolidaysInRange, type CustomHoliday } from "@/lib/holidays";
import { getDailyTarget } from "@/lib/calculations";
import { ensureHolidayAbsenceReason } from "@/lib/seed-holidays";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lookAhead = new Date(today);
    lookAhead.setDate(lookAhead.getDate() + 7);

    const companies = await db.company.findMany({
      select: {
        id: true,
        disabledHolidays: true,
      },
    });

    let totalEntriesCreated = 0;
    let companiesProcessed = 0;

    for (const company of companies) {
      try {
        const customHolidays = await db.companyHoliday.findMany({
          where: { companyId: company.id },
        });
        const customHols: CustomHoliday[] = customHolidays.map((ch) => ({
          name: ch.name,
          month: ch.month,
          day: ch.day,
          year: ch.year,
        }));

        const holidays = getCompanyHolidaysInRange(
          today,
          lookAhead,
          company.disabledHolidays,
          customHols,
        );

        if (holidays.length === 0) continue;

        // Get absence project
        const absenceProject = await db.project.findFirst({
          where: { companyId: company.id, systemType: "absence" },
        });
        if (!absenceProject) continue;

        // Ensure Holiday absence reason
        const holidayReasonId = await ensureHolidayAbsenceReason(company.id);

        // Get active employees
        const users = await db.user.findMany({
          where: {
            companyId: company.id,
            deletedAt: null,
          },
          select: { id: true, weeklyTarget: true },
        });

        for (const holiday of holidays) {
          const holidayDate = new Date(holiday.date);
          holidayDate.setHours(0, 0, 0, 0);

          for (const user of users) {
            // Check if entry already exists for this user/date
            const existing = await db.timeEntry.findFirst({
              where: {
                userId: user.id,
                companyId: company.id,
                date: holidayDate,
                absenceReasonId: holidayReasonId,
              },
            });

            if (existing) continue;

            // Calculate full-day hours for this user
            const dayTarget = getDailyTarget(
              holidayDate,
              user.weeklyTarget,
              // Don't pass holiday config here - we want the "would-be" target
            );
            // If getDailyTarget returns 0 because it's a holiday,
            // calculate what the target would have been without the holiday
            const dayOfWeek = holidayDate.getDay();
            let hours: number;
            if (dayOfWeek === 0 || dayOfWeek === 6) {
              continue; // Skip weekends
            } else {
              const monThu = Math.round((user.weeklyTarget / 5) * 2) / 2;
              const fri = user.weeklyTarget - monThu * 4;
              hours = dayOfWeek === 5 ? fri : monThu;
            }

            await db.timeEntry.create({
              data: {
                hours,
                date: holidayDate,
                comment: holiday.name,
                userId: user.id,
                projectId: absenceProject.id,
                companyId: company.id,
                approvalStatus: "approved",
                billingStatus: "non_billable",
                absenceReasonId: holidayReasonId,
                approvedAt: new Date(),
                approvedBy: "system",
              },
            });

            totalEntriesCreated++;
          }
        }

        companiesProcessed++;
      } catch (error) {
        console.error(`[CRON_HOLIDAYS] Failed for company ${company.id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      companiesProcessed,
      entriesCreated: totalEntriesCreated,
    });
  } catch (error) {
    console.error("[CRON_FILL_HOLIDAYS]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
