/**
 * Returns a pinned "today" date for demo companies, or the real date for
 * real companies.  Pass `isDemo = true` to get the pinned date.
 * Edit lib/demo-date-generated.json to change the pinned date.
 */
import config from "./demo-date-generated.json";

export function getToday(isDemo?: boolean): Date {
  if (isDemo) {
    const pin = config.date;
    if (pin) {
      const [y, m, d] = pin.split("-").map(Number);
      return new Date(y, m - 1, d, 12, 0, 0);
    }
  }
  return new Date();
}

/** Drop-in replacement for date-fns isToday() that respects the demo pin */
export function isToday(date: Date, isDemo?: boolean): boolean {
  const today = getToday(isDemo);
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}
