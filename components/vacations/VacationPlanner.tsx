"use client";

import { useMemo } from "react";
import { differenceInBusinessDays, startOfMonth, endOfMonth, format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTranslations, useDateLocale } from "@/lib/i18n";
import { getToday } from "@/lib/demo-date";
import { useIsDemo } from "@/lib/company-context";

const MONTHLY_ACCRUAL = 2.08;

interface VacationRequest {
  id: string;
  startDate: string;
  endDate: string;
  type: string;
  status: string;
}

interface VacationPlannerProps {
  requests: VacationRequest[];
  bonusDays: number;
  isHourly?: boolean;
  vacationTrackingUnit?: string;
  vacationHoursPerYear?: number | null;
  weeklyTarget?: number;
}

function countBusinessDaysInRange(start: Date, end: Date): number {
  if (end < start) return 0;
  const days = differenceInBusinessDays(end, start) + 1;
  return Math.max(days, 0);
}

/** Count approved vacation business days that fall within a given month */
function getUsedDaysInMonth(requests: VacationRequest[], year: number, month: number): number {
  const monthStart = startOfMonth(new Date(year, month));
  const monthEnd = endOfMonth(new Date(year, month));

  return requests
    .filter((r) => r.status === "approved")
    .reduce((sum, r) => {
      const reqStart = new Date(r.startDate);
      const reqEnd = new Date(r.endDate);
      // Clamp to month boundaries
      const overlapStart = reqStart > monthStart ? reqStart : monthStart;
      const overlapEnd = reqEnd < monthEnd ? reqEnd : monthEnd;
      if (overlapStart > overlapEnd) return sum;
      return sum + countBusinessDaysInRange(overlapStart, overlapEnd);
    }, 0);
}

export function VacationPlanner({ requests, bonusDays, isHourly, vacationTrackingUnit, vacationHoursPerYear, weeklyTarget }: VacationPlannerProps) {
  const t = useTranslations("vacations");
  const dateLocale = useDateLocale();
  const isDemo = useIsDemo();

  const currentYear = getToday(isDemo).getFullYear();
  const currentMonth = getToday(isDemo).getMonth(); // 0-indexed
  const isHoursMode = vacationTrackingUnit === "hours";
  const dailyTarget = (weeklyTarget ?? 37) / 5;
  const monthlyHoursAccrual = isHoursMode ? (vacationHoursPerYear ?? 0) / 12 : 0;

  const months = useMemo(() => {
    let cumulativeUsed = 0;
    return Array.from({ length: 12 }, (_, i) => {
      const usedDaysThisMonth = getUsedDaysInMonth(requests, currentYear, i);

      if (isHoursMode) {
        const earned = Math.round(monthlyHoursAccrual * (i + 1) * 100) / 100;
        const usedHoursThisMonth = Math.round(usedDaysThisMonth * dailyTarget * 100) / 100;
        cumulativeUsed += usedHoursThisMonth;
        const balance = Math.round((earned + bonusDays - cumulativeUsed) * 100) / 100;
        return {
          month: i,
          label: format(new Date(currentYear, i, 1), "MMM", dateLocale ? { locale: dateLocale } : undefined),
          earned,
          usedThisMonth: usedHoursThisMonth,
          cumulativeUsed,
          balance,
        };
      }

      const earned = Math.round(MONTHLY_ACCRUAL * (i + 1) * 100) / 100;
      cumulativeUsed += usedDaysThisMonth;
      const balance = Math.round((earned + bonusDays - cumulativeUsed) * 100) / 100;
      return {
        month: i,
        label: format(new Date(currentYear, i, 1), "MMM", dateLocale ? { locale: dateLocale } : undefined),
        earned,
        usedThisMonth: usedDaysThisMonth,
        cumulativeUsed,
        balance,
      };
    });
  }, [requests, bonusDays, currentYear, dateLocale, isHoursMode, monthlyHoursAccrual, dailyTarget]);

  if (isHourly) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/30 p-8 text-center">
        <p className="text-sm text-muted-foreground">{t("hourlyNoAccrual")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">{currentYear}</h3>
        {bonusDays > 0 && (
          <span className="text-sm text-muted-foreground">
            +{bonusDays} {isHoursMode ? t("extraHours") : t("extraDays")}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {months.map((m) => {
          const isCurrent = m.month === currentMonth;
          const isPast = m.month < currentMonth;
          const isNegative = m.balance < 0;

          return (
            <Card
              key={m.month}
              className={cn(
                "transition-colors",
                isCurrent && "ring-2 ring-brand-500",
                !isCurrent && !isPast && "opacity-70"
              )}
            >
              <CardContent className="p-3">
                <p className={cn(
                  "text-xs font-semibold uppercase tracking-wide",
                  isCurrent ? "text-brand-600 dark:text-brand-400" : "text-muted-foreground"
                )}>
                  {m.label}
                </p>
                <p className={cn(
                  "mt-1 text-xl font-bold",
                  isNegative
                    ? "text-red-600 dark:text-red-400"
                    : "text-emerald-600 dark:text-emerald-400"
                )}>
                  {m.balance.toFixed(1)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {isHoursMode ? t("hoursUnit") : t("days")}
                </p>
                <div className="mt-2 space-y-0.5 text-[10px] text-muted-foreground">
                  <div className="flex justify-between">
                    <span>{t("earned")}</span>
                    <span>{m.earned.toFixed(1)}</span>
                  </div>
                  {m.usedThisMonth > 0 && (
                    <div className="flex justify-between text-amber-600 dark:text-amber-400">
                      <span>{t("used")}</span>
                      <span>-{m.usedThisMonth}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
