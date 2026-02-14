/**
 * Returns a pinned "today" date for the demo deployment.
 * Hardcoded to 2026-02-12 to match demo seed data.
 * To use the real date instead, set NEXT_PUBLIC_DEMO_DATE=none in env vars.
 */
const DEMO_PIN = "2026-02-12";

export function getToday(): Date {
  const env = process.env.NEXT_PUBLIC_DEMO_DATE;
  const pin = env === "none" ? null : env || DEMO_PIN;
  if (pin) {
    const [y, m, d] = pin.split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  return new Date();
}
