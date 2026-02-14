/**
 * Returns a pinned "today" date for the demo deployment.
 * Set NEXT_PUBLIC_DEMO_DATE=2026-02-12 in Vercel env vars for the demo.
 * Production (without the env var) uses the real current date.
 */
export function getToday(): Date {
  if (process.env.NEXT_PUBLIC_DEMO_DATE) {
    return new Date(process.env.NEXT_PUBLIC_DEMO_DATE + "T12:00:00");
  }
  return new Date();
}
