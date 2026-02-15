"use client";

import { useState, useEffect, useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  addMonths,
  subMonths,
  isSameMonth,
  isWeekend,
} from "date-fns";
import { isToday } from "@/lib/demo-date";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslations, useDateLocale, useLocale } from "@/lib/i18n";
import { isCompanyHoliday, getCompanyHolidayName, type CustomHoliday } from "@/lib/holidays";
import { getToday } from "@/lib/demo-date";
import { useIsDemo } from "@/lib/company-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface VacationRequest {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  type: string;
  status: string;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    imageUrl: string | null;
  };
}

const TYPE_COLORS: Record<string, string> = {
  vacation: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  sick: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  personal: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

export function VacationCalendar() {
  const t = useTranslations("vacations");
  const tc = useTranslations("common");
  const dateLocale = useDateLocale();
  const { locale } = useLocale();
  const formatOpts = { locale: dateLocale };
  const isDemo = useIsDemo();

  const [currentMonth, setCurrentMonth] = useState(() => getToday(isDemo));
  const [vacations, setVacations] = useState<VacationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [disabledHolidayCodes, setDisabledHolidayCodes] = useState<string[]>([]);
  const [customHolidays, setCustomHolidays] = useState<CustomHoliday[]>([]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Group days into weeks
  const weeks = useMemo(() => {
    const result: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      result.push(calendarDays.slice(i, i + 7));
    }
    return result;
  }, [calendarDays]);

  useEffect(() => {
    setLoading(true);
    const start = format(calendarStart, "yyyy-MM-dd");
    const end = format(calendarEnd, "yyyy-MM-dd");

    Promise.all([
      fetch(`/api/vacations?status=approved&startDate=${start}&endDate=${end}`).then((r) =>
        r.ok ? r.json() : [],
      ),
      fetch("/api/admin/holidays").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([vacs, holidays]) => {
        setVacations(vacs);
        if (holidays) {
          setDisabledHolidayCodes(holidays.disabledHolidays ?? []);
          setCustomHolidays(
            (holidays.customHolidays ?? []).map(
              (ch: { name: string; month: number; day: number; year?: number | null }) => ({
                name: ch.name,
                month: ch.month,
                day: ch.day,
                year: ch.year,
              }),
            ),
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentMonth]);

  // Get vacations for a specific day
  function getVacationsForDay(day: Date): VacationRequest[] {
    const dayStr = format(day, "yyyy-MM-dd");
    return vacations.filter((v) => {
      const start = v.startDate.split("T")[0];
      const end = v.endDate.split("T")[0];
      return dayStr >= start && dayStr <= end;
    });
  }

  function getUserInitials(user: VacationRequest["user"]): string {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user.email[0].toUpperCase();
  }

  function getUserName(user: VacationRequest["user"]): string {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.email;
  }

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          {format(currentMonth, "MMMM yyyy", formatOpts)}
        </h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth(getToday(isDemo))}>
            {tc("today")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-blue-200 dark:bg-blue-800" />
          <span className="text-muted-foreground">{t("typeVacation")}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-red-200 dark:bg-red-800" />
          <span className="text-muted-foreground">{t("typeSick")}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-purple-200 dark:bg-purple-800" />
          <span className="text-muted-foreground">{t("typePersonal")}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-amber-200 dark:bg-amber-800" />
          <span className="text-muted-foreground">{tc("holiday")}</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <TooltipProvider>
        <div className="rounded-lg border overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b bg-muted/50">
            {dayNames.map((day) => (
              <div key={day} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">
                {day}
              </div>
            ))}
          </div>

          {/* Weeks */}
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b last:border-b-0">
              {week.map((day) => {
                const dayVacations = getVacationsForDay(day);
                const holidayName = getCompanyHolidayName(
                  day,
                  locale as "en" | "da",
                  disabledHolidayCodes,
                  customHolidays,
                );
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isWknd = isWeekend(day);
                const maxVisible = 3;
                const overflow = dayVacations.length - maxVisible;

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "min-h-[80px] border-r last:border-r-0 p-1",
                      !isCurrentMonth && "bg-muted/30",
                      isWknd && "bg-muted/20",
                      isToday(day) && "bg-brand-50/50 dark:bg-brand-950/20",
                      holidayName && "bg-amber-50/50 dark:bg-amber-950/20",
                    )}
                  >
                    {/* Date number */}
                    <div className="flex items-center justify-between px-1">
                      <span
                        className={cn(
                          "text-xs font-medium",
                          !isCurrentMonth && "text-muted-foreground/50",
                          isToday(day) && "text-brand-600 font-bold",
                          isWknd && !isToday(day) && "text-muted-foreground",
                        )}
                      >
                        {format(day, "d")}
                      </span>
                    </div>

                    {/* Holiday badge */}
                    {holidayName && (
                      <div className="px-1 mt-0.5">
                        <div className="text-[9px] leading-tight text-amber-600 dark:text-amber-400 truncate" title={holidayName}>
                          {holidayName}
                        </div>
                      </div>
                    )}

                    {/* Vacation entries */}
                    <div className="mt-0.5 space-y-0.5">
                      {dayVacations.slice(0, maxVisible).map((vac) => (
                        <Tooltip key={vac.id}>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "flex items-center gap-1 rounded px-1 py-0.5 text-[10px] leading-tight truncate cursor-default",
                                TYPE_COLORS[vac.type] || TYPE_COLORS.vacation,
                              )}
                            >
                              <Avatar className="h-3.5 w-3.5">
                                <AvatarImage src={vac.user.imageUrl || undefined} />
                                <AvatarFallback className="text-[7px]">
                                  {getUserInitials(vac.user)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="truncate">{getUserName(vac.user)}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-medium">{getUserName(vac.user)}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(vac.startDate), "MMM d", formatOpts)} -{" "}
                              {format(new Date(vac.endDate), "MMM d", formatOpts)}
                            </p>
                            <p className="text-xs capitalize">{vac.type}</p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                      {overflow > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="text-[10px] text-muted-foreground px-1 cursor-default">
                              +{overflow} {t("more")}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {dayVacations.slice(maxVisible).map((vac) => (
                              <p key={vac.id} className="text-xs">
                                {getUserName(vac.user)} ({vac.type})
                              </p>
                            ))}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </TooltipProvider>

      {loading && (
        <div className="text-center text-sm text-muted-foreground py-4">
          {tc("loading")}
        </div>
      )}
    </div>
  );
}
