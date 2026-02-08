import { db } from "./db";

/**
 * Ensures a system-default "Holiday" absence reason exists for the given company.
 * Returns the absence reason ID.
 */
export async function ensureHolidayAbsenceReason(companyId: string): Promise<string> {
  const existing = await db.absenceReason.findFirst({
    where: { companyId, code: "HOLIDAY" },
  });

  if (existing) return existing.id;

  const created = await db.absenceReason.create({
    data: {
      companyId,
      name: "Holiday",
      code: "HOLIDAY",
      isDefault: true,
      sortOrder: -10,
      active: true,
    },
  });

  return created.id;
}
