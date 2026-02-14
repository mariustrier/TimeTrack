/**
 * Returns a pinned "today" date for the demo deployment.
 * Set NEXT_PUBLIC_DEMO_DATE=2026-02-12 in Vercel env vars for the demo.
 * NEXT_PUBLIC_ prefix makes it available in both server and client components.
 * Production (without the env var) uses the real current date.
 */
export function getToday(): Date {
  const pin = process.env.NEXT_PUBLIC_DEMO_DATE;
  if (pin) {
    const [y, m, d] = pin.split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  return new Date();
}
