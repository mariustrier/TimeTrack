"use client";

import { useMemo, useRef, useCallback, useEffect } from "react";
import { format, isWeekend, isToday, isSameMonth, startOfMonth, getISOWeek } from "date-fns";
import { cn } from "@/lib/utils";
import { useDateLocale, useLocale, useTranslations } from "@/lib/i18n";
import { getCompanyHolidayName, isCompanyHoliday, type CustomHoliday } from "@/lib/holidays";
import { getDailyTarget, getEffectiveWeeklyCapacity } from "@/lib/calculations";
import { PlannerRow } from "./PlannerRow";
import { TotalRow } from "./TotalRow";

type ViewMode = "week" | "twoWeeks" | "month";

interface Employee {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  imageUrl: string | null;
  weeklyTarget: number;
  isHourly?: boolean;
  employmentType?: string;
}

interface Project {
  id: string;
  name: string;
  color: string;
  client: string | null;
}

interface Allocation {
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

interface Vacation {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  type: string;
}

interface PlannerGridProps {
  employees: Employee[];
  allocations: Allocation[];
  vacations: Vacation[];
  days: Date[];
  viewMode: ViewMode;
  disabledHolidayCodes: string[];
  customHolidays: CustomHoliday[];
  onEmptyCellClick: (employeeId: string, date: Date, rect: DOMRect) => void;
  onAllocationClick: (allocation: Allocation, date: Date, rect: DOMRect) => void;
  onAllocationDelete: (allocationId: string, date?: string) => void;
  onAllocationDrop?: (employeeId: string, data: { allocationId: string; sourceDate: string; isMultiDay: boolean; shiftKey: boolean }, targetDate: string) => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelection?: (allocationId: string) => void;
  onAddToSelection?: (allocationIds: string[]) => void;
}

interface WeekColumn {
  key: string;
  label: string;
  days: Date[];
  containsToday: boolean;
  month: Date;
}

export function PlannerGrid({
  employees,
  allocations,
  vacations,
  days,
  viewMode,
  disabledHolidayCodes,
  customHolidays,
  onEmptyCellClick,
  onAllocationClick,
  onAllocationDelete,
  onAllocationDrop,
  selectionMode,
  selectedIds,
  onToggleSelection,
  onAddToSelection,
}: PlannerGridProps) {
  const dateLocale = useDateLocale();
  const { locale } = useLocale();
  const t = useTranslations("resourcePlanner");
  const tc = useTranslations("common");
  const isMonthView = viewMode === "month";

  // ── Drag-to-select state ──
  const isDragSelecting = useRef(false);

  const handleDragSelectStart = useCallback(
    (allocationIds: string[]) => {
      if (!selectionMode || !onAddToSelection) return;
      isDragSelecting.current = true;
      onAddToSelection(allocationIds);
    },
    [selectionMode, onAddToSelection]
  );

  const handleDragSelectEnter = useCallback(
    (allocationIds: string[]) => {
      if (!isDragSelecting.current || !onAddToSelection) return;
      onAddToSelection(allocationIds);
    },
    [onAddToSelection]
  );

  useEffect(() => {
    if (!selectionMode) return;
    const handleMouseUp = () => {
      isDragSelecting.current = false;
    };
    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, [selectionMode]);

  // ── Month View: group days into week columns ──
  const weekColumns = useMemo((): WeekColumn[] => {
    if (!isMonthView) return [];
    const weeks: WeekColumn[] = [];
    let currentWeekDays: Date[] = [];
    days.forEach((day, i) => {
      currentWeekDays.push(day);
      if (day.getDay() === 0 || i === days.length - 1) {
        const weekStart = currentWeekDays[0];
        weeks.push({
          key: format(weekStart, "yyyy") + "-W" + getISOWeek(weekStart),
          label: "W" + getISOWeek(weekStart),
          days: [...currentWeekDays],
          containsToday: currentWeekDays.some((d) => isToday(d)),
          month: startOfMonth(weekStart),
        });
        currentWeekDays = [];
      }
    });
    return weeks;
  }, [days, isMonthView]);

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
        label: format(currentMonth!, "MMMM yyyy", { locale: dateLocale }),
        colSpan: count,
      });
    }
    return groups;
  }, [weekColumns, isMonthView, dateLocale]);

  // ── Calculate totals across all employees ──
  const { totalAllocated, totalCapacity } = useMemo(() => {
    let alloc = 0;
    let cap = 0;
    employees.forEach((emp) => {
      const empCap = getEffectiveWeeklyCapacity(emp);
      const empAllocations = allocations.filter((a) => a.userId === emp.id);
      days.forEach((day) => {
        if (isWeekend(day)) return;
        if (isCompanyHoliday(day, disabledHolidayCodes, customHolidays)) return;
        cap += getDailyTarget(day, empCap, disabledHolidayCodes, customHolidays);
        const dateStr = format(day, "yyyy-MM-dd");
        empAllocations.forEach((a) => {
          const start = a.startDate.split("T")[0];
          const end = a.endDate.split("T")[0];
          if (dateStr >= start && dateStr <= end) {
            alloc += a.hoursPerDay;
          }
        });
      });
    });
    return { totalAllocated: alloc, totalCapacity: cap };
  }, [employees, allocations, days, disabledHolidayCodes, customHolidays]);

  // ── Month View rendering ──
  if (isMonthView) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse table-fixed">
          <colgroup>
            <col className="w-[180px]" />
          </colgroup>
          <thead>
            <tr>
              <th
                className="sticky left-0 z-20 bg-card border-b border-r border-border p-2 text-left"
                rowSpan={2}
              >
                <span className="text-xs font-medium text-muted-foreground">
                  {t("employee") || "Employee"}
                </span>
              </th>
              {monthGroupHeaders.map(({ label, colSpan }, idx) => (
                <th
                  key={idx}
                  colSpan={colSpan}
                  className="border-b border-r border-border p-1 text-center bg-muted/30"
                >
                  <span className="text-xs font-semibold">{label}</span>
                </th>
              ))}
              <th
                className="sticky right-0 z-20 bg-card border-b border-l border-border p-1 text-center"
                rowSpan={2}
              >
                <span className="text-[10px] font-medium text-muted-foreground">
                  {t("utilization") || "Utilization"}
                </span>
              </th>
            </tr>
            <tr>
              {weekColumns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "border-b border-r border-border p-1 text-center",
                    col.containsToday && "bg-brand-50 dark:bg-brand-950"
                  )}
                >
                  <span
                    className={cn(
                      "text-[10px] font-medium",
                      col.containsToday
                        ? "text-brand-600 dark:text-brand-400"
                        : "text-muted-foreground"
                    )}
                  >
                    {col.label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => {
              const empAllocations = allocations.filter((a) => a.userId === employee.id);
              const empVacations = vacations.filter((v) => v.userId === employee.id);

              return (
                <MonthRow
                  key={employee.id}
                  employee={employee}
                  weekColumns={weekColumns}
                  allocations={empAllocations}
                  vacations={empVacations}
                  disabledHolidayCodes={disabledHolidayCodes}
                  customHolidays={customHolidays}
                  days={days}
                  onAllocationClick={onAllocationClick}
                  onEmptyCellClick={onEmptyCellClick}
                  t={t}
                  selectionMode={selectionMode}
                  selectedIds={selectedIds}
                  onToggleSelection={onToggleSelection}
                  onDragSelectStart={handleDragSelectStart}
                  onDragSelectEnter={handleDragSelectEnter}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // ── Day View (Week / 2-Week) ──
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse table-fixed">
        <colgroup>
          <col className="w-[180px]" />
          {days.map((d) => (
            <col key={d.toISOString()} className="min-w-[100px]" />
          ))}
          <col className="w-[90px]" />
        </colgroup>
        <thead>
          <tr>
            <th className="sticky left-0 z-20 bg-card border-b border-r border-border p-2 text-left">
              <span className="text-xs font-medium text-muted-foreground">
                {t("employee") || "Employee"}
              </span>
            </th>
            {days.map((day) => {
              const weekend = isWeekend(day);
              const holidayName = getCompanyHolidayName(
                day,
                locale as "en" | "da",
                disabledHolidayCodes,
                customHolidays
              );
              const target = getDailyTarget(day, 37, disabledHolidayCodes, customHolidays);

              return (
                <th
                  key={day.toISOString()}
                  className={cn(
                    "border-b border-r border-border p-1 text-center",
                    weekend && "bg-muted/50",
                    isToday(day) && "bg-brand-50 dark:bg-brand-950",
                    holidayName && !weekend && "bg-amber-50 dark:bg-amber-950/30"
                  )}
                >
                  <div className="text-[10px] font-medium text-muted-foreground">
                    {format(day, "EEE", { locale: dateLocale })}
                  </div>
                  <div
                    className={cn(
                      "text-sm font-semibold",
                      isToday(day) && "text-brand-600 dark:text-brand-400"
                    )}
                  >
                    {format(day, "d", { locale: dateLocale })}
                  </div>
                  {holidayName ? (
                    <div
                      className="text-[8px] text-amber-600 dark:text-amber-400 truncate"
                      title={holidayName}
                    >
                      {holidayName}
                    </div>
                  ) : !weekend ? (
                    <div className="text-[9px] text-muted-foreground">{target}{tc("hourAbbrev")}</div>
                  ) : null}
                </th>
              );
            })}
            <th className="sticky right-0 z-20 bg-card border-b border-l border-border p-1 text-center">
              <span className="text-[10px] font-medium text-muted-foreground">
                {t("utilization") || "Utilization"}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => {
            const empAllocations = allocations.filter((a) => a.userId === employee.id);
            const empVacations = vacations.filter((v) => v.userId === employee.id);

            return (
              <PlannerRow
                key={employee.id}
                employee={employee}
                days={days}
                allocations={empAllocations}
                vacations={empVacations}
                disabledHolidayCodes={disabledHolidayCodes}
                customHolidays={customHolidays}
                onEmptyCellClick={onEmptyCellClick}
                onAllocationClick={onAllocationClick}
                onAllocationDelete={onAllocationDelete}
                onAllocationDrop={onAllocationDrop}
                selectionMode={selectionMode}
                selectedIds={selectedIds}
                onToggleSelection={onToggleSelection}
                onDragSelectStart={handleDragSelectStart}
                onDragSelectEnter={handleDragSelectEnter}
              />
            );
          })}
          <TotalRow
            days={days}
            allocations={allocations}
            totalCapacity={totalCapacity}
            totalAllocated={totalAllocated}
            disabledHolidayCodes={disabledHolidayCodes}
            customHolidays={customHolidays}
          />
        </tbody>
      </table>
    </div>
  );
}

// ── Month Row (inline, specific to month view) ──

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CapacityColumn } from "./CapacityColumn";

function MonthRow({
  employee,
  weekColumns,
  allocations,
  vacations,
  disabledHolidayCodes,
  customHolidays,
  days,
  onAllocationClick,
  onEmptyCellClick,
  t,
  selectionMode,
  selectedIds,
  onToggleSelection,
  onDragSelectStart,
  onDragSelectEnter,
}: {
  employee: Employee;
  weekColumns: WeekColumn[];
  allocations: Allocation[];
  vacations: Vacation[];
  disabledHolidayCodes: string[];
  customHolidays: CustomHoliday[];
  days: Date[];
  onAllocationClick: (allocation: Allocation, date: Date, rect: DOMRect) => void;
  onEmptyCellClick: (employeeId: string, date: Date, rect: DOMRect) => void;
  t: (key: string) => string;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelection?: (allocationId: string) => void;
  onDragSelectStart?: (allocationIds: string[]) => void;
  onDragSelectEnter?: (allocationIds: string[]) => void;
}) {
  const tc = useTranslations("common");
  const effectiveCap = getEffectiveWeeklyCapacity(employee);

  const getInitials = () => {
    if (employee.firstName && employee.lastName) {
      return `${employee.firstName[0]}${employee.lastName[0]}`.toUpperCase();
    }
    return employee.email.substring(0, 2).toUpperCase();
  };

  const getDisplayName = () => {
    if (employee.firstName && employee.lastName) {
      return `${employee.firstName} ${employee.lastName}`;
    }
    return employee.email.split("@")[0];
  };

  const getSubtitle = () => {
    if (employee.employmentType === "freelancer") return "Freelancer";
    if (employee.isHourly) return t("hourly") || "Hourly";
    return `${effectiveCap}${tc("hourAbbrev")}/${t("viewWeek") || "week"}`;
  };

  // Calculate capacity totals
  let totalAllocated = 0;
  let totalCapacity = 0;
  days.forEach((day) => {
    if (isWeekend(day)) return;
    if (isCompanyHoliday(day, disabledHolidayCodes, customHolidays)) return;
    totalCapacity += getDailyTarget(day, effectiveCap, disabledHolidayCodes, customHolidays);
    const dateStr = format(day, "yyyy-MM-dd");
    allocations.forEach((a) => {
      const start = a.startDate.split("T")[0];
      const end = a.endDate.split("T")[0];
      if (dateStr >= start && dateStr <= end) {
        totalAllocated += a.hoursPerDay;
      }
    });
  });

  return (
    <tr className="group">
      <td className="sticky left-0 z-10 bg-card border-b border-r border-border p-2">
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarImage src={employee.imageUrl || undefined} />
            <AvatarFallback className="text-[10px]">{getInitials()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate leading-tight">{getDisplayName()}</p>
            <p className="text-[11px] text-muted-foreground leading-tight">{getSubtitle()}</p>
          </div>
        </div>
      </td>

      {weekColumns.map((col) => {
        const weekAllocs = allocations.filter((a) => {
          const start = a.startDate.split("T")[0];
          const end = a.endDate.split("T")[0];
          return col.days.some((d) => {
            const ds = format(d, "yyyy-MM-dd");
            return ds >= start && ds <= end && !isWeekend(d);
          });
        });

        const weekVacations = vacations.filter((v) => {
          const start = v.startDate.split("T")[0];
          const end = v.endDate.split("T")[0];
          return col.days.some((d) => {
            const ds = format(d, "yyyy-MM-dd");
            return ds >= start && ds <= end;
          });
        });

        let totalHours = 0;
        col.days.forEach((d) => {
          if (isWeekend(d)) return;
          const ds = format(d, "yyyy-MM-dd");
          allocations.forEach((a) => {
            const start = a.startDate.split("T")[0];
            const end = a.endDate.split("T")[0];
            if (ds >= start && ds <= end) totalHours += a.hoursPerDay;
          });
        });

        const weekMonday = col.days.find((d) => d.getDay() === 1) || col.days[0];

        return (
          <td
            key={col.key}
            className={cn(
              "border-b border-r border-border p-1 h-[56px] relative cursor-pointer hover:bg-accent/50 transition-colors",
              col.containsToday && "bg-brand-50/30 dark:bg-brand-950/30"
            )}
            onClick={(e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              if (weekAllocs.length > 0) {
                onAllocationClick(weekAllocs[0], weekMonday, rect);
              } else {
                onEmptyCellClick(employee.id, weekMonday, rect);
              }
            }}
            onMouseDown={(e) => {
              if (selectionMode && onDragSelectStart && weekAllocs.length > 0 && e.button === 0) {
                e.preventDefault();
                onDragSelectStart(weekAllocs.map((a) => a.id));
              }
            }}
            onMouseEnter={() => {
              if (selectionMode && onDragSelectEnter && weekAllocs.length > 0) {
                onDragSelectEnter(weekAllocs.map((a) => a.id));
              }
            }}
          >
            <div className="flex flex-col gap-0.5 h-full justify-center">
              {weekVacations.length > 0 && weekAllocs.length === 0 && (
                <div className="h-3 rounded-sm px-1 flex items-center bg-teal-500/70">
                  <span className="text-[9px] text-white truncate">
                    {weekVacations[0].type === "sick"
                      ? t("sick")
                      : weekVacations[0].type === "personal"
                        ? t("personal")
                        : t("vacation")}
                  </span>
                </div>
              )}
              {weekAllocs.slice(0, 3).map((alloc) => (
                <div
                  key={alloc.id}
                  className={cn(
                    "h-3 rounded-sm px-1 flex items-center",
                    alloc.status === "tentative" && "opacity-70",
                    selectionMode && selectedIds?.has(alloc.id) && "ring-2 ring-blue-500 ring-offset-1"
                  )}
                  style={{
                    backgroundColor:
                      alloc.project.color + (alloc.status === "tentative" ? "99" : "CC"),
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (selectionMode && onToggleSelection) {
                      onToggleSelection(alloc.id);
                    } else {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      onAllocationClick(alloc, weekMonday, rect);
                    }
                  }}
                >
                  <span className="text-[9px] text-white truncate drop-shadow-sm">
                    {alloc.project.name}
                  </span>
                </div>
              ))}
              {weekAllocs.length > 3 && (
                <span className="text-[9px] text-muted-foreground text-center">
                  +{weekAllocs.length - 3}
                </span>
              )}
            </div>
            {totalHours > 0 && (
              <div className="absolute bottom-0.5 right-1 text-[10px] text-muted-foreground">
                {totalHours.toFixed(0)}{tc("hourAbbrev")}
              </div>
            )}
            {col.containsToday && (
              <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-red-500 z-[5]" />
            )}
          </td>
        );
      })}

      <td className="sticky right-0 z-10 bg-card border-b border-l border-border">
        <CapacityColumn allocated={totalAllocated} capacity={totalCapacity} />
      </td>
    </tr>
  );
}
