/**
 * Returns a pinned "today" date for the demo.
 * Hardcoded to Feb 12, 2026 to keep the demo data consistent.
 * Change DEMO_DATE to null to use the real current date.
 */
const DEMO_DATE = "2026-02-12";

export function getToday(): Date {
  if (DEMO_DATE) {
    return new Date(2026, 1, 12, 12, 0, 0);
  }
  return new Date();
}
