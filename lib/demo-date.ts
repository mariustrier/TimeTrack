/**
 * Returns a pinned "today" date for the demo deployment.
 * Set NEXT_PUBLIC_DEMO_DATE=2026-02-12 in Vercel env vars for the demo.
 * Remove the env var (or set to "none") for real customers.
 *
 * The date is written to demo-date-generated.json by next.config.js at build time,
 * then imported here so it's baked into the client bundle reliably.
 */
import config from "./demo-date-generated.json";

export function getToday(): Date {
  const pin = config.date;
  if (pin && pin !== "none") {
    const [y, m, d] = pin.split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  return new Date();
}
