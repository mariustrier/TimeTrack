export function calculateRevenue(hours: number, hourlyRate: number): number {
  return hours * hourlyRate;
}

export function calculateCost(hours: number, costRate: number): number {
  return hours * costRate;
}

export function calculateProfit(revenue: number, cost: number): number {
  return revenue - cost;
}

export function calculateUtilization(
  actualHours: number,
  targetHours: number
): number {
  if (targetHours === 0) return 0;
  return (actualHours / targetHours) * 100;
}

export function calculateWeeklyTarget(weeklyHours: number): number {
  return weeklyHours;
}

export function calculateTimeBalance(
  actualHours: number,
  targetHours: number
): number {
  return actualHours - targetHours;
}

const CURRENCY_LOCALE: Record<string, string> = {
  USD: "en-US",
  EUR: "de-DE",
  DKK: "da-DK",
};

export function formatCurrency(amount: number, currency = "USD"): string {
  const locale = CURRENCY_LOCALE[currency] || "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatHours(hours: number): string {
  return `${hours.toFixed(1)}h`;
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}
