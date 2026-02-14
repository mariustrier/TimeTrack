/**
 * Returns a pinned "today" date for the demo deployment.
 * Edit lib/demo-date-generated.json to change the pinned date.
 * Set {"date":null} for real customers (uses actual current date).
 */
import config from "./demo-date-generated.json";

export function getToday(): Date {
  const pin = config.date;
  if (pin) {
    const [y, m, d] = pin.split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  return new Date();
}
