import { startOfWeek, endOfWeek, format } from "date-fns";

export function getWeekBounds(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return {
    weekStart: startOfWeek(d, { weekStartsOn: 1 }),
    weekEnd: endOfWeek(d, { weekStartsOn: 1 }),
  };
}

export function getWeekId(date: Date | string): string {
  const { weekStart } = getWeekBounds(date);
  return format(weekStart, "yyyy-MM-dd");
}
