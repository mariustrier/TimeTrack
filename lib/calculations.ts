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

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatHours(hours: number): string {
  return `${hours.toFixed(1)}h`;
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}
