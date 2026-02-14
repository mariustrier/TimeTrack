/**
 * Returns a pinned "today" date for the demo deployment.
 * Set NEXT_PUBLIC_DEMO_DATE=2026-02-12 in Vercel env vars for the demo.
 * next.config.js maps it to DEMO_DATE_PIN which gets inlined at build time.
 * Production (without the env var) uses the real current date.
 */
export function getToday(): Date {
  const pin = process.env.DEMO_DATE_PIN;
  if (pin) {
    const [y, m, d] = pin.split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  return new Date();
}
