"use client";

import { useMemo } from "react";
import { format, isWeekend, isSameDay, isSameMonth, startOfMonth, startOfWeek, endOfWeek, getISOWeek } from "date-fns";
import { cn } from "@/lib/utils";
import { useDateLocale, useLocale, useTranslations } from "@/lib/i18n";
import { isToday } from "@/lib/demo-date";
import { getToday } from "@/lib/demo-date";
import { useIsDemo } from "@/lib/company-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { isCompanyHoliday, getCompanyHolidayName, type CustomHoliday } from "@/lib/holidays";
import { getDailyTarget, getEffectiveWeeklyCapacity } from "@/lib/calculations";
import type { ViewMode } from "@/components/resource-planner/ViewControls";

interface Employee {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  imageUrl: string | null;
  weeklyTarget: number;
  isHourly?: boolean;
}

interface Project {
  id: string;
  name: string;
  color: string;
  client: string | null;
}

interface ResourceAllocation {
  id: string;
  userId: string;
  projectId: string;
  startDate: string;
  endDate: string;
  hoursPerDay: number;
  totalHours: number | null;
  status: "tentative" | "confirmed" | "completed";
  notes: string | null;
  user: Employee;
  project: Project;
}

interface TimeEntryForAllocation {
  userId: string;
  projectId: string;
  date: string;
  hours: number;
}

interface VacationPeriod {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  type: string;
  user: { firstName: string | null; lastName: string | null };
}

interface ResourceGridProps {
  employees: Employee[];
  projects: Project[];
  allocations: ResourceAllocation[];
  timeEntries: TimeEntryForAllocation[];
  vacations?: VacationPeriod[];
  disabledHolidayCodes?: string[];
  customHolidays?: CustomHoliday[];
  days: Date[];
  viewMode: ViewMode;
  onCellClick: (employee: Employee, date: Date) => void;
  onAllocationClick: (allocation: ResourceAllocation) => void;
}

interface WeekColumn {
  key: string;
  label: string;
  days: Date[];
  containsToday: boolean;
  month: Date;
}

export function ResourceGrid({
  employees,
  projects,
  allocations,
  timeEntries,
  vacations = [],
  disabledHolidayCodes = [],
  customHolidays = [],
  days,
  viewMode,
  onCellClick,
  onAllocationClick,
}: ResourceGridProps) {
  const dateLocale = useDateLocale();
  const { locale } = useLocale();
  const t = useTranslations("resourcePlanner");
  const tc = useTranslations("common");
  const isDemo = useIsDemo();
  const today = getToday(isDemo);

  const isMonthView = viewMode === "month";

  const getTarget = (date: Date): number => {
    return getDailyTarget(date, 37, disabledHolidayCodes, customHolidays);
  };

  // Group milestones by project
  const allocationsByUser = useMemo(() => {
    const map: Record<string, ResourceAllocation[]> = {};
    allocations.forEach((alloc) => {
      if (!map[alloc.userId]) map[alloc.userId] = [];
      map[alloc.userId].push(alloc);
    });
    return map;
  }, [allocations]);

  // Calculate rollover for allocations with totalHours
  const allocationRollover = useMemo(() => {
    const rolloverMap: Record<string, {
      logged: number;
      remaining: number;
      adjustedPerDay: number;
      remainingDays: number;
    }> = {};

    allocations.forEach((alloc) => {
      if (!alloc.totalHours) return;

      const allocStart = new Date(alloc.startDate);
      const allocEnd = new Date(alloc.endDate);

      let logged = 0;
      timeEntries.forEach((entry) => {
        if (entry.userId === alloc.userId && entry.projectId === alloc.projectId) {
          const entryDate = new Date(entry.date);
          if (entryDate >= allocStart && entryDate <= allocEnd) {
            logged += entry.hours;
          }
        }
      });

      let remainingDays = 0;
      const checkDate = new Date(Math.max(today.getTime(), allocStart.getTime()));
      while (checkDate <= allocEnd) {
        const dayOfWeek = checkDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          remainingDays++;
        }
        checkDate.setDate(checkDate.getDate() + 1);
      }

      const remaining = Math.max(0, alloc.totalHours - logged);
      const adjustedPerDay = remainingDays > 0 ? remaining / remainingDays : 0;

      rolloverMap[alloc.id] = { logged, remaining, adjustedPerDay, remainingDays };
    });

    return rolloverMap;
  }, [allocations, timeEntries, today]);

  // Get initials for avatar
  const getInitials = (employee: Employee) => {
    if (employee.firstName && employee.lastName) {
      return `${employee.firstName[0]}${employee.lastName[0]}`.toUpperCase();
    }
    return employee.email.substring(0, 2).toUpperCase();
  };

  // Get display name
  const getDisplayName = (employee: Employee) => {
    if (employee.firstName && employee.lastName) {
      return `${employee.firstName} ${employee.lastName}`;
    }
    return employee.email.split("@")[0];
  };

  // ──────────────────────────────────────────────
  // MONTH VIEW: Week-level columns
  // ──────────────────────────────────────────────

  // Group days into week columns for month view
  const weekColumns = useMemo((): WeekColumn[] => {
    if (!isMonthView) return [];

    const weeks: WeekColumn[] = [];
    let currentWeekDays: Date[] = [];

    days.forEach((day, i) => {
      currentWeekDays.push(day);
      // End of week (Sunday) or last day
      if (day.getDay() === 0 || i === days.length - 1) {
        const weekStart = currentWeekDays[0];
        weeks.push({
          key: format(weekStart, "yyyy") + "-W" + getISOWeek(weekStart),
          label: "W" + getISOWeek(weekStart),
          days: [...currentWeekDays],
          containsToday: currentWeekDays.some((d) => isToday(d, isDemo)),
          month: startOfMonth(weekStart),
        });
        currentWeekDays = [];
      }
    });

    return weeks;
  }, [days, isMonthView]);

  // Month group headers for month view
  const monthGroupHeaders = useMemo(() => {
    if (!isMonthView) return [];

    const groups: { label: string; colSpan: number }[] = [];
    let currentMonth: Date | null = null;
    let count = 0;

    weekColumns.forEach((col) => {
      if (!currentMonth || !isSameMonth(col.month, currentMonth)) {
        if (currentMonth) {
          groups.push({
            label: format(currentMonth, "MMMM yyyy", { locale: dateLocale }),
            colSpan: count,
          });
        }
        currentMonth = col.month;
        count = 1;
      } else {
        count++;
      }
    });
    if (currentMonth) {
      groups.push({
        label: format(currentMonth, "MMMM yyyy", { locale: dateLocale }),
        colSpan: count,
      });
    }
    return groups;
  }, [weekColumns, isMonthView, dateLocale]);

  // Get allocations for an employee in a week
  const getAllocationsForWeek = (employeeId: string, weekDays: Date[]) => {
    const userAllocations = allocationsByUser[employeeId] || [];
    return userAllocations.filter((alloc) => {
      const start = new Date(alloc.startDate);
      const end = new Date(alloc.endDate);
      return weekDays.some((day) => day >= start && day <= end && !isWeekend(day));
    });
  };

  // Get total allocated hours for an employee in a week
  const getWeekAllocatedHours = (employeeId: string, weekDays: Date[]) => {
    const userAllocations = allocationsByUser[employeeId] || [];
    let total = 0;
    weekDays.forEach((day) => {
      if (isWeekend(day)) return;
      userAllocations.forEach((alloc) => {
        const start = new Date(alloc.startDate);
        const end = new Date(alloc.endDate);
        if (day >= start && day <= end) {
          total += alloc.hoursPerDay;
        }
      });
    });
    return total;
  };

  // Check if employee has vacation in a week
  const getVacationsForWeek = (employeeId: string, weekDays: Date[]) => {
    return vacations.filter((v) => {
      if (v.userId !== employeeId) return false;
      const start = new Date(v.startDate);
      const end = new Date(v.endDate);
      return weekDays.some((day) => day >= start && day <= end);
    });
  };

  // Calculate daily utilization per employee (must be before conditional return)
  const dailyUtilization = useMemo(() => {
    if (isMonthView) return {};
    const map: Record<string, Record<string, number>> = {};

    employees.forEach((emp) => {
      map[emp.id] = {};
      days.forEach((day) => {
        map[emp.id][format(day, "yyyy-MM-dd")] = 0;
      });
    });

    allocations.forEach((alloc) => {
      const start = new Date(alloc.startDate);
      const end = new Date(alloc.endDate);

      days.forEach((day) => {
        if (day >= start && day <= end && !isWeekend(day)) {
          const dateKey = format(day, "yyyy-MM-dd");
          if (map[alloc.userId]?.[dateKey] !== undefined) {
            map[alloc.userId][dateKey] += alloc.hoursPerDay;
          }
        }
      });
    });

    return map;
  }, [employees, allocations, days, isMonthView]);

  if (isMonthView) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse table-fixed">
          <colgroup>
            <col className="w-[200px]" />
          </colgroup>
          <thead>
            <tr>
              <th className="sticky left-0 z-20 bg-card border-b border-r border-border p-3 text-left w-[200px]" rowSpan={2}>
                <span className="text-sm font-medium text-muted-foreground">Team Member</span>
              </th>
              {monthGroupHeaders.map(({ label, colSpan }, idx) => (
                <th
                  key={idx}
                  colSpan={colSpan}
                  className="border-b border-r border-border p-2 text-center bg-muted/30"
                >
                  <span className="text-sm font-semibold">{label}</span>
                </th>
              ))}
            </tr>
            <tr>
              {weekColumns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "border-b border-r border-border p-1 text-center overflow-hidden",
                    col.containsToday && "bg-brand-50 dark:bg-brand-950"
                  )}
                >
                  <span className={cn(
                    "text-xs font-medium",
                    col.containsToday ? "text-brand-600 dark:text-brand-400" : "text-muted-foreground"
                  )}>
                    {col.label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id} className="group">
                <td className="sticky left-0 z-10 bg-card border-b border-r border-border p-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={employee.imageUrl || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(employee)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{getDisplayName(employee)}</p>
                      <p className="text-xs text-muted-foreground">{employee.isHourly ? t("hourly") : `${getEffectiveWeeklyCapacity(employee)}${tc("hourAbbrev")}/week`}</p>
                    </div>
                  </div>
                </td>

                {weekColumns.map((col) => {
                  const weekAllocs = getAllocationsForWeek(employee.id, col.days);
                  const weekVacations = getVacationsForWeek(employee.id, col.days);
                  const totalHours = getWeekAllocatedHours(employee.id, col.days);
                  const weekMonday = col.days.find((d) => d.getDay() === 1) || col.days[0];

                  return (
                    <td
                      key={col.key}
                      className={cn(
                        "border-b border-r border-border p-1 h-[60px] relative cursor-pointer hover:bg-accent/50 transition-colors",
                        col.containsToday && "bg-brand-50/30 dark:bg-brand-950/30"
                      )}
                      onClick={() => {
                        if (weekAllocs.length > 0) {
                          onAllocationClick(weekAllocs[0]);
                        } else {
                          onCellClick(employee, weekMonday);
                        }
                      }}
                    >
                      <div className="flex flex-col gap-0.5 h-full justify-center">
                        {weekVacations.length > 0 && weekAllocs.length === 0 && (
                          <div
                            className="h-3 rounded-sm px-1 flex items-center opacity-80"
                            style={{ backgroundColor: "#8B5CF6" }}
                          >
                            <span className="text-[9px] text-white truncate">
                              {weekVacations[0].type === "sick" ? t("sick") : weekVacations[0].type === "personal" ? t("personal") : t("vacation")}
                            </span>
                          </div>
                        )}
                        {weekAllocs.slice(0, 3).map((alloc) => (
                          <div
                            key={alloc.id}
                            className={cn(
                              "h-3 rounded-sm px-1 flex items-center",
                              alloc.status === "tentative" && "opacity-70 bg-stripes"
                            )}
                            style={{ backgroundColor: alloc.project.color + (alloc.status === "tentative" ? "99" : "CC") }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onAllocationClick(alloc);
                            }}
                          >
                            <span className="text-[9px] text-white truncate drop-shadow-sm">{alloc.project.name}</span>
                          </div>
                        ))}
                        {weekAllocs.length > 3 && (
                          <span className="text-[9px] text-muted-foreground text-center">+{weekAllocs.length - 3}</span>
                        )}
                      </div>
                      {totalHours > 0 && (
                        <div className="absolute bottom-0.5 right-1 text-[10px] text-muted-foreground">
                          {totalHours.toFixed(0)}{tc("hourAbbrev")}
                        </div>
                      )}

                      {/* Today Line */}
                      {col.containsToday && (
                        <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-red-500 z-5" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Legend */}
        <div className="flex items-center gap-6 p-4 border-t border-border text-sm flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-brand-500" />
            <span className="text-muted-foreground">Confirmed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-brand-500/70 bg-stripes" />
            <span className="text-muted-foreground">Tentative</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: "#8B5CF6" }} />
            <span className="text-muted-foreground">{t("vacation")}</span>
          </div>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────
  // DAY VIEW: Week / 2-Week (existing logic)
  // ──────────────────────────────────────────────

  // Check if employee is on vacation on a given day
  const getVacationForCell = (userId: string, date: Date): VacationPeriod | undefined => {
    const dateStr = format(date, "yyyy-MM-dd");
    return vacations.find((v) => {
      if (v.userId !== userId) return false;
      const start = v.startDate.split("T")[0];
      const end = v.endDate.split("T")[0];
      return dateStr >= start && dateStr <= end;
    });
  };

  // Check if this is the first visible day of a vacation
  const isVacationStart = (vacation: VacationPeriod, date: Date): boolean => {
    const vacStart = new Date(vacation.startDate);
    if (isSameDay(vacStart, date)) return true;
    return days[0] && date <= days[0] && isSameDay(date, days[0]);
  };

  // Get vacation span (visible days)
  const getVacationSpan = (vacation: VacationPeriod, fromDate: Date): number => {
    const end = new Date(vacation.endDate);
    let span = 0;
    let current = new Date(fromDate);
    while (current <= end) {
      const idx = days.findIndex((d) => isSameDay(d, current));
      if (idx === -1) break;
      span++;
      current.setDate(current.getDate() + 1);
    }
    return span;
  };

  // Find allocation for a specific cell
  const getFirstAllocationForCell = (employeeId: string, date: Date) => {
    const userAllocations = allocationsByUser[employeeId] || [];
    return userAllocations.find((alloc) => {
      const start = new Date(alloc.startDate);
      const end = new Date(alloc.endDate);
      return date >= start && date <= end;
    });
  };

  // Check if this is the start of an allocation
  const isAllocationStart = (allocation: ResourceAllocation, date: Date) => {
    return isSameDay(new Date(allocation.startDate), date);
  };

  // Calculate allocation span (number of visible days)
  const getAllocationSpan = (allocation: ResourceAllocation, fromDate: Date) => {
    const end = new Date(allocation.endDate);
    let span = 0;
    let current = fromDate;

    while (current <= end) {
      const idx = days.findIndex((d) => isSameDay(d, current));
      if (idx === -1) break;
      span++;
      current = new Date(current);
      current.setDate(current.getDate() + 1);
    }

    return span;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse table-fixed">
        <colgroup>
          <col className="w-[200px]" />
        </colgroup>
        {/* Header */}
        <thead>
          <tr>
            <th className="sticky left-0 z-20 bg-card border-b border-r border-border p-3 text-left w-[200px]">
              <span className="text-sm font-medium text-muted-foreground">Team Member</span>
            </th>
            {days.map((day) => {
              const dailyTarget = getTarget(day);
              const holidayName = getCompanyHolidayName(day, locale as "en" | "da", disabledHolidayCodes, customHolidays);
              return (
                <th
                  key={day.toISOString()}
                  className={cn(
                    "border-b border-r border-border p-2 text-center overflow-hidden",
                    isWeekend(day) && "bg-muted/50",
                    isToday(day, isDemo) && "bg-brand-50 dark:bg-brand-950",
                    holidayName && !isWeekend(day) && "bg-amber-50 dark:bg-amber-950/30"
                  )}
                >
                  <div className="text-xs font-medium text-muted-foreground">
                    {format(day, "EEE", { locale: dateLocale })}
                  </div>
                  <div className={cn(
                    "text-sm font-semibold",
                    isToday(day, isDemo) && "text-brand-600 dark:text-brand-400"
                  )}>
                    {format(day, "d", { locale: dateLocale })}
                  </div>
                  {holidayName ? (
                    <div className="text-[9px] text-amber-600 dark:text-amber-400 truncate" title={holidayName}>
                      {holidayName}
                    </div>
                  ) : !isWeekend(day) ? (
                    <div className="text-[10px] text-muted-foreground">
                      {dailyTarget}{tc("hourAbbrev")}
                    </div>
                  ) : null}
                </th>
              );
            })}
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.id} className="group">
              {/* Employee Info */}
              <td className="sticky left-0 z-10 bg-card border-b border-r border-border p-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={employee.imageUrl || undefined} />
                    <AvatarFallback className="text-xs">
                      {getInitials(employee)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{getDisplayName(employee)}</p>
                    <p className="text-xs text-muted-foreground">{getEffectiveWeeklyCapacity(employee)}{tc("hourAbbrev")}/week</p>
                  </div>
                </div>
              </td>

              {/* Day Cells */}
              {days.map((day, dayIndex) => {
                const dateKey = format(day, "yyyy-MM-dd");
                const hoursAllocated = dailyUtilization[employee.id]?.[dateKey] || 0;
                const targetForDay = getTarget(day);
                const isHoliday = isCompanyHoliday(day, disabledHolidayCodes, customHolidays);
                const isOverbooked = !isWeekend(day) && !isHoliday && hoursAllocated > targetForDay;
                const allocation = getFirstAllocationForCell(employee.id, day);
                const showAllocation = allocation && isAllocationStart(allocation, day);
                const span = showAllocation ? getAllocationSpan(allocation, day) : 0;
                const isPartOfAllocation = allocation && !showAllocation;

                // Vacation check
                const vacation = getVacationForCell(employee.id, day);
                const showVacation = vacation && !allocation && isVacationStart(vacation, day);
                const vacSpan = showVacation ? getVacationSpan(vacation, day) : 0;
                const isPartOfVacation = vacation && !showVacation && !allocation;

                return (
                  <td
                    key={day.toISOString()}
                    className={cn(
                      "border-b border-r border-border p-1 relative h-[60px] transition-colors",
                      isWeekend(day) && "bg-muted/30",
                      isHoliday && !isWeekend(day) && "bg-amber-50/50 dark:bg-amber-950/20",
                      isToday(day, isDemo) && "bg-brand-50/50 dark:bg-brand-950/50",
                      !isWeekend(day) && !isHoliday && !isPartOfAllocation && !isPartOfVacation && "hover:bg-accent cursor-pointer",
                      isOverbooked && "bg-red-50 dark:bg-red-950/30"
                    )}
                    onClick={() => {
                      if (!isWeekend(day) && allocation) {
                        onAllocationClick(allocation);
                      } else if (!isWeekend(day) && !vacation) {
                        onCellClick(employee, day);
                      }
                    }}
                  >
                    {/* Vacation Bar */}
                    {showVacation && (
                      <div
                        className="absolute top-1 left-1 right-1 h-[calc(100%-8px)] rounded-md px-2 py-1 z-[5] flex items-center overflow-hidden opacity-80"
                        style={{
                          backgroundColor: "#8B5CF6",
                          width: `calc(${vacSpan * 100}% + ${(vacSpan - 1) * 8}px)`,
                        }}
                      >
                        <span className="text-xs font-medium text-white truncate drop-shadow-sm">
                          {vacation.type === "sick" ? t("sick") : vacation.type === "personal" ? t("personal") : t("vacation")}
                        </span>
                      </div>
                    )}

                    {/* Allocation Bar */}
                    {showAllocation && (
                      <div
                        className={cn(
                          "absolute top-1 left-1 right-1 h-[calc(100%-8px)] rounded-md px-2 py-1 cursor-pointer z-10",
                          "flex items-center overflow-hidden",
                          allocation.status === "tentative" && "opacity-70",
                          allocation.status === "tentative" && "bg-stripes"
                        )}
                        style={{
                          backgroundColor: allocation.project.color + (allocation.status === "tentative" ? "99" : ""),
                          width: `calc(${span * 100}% + ${(span - 1) * 8}px)`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAllocationClick(allocation);
                        }}
                      >
                        <span className="text-xs font-medium text-white truncate drop-shadow-sm">
                          {allocation.project.name}
                        </span>
                        {allocation.totalHours ? (
                          <span className="text-xs text-white/80 ml-1 shrink-0" title={`${allocationRollover[allocation.id]?.logged.toFixed(1) || 0}${tc("hourAbbrev")} logged, ${allocationRollover[allocation.id]?.remaining.toFixed(1) || 0}${tc("hourAbbrev")} remaining`}>
                            {allocationRollover[allocation.id]?.adjustedPerDay.toFixed(1) || allocation.hoursPerDay}{tc("hourAbbrev")}/d
                          </span>
                        ) : (
                          <span className="text-xs text-white/80 ml-1 shrink-0">
                            {allocation.hoursPerDay}{tc("hourAbbrev")}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Hours indicator for non-weekend non-allocation days */}
                    {!isWeekend(day) && !allocation && !vacation && hoursAllocated > 0 && (
                      <div className="absolute bottom-1 right-1 text-xs text-muted-foreground">
                        {hoursAllocated}{tc("hourAbbrev")}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legend */}
      <div className="flex items-center gap-6 p-4 border-t border-border text-sm flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-brand-500" />
          <span className="text-muted-foreground">Confirmed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-brand-500/70 bg-stripes" />
          <span className="text-muted-foreground">Tentative</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: "#8B5CF6" }} />
          <span className="text-muted-foreground">{t("vacation")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-amber-100 dark:bg-amber-900/30" />
          <span className="text-muted-foreground">{t("holidayLabel")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-100 dark:bg-red-900/30" />
          <span className="text-muted-foreground">Overbooked</span>
        </div>
      </div>
    </div>
  );
}
