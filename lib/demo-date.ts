/**
 * Returns a pinned "today" date for demo companies, or the real date for
 * real companies.  Pass `isDemo = true` to get the pinned date.
 * Edit lib/demo-date-generated.json to change the pinned date.
 */
import config from "./demo-date-generated.json";

const DEMO_DATE = config?.date ?? "2026-02-12";

export function getToday(isDemo?: boolean): Date {
  console.log("[getToday] isDemo:", isDemo, "config:", config, "DEMO_DATE:", DEMO_DATE);
  if (isDemo && DEMO_DATE) {
    const [y, m, d] = DEMO_DATE.split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
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
