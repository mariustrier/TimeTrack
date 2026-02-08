/**
 * Danish public holiday computation.
 *
 * Uses the Meeus/Jones/Butcher algorithm for Easter and derives
 * all movable feasts from it.  Fixed holidays: Jan 1, Dec 24-26.
 * Store Bededag was abolished in 2024 and is NOT included.
 * Grundlovsdag (Jun 5) is NOT included (varies by company).
 */

export interface DanishHoliday {
  date: Date;
  nameEn: string;
  nameDa: string;
  code: string;
}

// Module-level cache: year → holidays
const cache = new Map<number, DanishHoliday[]>();

/** Meeus/Jones/Butcher algorithm – returns Easter Sunday for a given year. */
export function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Returns all 12 Danish public holidays for the given year. */
export function getDanishHolidays(year: number): DanishHoliday[] {
  const cached = cache.get(year);
  if (cached) return cached;

  const easter = getEasterDate(year);

  const holidays: DanishHoliday[] = [
    { date: new Date(year, 0, 1), nameEn: "New Year's Day", nameDa: "Nyt\u00e5rsdag", code: "NEW_YEARS_DAY" },
    { date: addDays(easter, -3), nameEn: "Maundy Thursday", nameDa: "Sk\u00e6rtorsdag", code: "MAUNDY_THURSDAY" },
    { date: addDays(easter, -2), nameEn: "Good Friday", nameDa: "Langfredag", code: "GOOD_FRIDAY" },
    { date: easter, nameEn: "Easter Sunday", nameDa: "P\u00e5skedag", code: "EASTER_SUNDAY" },
    { date: addDays(easter, 1), nameEn: "Easter Monday", nameDa: "2. P\u00e5skedag", code: "EASTER_MONDAY" },
    { date: addDays(easter, 39), nameEn: "Ascension Day", nameDa: "Kristi Himmelfartsdag", code: "ASCENSION_DAY" },
    { date: addDays(easter, 49), nameEn: "Whit Sunday", nameDa: "Pinsedag", code: "WHIT_SUNDAY" },
    { date: addDays(easter, 50), nameEn: "Whit Monday", nameDa: "2. Pinsedag", code: "WHIT_MONDAY" },
    { date: new Date(year, 11, 24), nameEn: "Christmas Eve", nameDa: "Juleaftensdag", code: "CHRISTMAS_EVE" },
    { date: new Date(year, 11, 25), nameEn: "Christmas Day", nameDa: "Juledag", code: "CHRISTMAS_DAY" },
    { date: new Date(year, 11, 26), nameEn: "2nd Christmas Day", nameDa: "2. Juledag", code: "SECOND_CHRISTMAS_DAY" },
  ];

  // Normalise all dates to midnight
  for (const h of holidays) {
    h.date.setHours(0, 0, 0, 0);
  }

  cache.set(year, holidays);
  return holidays;
}

/** All valid Danish holiday codes. */
export const DANISH_HOLIDAY_CODES = [
  "NEW_YEARS_DAY",
  "MAUNDY_THURSDAY",
  "GOOD_FRIDAY",
  "EASTER_SUNDAY",
  "EASTER_MONDAY",
  "ASCENSION_DAY",
  "WHIT_SUNDAY",
  "WHIT_MONDAY",
  "CHRISTMAS_EVE",
  "CHRISTMAS_DAY",
  "SECOND_CHRISTMAS_DAY",
] as const;

export type DanishHolidayCode = (typeof DANISH_HOLIDAY_CODES)[number];

// ── Lookup helpers ─────────────────────────────────────────────

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDate(date: Date | string): Date {
  if (typeof date === "string") {
    // Handle "YYYY-MM-DD" and ISO strings
    const parts = date.split("T")[0].split("-");
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Check if a date is a standard Danish holiday (ignores company overrides). */
export function isDanishHoliday(date: Date | string): boolean {
  const d = parseDate(date);
  const holidays = getDanishHolidays(d.getFullYear());
  const key = toKey(d);
  return holidays.some((h) => toKey(h.date) === key);
}

/** Get the holiday name for a date, or null. */
export function getHolidayName(date: Date | string, locale: "en" | "da" = "en"): string | null {
  const d = parseDate(date);
  const holidays = getDanishHolidays(d.getFullYear());
  const key = toKey(d);
  const found = holidays.find((h) => toKey(h.date) === key);
  if (!found) return null;
  return locale === "da" ? found.nameDa : found.nameEn;
}

/** Get the holiday code for a date, or null. */
export function getHolidayCode(date: Date | string): string | null {
  const d = parseDate(date);
  const holidays = getDanishHolidays(d.getFullYear());
  const key = toKey(d);
  const found = holidays.find((h) => toKey(h.date) === key);
  return found?.code ?? null;
}

// ── Company-aware helpers ──────────────────────────────────────

export interface CustomHoliday {
  name: string;
  month: number; // 1-12
  day: number;   // 1-31
  year?: number | null; // null = recurring
}

/**
 * Check if a date is a holiday for a specific company.
 * Takes into account disabled Danish holidays and custom company holidays.
 */
export function isCompanyHoliday(
  date: Date | string,
  disabledHolidayCodes: string[] = [],
  customHolidays: CustomHoliday[] = [],
): boolean {
  const d = parseDate(date);
  const key = toKey(d);

  // Check Danish holidays (minus disabled)
  const danishHolidays = getDanishHolidays(d.getFullYear());
  const isDanish = danishHolidays.some(
    (h) => toKey(h.date) === key && !disabledHolidayCodes.includes(h.code),
  );
  if (isDanish) return true;

  // Check custom company holidays
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const year = d.getFullYear();
  return customHolidays.some(
    (ch) => ch.month === month && ch.day === day && (ch.year == null || ch.year === year),
  );
}

/**
 * Get the holiday name for a company-specific holiday check.
 */
export function getCompanyHolidayName(
  date: Date | string,
  locale: "en" | "da" = "en",
  disabledHolidayCodes: string[] = [],
  customHolidays: CustomHoliday[] = [],
): string | null {
  const d = parseDate(date);
  const key = toKey(d);

  // Check Danish holidays first
  const danishHolidays = getDanishHolidays(d.getFullYear());
  const found = danishHolidays.find(
    (h) => toKey(h.date) === key && !disabledHolidayCodes.includes(h.code),
  );
  if (found) return locale === "da" ? found.nameDa : found.nameEn;

  // Check custom holidays
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const year = d.getFullYear();
  const custom = customHolidays.find(
    (ch) => ch.month === month && ch.day === day && (ch.year == null || ch.year === year),
  );
  return custom?.name ?? null;
}

/**
 * Get all holidays (Danish + custom) for a date range, respecting company overrides.
 */
export function getCompanyHolidaysInRange(
  startDate: Date | string,
  endDate: Date | string,
  disabledHolidayCodes: string[] = [],
  customHolidays: CustomHoliday[] = [],
): { date: Date; name: string; code?: string }[] {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const results: { date: Date; name: string; code?: string }[] = [];

  // Collect years in range
  const years: number[] = [];
  for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
    if (!years.includes(y)) years.push(y);
  }

  // Danish holidays
  for (const year of years) {
    for (const h of getDanishHolidays(year)) {
      if (disabledHolidayCodes.includes(h.code)) continue;
      if (h.date >= start && h.date <= end) {
        results.push({ date: h.date, name: h.nameDa, code: h.code });
      }
    }
  }

  // Custom holidays
  for (const ch of customHolidays) {
    if (ch.year != null) {
      // One-time holiday
      const d = new Date(ch.year, ch.month - 1, ch.day);
      d.setHours(0, 0, 0, 0);
      if (d >= start && d <= end) {
        results.push({ date: d, name: ch.name });
      }
    } else {
      // Recurring: check each year in range
      for (const year of years) {
        const d = new Date(year, ch.month - 1, ch.day);
        d.setHours(0, 0, 0, 0);
        if (d >= start && d <= end) {
          results.push({ date: d, name: ch.name });
        }
      }
    }
  }

  return results.sort((a, b) => a.date.getTime() - b.date.getTime());
}
