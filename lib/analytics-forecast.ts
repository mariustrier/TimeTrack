/**
 * Revenue Bridge Forecast
 *
 * Computes future revenue estimates from ResourceAllocations.
 * Confirmed allocations = 100% weight, tentative = 50%.
 */
import {
  startOfMonth,
  endOfMonth,
  addMonths,
  addDays,
  eachDayOfInterval,
  isWeekend,
  format,
} from "date-fns";
import { getToday } from "./demo-date";

export interface ForecastAllocation {
  startDate: Date;
  endDate: Date;
  hoursPerDay: number;
  status: string; // "tentative" | "confirmed" | "completed"
  billRate: number; // resolved bill rate for this allocation
}

export interface RevenueBridgePoint {
  period: string;
  periodKey: string;
  actual: number | null;
  forecast: number | null;
  breakeven: number;
}

function workingDaysInOverlap(start: Date, end: Date): number {
  if (start > end) return 0;
  const days = eachDayOfInterval({ start, end });
  return days.filter((d) => !isWeekend(d)).length;
}

function forecastMonth(allocations: ForecastAllocation[], month: Date): number {
  const mStart = startOfMonth(month);
  const mEnd = endOfMonth(month);
  let total = 0;

  for (const a of allocations) {
    if (a.status === "completed") continue;
    const oStart = a.startDate > mStart ? a.startDate : mStart;
    const oEnd = a.endDate < mEnd ? a.endDate : mEnd;
    const wd = workingDaysInOverlap(oStart, oEnd);
    if (wd === 0) continue;
    const weight = a.status === "confirmed" ? 1.0 : 0.5;
    total += wd * a.hoursPerDay * a.billRate * weight;
  }
  return Math.round(total);
}

export function computeRevenueBridge(
  allocations: ForecastAllocation[],
  monthlyActuals: { periodKey: string; revenue: number }[],
  monthlyBreakeven: number,
  monthsBack = 5,
  monthsForward = 3,
  isDemo?: boolean
): RevenueBridgePoint[] {
  const today = getToday(isDemo);
  const current = startOfMonth(today);
  const points: RevenueBridgePoint[] = [];

  for (let i = monthsBack; i >= 1; i--) {
    const m = addMonths(current, -i);
    const key = format(m, "yyyy-MM");
    const found = monthlyActuals.find((a) => a.periodKey === key);
    points.push({
      period: format(m, "MMM"),
      periodKey: key,
      actual: found?.revenue ?? 0,
      forecast: null,
      breakeven: monthlyBreakeven,
    });
  }

  // Current month: both actual and forecast
  const curKey = format(current, "yyyy-MM");
  const curActual = monthlyActuals.find((a) => a.periodKey === curKey);
  points.push({
    period: format(current, "MMM"),
    periodKey: curKey,
    actual: curActual?.revenue ?? 0,
    forecast: forecastMonth(allocations, current),
    breakeven: monthlyBreakeven,
  });

  for (let i = 1; i <= monthsForward; i++) {
    const m = addMonths(current, i);
    points.push({
      period: format(m, "MMM"),
      periodKey: format(m, "yyyy-MM"),
      actual: null,
      forecast: forecastMonth(allocations, m),
      breakeven: monthlyBreakeven,
    });
  }

  return points;
}

export function compute30DayForecast(allocations: ForecastAllocation[], isDemo?: boolean): number {
  const today = getToday(isDemo);
  const end = addDays(today, 30);
  let total = 0;

  for (const a of allocations) {
    if (a.status === "completed") continue;
    const oStart = a.startDate > today ? a.startDate : today;
    const oEnd = a.endDate < end ? a.endDate : end;
    const wd = workingDaysInOverlap(oStart, oEnd);
    if (wd === 0) continue;
    const weight = a.status === "confirmed" ? 1.0 : 0.5;
    total += wd * a.hoursPerDay * a.billRate * weight;
  }
  return Math.round(total);
}
