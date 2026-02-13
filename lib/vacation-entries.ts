import { db } from "@/lib/db";
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
export async function createVacationEntries(
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
 * Remove auto-created absence entries when a vacation is rejected or cancelled.
 */
export async function deleteVacationEntries(
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
