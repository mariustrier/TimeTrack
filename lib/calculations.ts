import { isCompanyHoliday, isDanishHoliday, type CustomHoliday } from "./holidays";

/** Danish standard full-time work week (hours). Used as fallback for employees without a weeklyTarget. */
export const DEFAULT_WEEKLY_CAPACITY = 37;

/** Returns effective weekly capacity: the employee's weeklyTarget if set and positive, otherwise 37h. */
export function getEffectiveWeeklyCapacity(user: { weeklyTarget?: number | null }): number {
  return (user.weeklyTarget && user.weeklyTarget > 0)
    ? user.weeklyTarget
    : DEFAULT_WEEKLY_CAPACITY;
}

/**
 * Returns the expected working hours for a given date.
 * Returns 0 for weekends and holidays, otherwise Mon-Thu or Friday target.
 *
 * If companyHoliday params are provided, uses company-specific holiday check.
 * Otherwise falls back to standard Danish holidays.
 */
export function getDailyTarget(
  date: Date,
  weeklyTarget = 37,
  disabledHolidayCodes?: string[],
  customHolidays?: CustomHoliday[],
): number {
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return 0; // Weekend

  // Holiday check
  if (disabledHolidayCodes !== undefined) {
    if (isCompanyHoliday(date, disabledHolidayCodes, customHolidays || [])) return 0;
  } else {
    if (isDanishHoliday(date)) return 0;
  }

  const monThuTarget = Math.round((weeklyTarget / 5) * 2) / 2;
  const friTarget = weeklyTarget - monThuTarget * 4;
  return dayOfWeek === 5 ? friTarget : monThuTarget;
}

export function calculateRevenue(hours: number, hourlyRate: number): number {
  return hours * hourlyRate;
}

export function calculateCost(hours: number, costRate: number): number {
  return hours * costRate;
}

export function calculateProfit(revenue: number, cost: number): number {
  return revenue - cost;
}

export function calculateUtilization(
  actualHours: number,
  targetHours: number
): number {
  if (targetHours === 0) return 0;
  return (actualHours / targetHours) * 100;
}

export function calculateWeeklyTarget(weeklyHours: number): number {
  return weeklyHours;
}

export function calculateTimeBalance(
  actualHours: number,
  targetHours: number
): number {
  return actualHours - targetHours;
}

const CURRENCY_LOCALE: Record<string, string> = {
  USD: "en-US",
  EUR: "de-DE",
  DKK: "da-DK",
  GBP: "en-GB",
  SEK: "sv-SE",
  NOK: "nb-NO",
};

export function formatCurrency(amount: number, currency = "USD"): string {
  const locale = CURRENCY_LOCALE[currency] || "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatHours(hours: number, suffix = "h"): string {
  return `${hours.toFixed(1)}${suffix}`;
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatFixedBudget(amount: number, currency = "USD"): string {
  const locale = CURRENCY_LOCALE[currency] || "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount);
}
