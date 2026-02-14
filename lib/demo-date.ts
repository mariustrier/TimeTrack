/**
 * Returns a pinned "today" date for the demo environment.
 * Set NEXT_PUBLIC_DEMO_DATE=2026-02-12 in Vercel env vars to pin the demo.
 * When unset, returns the real current date.
 */
export function getToday(): Date {
  const demo = process.env.NEXT_PUBLIC_DEMO_DATE;
  if (demo) {
    const d = new Date(demo + "T12:00:00");
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}
