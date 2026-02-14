"use client";

import { useMemo, useRef, useCallback, useEffect } from "react";
import { format, isWeekend, isSameMonth, startOfMonth, getISOWeek } from "date-fns";
import { isToday } from "@/lib/demo-date";
import { cn } from "@/lib/utils";
import { useDateLocale, useLocale, useTranslations } from "@/lib/i18n";
import { getCompanyHolidayName, isCompanyHoliday, type CustomHoliday } from "@/lib/holidays";
import { getDailyTarget, getEffectiveWeeklyCapacity } from "@/lib/calculations";
import { PlannerRow } from "./PlannerRow";
import { heatColor } from "./PlannerCell";

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
  role?: string;
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
  onBulkDrop?: (selectedIds: string[], sourceDate: string, targetDate: string) => void;
  expandedId?: string | null;
  onExpand?: (employeeId: string) => void;
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
  onBulkDrop,
  expandedId,
  onExpand,
}: PlannerGridProps) {
  const dateLocale = useDateLocale();
  const { locale } = useLocale();
  const t = useTranslations("resourcePlanner");
  const tc = useTranslations("common");
  const isMonthView = viewMode === "month";

  // ── Drag-to-select state ──
  const isDragSelecting = useRef(false);
  const dragStartIds = useRef<string[]>([]);

  const handleDragSelectStart = useCallback(
    (allocationIds: string[]) => {
      if (!selectionMode) return;
      isDragSelecting.current = true;
      dragStartIds.current = allocationIds;
    },
    [selectionMode]
  );

  const handleDragSelectEnter = useCallback(
    (allocationIds: string[]) => {
      if (!isDragSelecting.current || !onAddToSelection) return;
      if (dragStartIds.current.length > 0) {
        onAddToSelection([...dragStartIds.current, ...allocationIds]);
        dragStartIds.current = [];
      } else {
        onAddToSelection(allocationIds);
      }
    },
    [onAddToSelection]
  );

  useEffect(() => {
    if (!selectionMode) return;
    const handleMouseUp = () => {
      isDragSelecting.current = false;
      dragStartIds.current = [];
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

  // ── Per-day team totals for heatmap summary row ──
  const teamDailyTotals = useMemo(() => {
    const totals: Record<string, { alloc: number; cap: number }> = {};
    days.forEach((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      let dayAlloc = 0;
      let dayCap = 0;
      if (!isWeekend(day) && !isCompanyHoliday(day, disabledHolidayCodes, customHolidays)) {
        employees.forEach((emp) => {
          const empCap = getEffectiveWeeklyCapacity(emp);
          dayCap += getDailyTarget(day, empCap, disabledHolidayCodes, customHolidays);
          allocations.forEach((a) => {
            if (a.userId !== emp.id) return;
            const start = a.startDate.split("T")[0];
            const end = a.endDate.split("T")[0];
            if (dateStr >= start && dateStr <= end) {
              dayAlloc += a.hoursPerDay;
            }
          });
        });
      }
      totals[dateStr] = { alloc: dayAlloc, cap: dayCap };
    });
    return totals;
  }, [employees, allocations, days, disabledHolidayCodes, customHolidays]);

  // ── Expanded sub-row data: unique projects for expanded employee ──
  const expandedProjects = useMemo(() => {
    if (!expandedId) return [];
    const empAllocations = allocations.filter((a) => a.userId === expandedId);
    const projectMap = new Map<string, Project>();
    empAllocations.forEach((a) => {
      if (!projectMap.has(a.projectId)) {
        projectMap.set(a.projectId, a.project);
      }
    });
    return Array.from(projectMap.values());
  }, [expandedId, allocations]);

  const expandedEmployee = expandedId ? employees.find((e) => e.id === expandedId) : null;

  // ── Month View rendering ──
  if (isMonthView) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse table-fixed">
          <colgroup>
            <col className="w-[220px]" />
          </colgroup>
          <thead>
            <tr>
              <th
                className="sticky left-0 z-20 bg-card border-b border-r border-border p-2 text-left"
                rowSpan={2}
              >
                <span className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[0.06em]">
                  {t("employee") || "Team Members"}
                </span>
              </th>
              {monthGroupHeaders.map(({ label, colSpan }, idx) => (
                <th
                  key={idx}
                  colSpan={colSpan}
                  className="border-b border-r border-[#F3F4F6] dark:border-[#222] p-1 text-center bg-[#FAFAF9] dark:bg-[#151515]"
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
                    "border-b border-r border-[#F3F4F6] dark:border-[#222] p-1 text-center",
                    col.containsToday && "bg-[#FFFBEB] dark:bg-amber-950/20"
                  )}
                >
                  <span
                    className={cn(
                      "text-[10px] font-medium font-mono",
                      col.containsToday
                        ? "text-[#D97706]"
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
                  onBulkDrop={onBulkDrop}
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
          <col className="w-[220px]" />
          {days.map((d) => (
            <col key={d.toISOString()} className="min-w-[76px]" />
          ))}
          <col className="w-[90px]" />
        </colgroup>
        <thead>
          {/* Column headers */}
          <tr>
            <th className="sticky left-0 z-20 bg-card border-b border-r border-border p-2 text-left">
              <span className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[0.06em]">
                {t("employee") || "Team Members"}
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

              return (
                <th
                  key={day.toISOString()}
                  className={cn(
                    "border-b border-r border-[#F3F4F6] dark:border-[#222] p-1 text-center",
                    weekend && "bg-muted/15",
                    isToday(day) && "bg-[#FFFBEB] dark:bg-amber-950/20",
                    holidayName && !weekend && "bg-amber-50/20 dark:bg-amber-950/10"
                  )}
                >
                  <div className={cn(
                    "text-[9px] font-semibold uppercase tracking-[0.05em]",
                    isToday(day) ? "text-[#D97706]" : "text-[#9CA3AF]"
                  )}>
                    {isToday(day) ? "Today" : format(day, "EEE", { locale: dateLocale })}
                  </div>
                  <div
                    className={cn(
                      "text-[10px] font-mono",
                      isToday(day) ? "text-[#92400E]" : "text-[#6B7280]"
                    )}
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {format(day, "MMM d", { locale: dateLocale })}
                  </div>
                  {holidayName && (
                    <div
                      className="text-[8px] text-amber-600 dark:text-amber-400 truncate"
                      title={holidayName}
                    >
                      {holidayName}
                    </div>
                  )}
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
          {/* ══ Team Summary Heatmap Row ══ */}
          <tr className="bg-[#FAFAF9] dark:bg-[#151515]">
            <td className="sticky left-0 z-10 bg-[#FAFAF9] dark:bg-[#151515] border-b border-r border-border p-2">
              <span className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[0.06em]">
                Team
              </span>
              <span className="text-[10px] text-[#6B7280] ml-2">
                {employees.reduce((s, e) => s + (e.weeklyTarget || 0), 0)}{tc("hourAbbrev")}/wk
              </span>
            </td>
            {days.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const weekend = isWeekend(day);
              const holiday = !weekend && isCompanyHoliday(day, disabledHolidayCodes, customHolidays);
              const totals = teamDailyTotals[dateStr] || { alloc: 0, cap: 0 };
              const ratio = totals.cap > 0 ? totals.alloc / totals.cap : 0;
              const hc = heatColor(ratio);

              return (
                <td
                  key={day.toISOString()}
                  className={cn(
                    "border-b border-r border-[#F3F4F6] dark:border-[#222] p-0 h-[28px] text-center align-middle",
                    weekend && "bg-muted/10",
                    isToday(day) && "bg-[#FFFBEB] dark:bg-amber-950/20"
                  )}
                >
                  {!weekend && !holiday && totals.cap > 0 && (
                    <span
                      className="inline-block px-2 py-0.5 rounded text-[9px] font-bold font-mono"
                      style={{
                        background: hc.bg,
                        color: hc.text,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {Math.round(ratio * 100)}%
                    </span>
                  )}
                </td>
              );
            })}
            <td className="sticky right-0 z-10 bg-[#FAFAF9] dark:bg-[#151515] border-b border-l border-border p-1 text-center">
              <span className="text-[10px] font-bold font-mono text-muted-foreground">
                {totalCapacity > 0 ? Math.round((totalAllocated / totalCapacity) * 100) : 0}%
              </span>
            </td>
          </tr>

          {/* ══ Employee Rows ══ */}
          {employees.map((employee) => {
            const empAllocations = allocations.filter((a) => a.userId === employee.id);
            const empVacations = vacations.filter((v) => v.userId === employee.id);
            const isExpanded = expandedId === employee.id;
            const isDimmed = !!expandedId && !isExpanded;

            return (
              <EmployeeRowGroup
                key={employee.id}
                employee={employee}
                days={days}
                allocations={empAllocations}
                allAllocations={allocations}
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
                onBulkDrop={onBulkDrop}
                isExpanded={isExpanded}
                isDimmed={isDimmed}
                onExpand={() => onExpand?.(employee.id)}
                expandedProjects={isExpanded ? expandedProjects : []}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Employee Row Group: main row + expanded sub-rows ──

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CapacityColumn } from "./CapacityColumn";

interface EmployeeRowGroupProps {
  employee: Employee;
  days: Date[];
  allocations: Allocation[];
  allAllocations: Allocation[];
  vacations: Vacation[];
  disabledHolidayCodes: string[];
  customHolidays: CustomHoliday[];
  onEmptyCellClick: (employeeId: string, date: Date, rect: DOMRect) => void;
  onAllocationClick: (allocation: Allocation, date: Date, rect: DOMRect) => void;
  onAllocationDelete: (allocationId: string, date?: string) => void;
  onAllocationDrop?: (employeeId: string, data: { allocationId: string; sourceDate: string; isMultiDay: boolean; shiftKey: boolean }, targetDate: string) => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelection?: (allocationId: string) => void;
  onDragSelectStart: (allocationIds: string[]) => void;
  onDragSelectEnter: (allocationIds: string[]) => void;
  onBulkDrop?: (selectedIds: string[], sourceDate: string, targetDate: string) => void;
  isExpanded: boolean;
  isDimmed: boolean;
  onExpand: () => void;
  expandedProjects: Project[];
}

function EmployeeRowGroup({
  employee,
  days,
  allocations,
  allAllocations,
  vacations,
  disabledHolidayCodes,
  customHolidays,
  onEmptyCellClick,
  onAllocationClick,
  onAllocationDelete,
  onAllocationDrop,
  selectionMode,
  selectedIds,
  onToggleSelection,
  onDragSelectStart,
  onDragSelectEnter,
  onBulkDrop,
  isExpanded,
  isDimmed,
  onExpand,
  expandedProjects,
}: EmployeeRowGroupProps) {
  const tc = useTranslations("common");
  const empCap = getEffectiveWeeklyCapacity(employee);

  return (
    <>
      {/* Main employee row */}
      <PlannerRow
        employee={employee}
        days={days}
        allocations={allocations}
        vacations={vacations}
        disabledHolidayCodes={disabledHolidayCodes}
        customHolidays={customHolidays}
        onEmptyCellClick={onEmptyCellClick}
        onAllocationClick={onAllocationClick}
        onAllocationDelete={onAllocationDelete}
        onAllocationDrop={onAllocationDrop}
        selectionMode={selectionMode}
        selectedIds={selectedIds}
        onToggleSelection={onToggleSelection}
        onDragSelectStart={onDragSelectStart}
        onDragSelectEnter={onDragSelectEnter}
        onBulkDrop={onBulkDrop}
        isExpanded={isExpanded}
        isDimmed={isDimmed}
        onExpand={onExpand}
      />

      {/* ── Expanded: per-project allocation sub-rows ── */}
      {isExpanded && expandedProjects.map((project) => (
        <tr
          key={`expanded-${employee.id}-${project.id}`}
          className="transition-all duration-300"
          style={{ background: "#FAFAF9" }}
        >
          {/* Left cell: project info */}
          <td className="sticky left-0 z-10 bg-[#FAFAF9] dark:bg-[#151515] border-b border-r border-[#F3F4F6] dark:border-[#222] p-0">
            <div className="flex items-center gap-2 pl-14 pr-3 py-1.5">
              <span
                className="w-2 h-2 rounded-[2px] shrink-0"
                style={{ background: project.color }}
              />
              <span className="text-[11px] font-medium truncate">{project.name}</span>
            </div>
          </td>

          {/* Per-day allocation bars */}
          {days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const weekend = isWeekend(day);
            const holiday = !weekend && isCompanyHoliday(day, disabledHolidayCodes, customHolidays);

            // Find allocation for this project on this day
            let hours = 0;
            if (!weekend && !holiday) {
              allocations.forEach((a) => {
                if (a.projectId !== project.id) return;
                const start = a.startDate.split("T")[0];
                const end = a.endDate.split("T")[0];
                if (dateStr >= start && dateStr <= end) {
                  hours += a.hoursPerDay;
                }
              });
            }

            const pct = empCap > 0 ? hours / (empCap / 5) : 0;

            return (
              <td
                key={day.toISOString()}
                className={cn(
                  "border-b border-r border-[#F9FAFB] dark:border-[#1a1a1a] p-0 h-[32px] align-middle",
                  weekend && "bg-muted/10",
                  isToday(day) && "bg-[rgba(251,191,36,0.03)]"
                )}
              >
                <div className="flex items-center justify-center h-full px-1">
                  {weekend || holiday ? null : hours === 0 ? (
                    <span className="text-[9px] text-[#D1D5DB]">&mdash;</span>
                  ) : (
                    <div
                      className="flex items-center justify-center transition-all duration-250"
                      style={{
                        width: `${Math.max(pct * 100, 30)}%`,
                        maxWidth: "90%",
                        height: 20,
                        borderRadius: 4,
                        background: `${project.color}CC`,
                        cursor: selectionMode ? "default" : "pointer",
                      }}
                      onClick={(e) => {
                        const alloc = allocations.find((a) => {
                          if (a.projectId !== project.id) return false;
                          const start = a.startDate.split("T")[0];
                          const end = a.endDate.split("T")[0];
                          return dateStr >= start && dateStr <= end;
                        });
                        if (alloc) {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          onAllocationClick(alloc, day, rect);
                        }
                      }}
                    >
                      <span
                        className="text-[9px] font-bold text-white font-mono"
                        style={{
                          fontVariantNumeric: "tabular-nums",
                          textShadow: "0 1px 2px rgba(0,0,0,0.2)",
                        }}
                      >
                        {hours}
                      </span>
                    </div>
                  )}
                </div>
              </td>
            );
          })}

          {/* Capacity cell - empty for sub-rows */}
          <td className="sticky right-0 z-10 bg-[#FAFAF9] dark:bg-[#151515] border-b border-l border-[#F3F4F6] dark:border-[#222]" />
        </tr>
      ))}

      {/* Expanded: project legend row */}
      {isExpanded && expandedProjects.length > 0 && (
        <tr style={{ background: "#FAFAF9" }}>
          <td
            colSpan={days.length + 2}
            className="border-b border-[#F3F4F6] dark:border-[#222] p-0"
          >
            <div className="flex gap-3 px-14 py-1.5">
              {expandedProjects.map((p) => (
                <span key={p.id} className="flex items-center gap-1.5 text-[10px] text-[#6B7280] font-medium">
                  <span className="w-2 h-2 rounded-[2px]" style={{ background: p.color }} />
                  {p.name}
                </span>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Month Row (inline, specific to month view) ──

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
  onBulkDrop,
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
  onBulkDrop?: (selectedIds: string[], sourceDate: string, targetDate: string) => void;
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
      if (dateStr >= start && dateStr <= end) totalAllocated += a.hoursPerDay;
    });
  });

  return (
    <tr className="group">
      <td className="sticky left-0 z-10 bg-card border-b border-r border-border p-2">
        <div className="flex items-center gap-2">
          <Avatar className="h-[34px] w-[34px] rounded-[9px]">
            <AvatarImage src={employee.imageUrl || undefined} className="rounded-[9px]" />
            <AvatarFallback className="rounded-[9px] text-[10px] font-bold">{getInitials()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold truncate leading-tight">{getDisplayName()}</p>
            <p className="text-[11px] text-muted-foreground leading-tight font-mono">
              {employee.employmentType === "freelancer" ? "Freelancer" : employee.isHourly ? (t("hourly") || "Hourly") : `${effectiveCap}${tc("hourAbbrev")}`}
            </p>
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

        let totalHours = 0;
        let totalTarget = 0;
        col.days.forEach((d) => {
          if (isWeekend(d)) return;
          if (isCompanyHoliday(d, disabledHolidayCodes, customHolidays)) return;
          totalTarget += getDailyTarget(d, effectiveCap, disabledHolidayCodes, customHolidays);
          const ds = format(d, "yyyy-MM-dd");
          allocations.forEach((a) => {
            const start = a.startDate.split("T")[0];
            const end = a.endDate.split("T")[0];
            if (ds >= start && ds <= end) totalHours += a.hoursPerDay;
          });
        });

        const ratio = totalTarget > 0 ? totalHours / totalTarget : 0;
        const hc = heatColor(ratio);
        const weekMonday = col.days.find((d) => d.getDay() === 1) || col.days[0];

        return (
          <td
            key={col.key}
            className={cn(
              "border-b border-r border-[#F3F4F6] dark:border-[#222] p-1 h-[56px] relative cursor-pointer hover:bg-accent/30 transition-colors align-middle text-center",
              col.containsToday && "bg-[rgba(251,191,36,0.05)]"
            )}
            onClick={(e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              if (weekAllocs.length > 0) {
                onAllocationClick(weekAllocs[0], weekMonday, rect);
              } else {
                onEmptyCellClick(employee.id, weekMonday, rect);
              }
            }}
          >
            {totalHours > 0 && (
              <div
                className="inline-block px-2.5 py-1.5 rounded-[6px] text-center min-w-[44px]"
                style={{ background: hc.bg }}
              >
                <div
                  className="text-[13px] font-bold font-mono leading-none"
                  style={{ color: hc.text, fontVariantNumeric: "tabular-nums" }}
                >
                  {totalHours.toFixed(0)}
                </div>
                <div className="text-[8px] font-medium leading-none mt-0.5" style={{ color: hc.text, opacity: 0.7 }}>
                  hrs
                </div>
              </div>
            )}
            {col.containsToday && (
              <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-[#F59E0B] opacity-30 z-[5]" />
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
