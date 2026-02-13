"use client";

import { format, isWeekend } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTranslations } from "@/lib/i18n";
import { getEffectiveWeeklyCapacity, getDailyTarget } from "@/lib/calculations";
import { isCompanyHoliday, type CustomHoliday } from "@/lib/holidays";
import { PlannerCell } from "./PlannerCell";
import { CapacityColumn } from "./CapacityColumn";
import { cn } from "@/lib/utils";

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
  project: { id: string; name: string; color: string; client: string | null };
}

interface Vacation {
  userId: string;
  startDate: string;
  endDate: string;
  type: string;
}

interface PlannerRowProps {
  employee: Employee;
  days: Date[];
  allocations: Allocation[];
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
  onDragSelectStart?: (allocationIds: string[]) => void;
  onDragSelectEnter?: (allocationIds: string[]) => void;
  onBulkDrop?: (selectedIds: string[], sourceDate: string, targetDate: string) => void;
  // New props for demo-matching visuals
  isDimmed?: boolean;
  isExpanded?: boolean;
  onExpand?: () => void;
}

/** Status classification based on utilization ratio */
function statusOf(ratio: number) {
  if (ratio > 1.02) return { key: "over",    label: "Overbooked", bg: "#FEE2E2", fg: "#DC2626", dot: "#DC2626" };
  if (ratio > 0.85) return { key: "optimal", label: "OK",         bg: "#D1FAE5", fg: "#059669", dot: "#059669" };
  if (ratio > 0.4)  return { key: "partial", label: "Partial",    bg: "#FEF3C7", fg: "#B45309", dot: "#D97706" };
  return                    { key: "low",     label: "Low",        bg: "#F3F4F6", fg: "#9CA3AF", dot: "#9CA3AF" };
}

/** Role badge colors matching demo */
const ROLE_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  admin:   { bg: "#DBEAFE", fg: "#1E40AF", label: "Admin" },
  manager: { bg: "#E0E7FF", fg: "#3730A3", label: "Manager" },
  employee: { bg: "#F3E8FF", fg: "#6B21A8", label: "Employee" },
};

export function PlannerRow({
  employee,
  days,
  allocations,
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
  isDimmed,
  isExpanded,
  onExpand,
}: PlannerRowProps) {
  const t = useTranslations("resourcePlanner");
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

  const getRoleInfo = () => {
    const role = employee.role || "employee";
    return ROLE_COLORS[role] || ROLE_COLORS.employee;
  };

  // Get allocations for a specific day (skip weekends)
  const getAllocationsForDay = (day: Date) => {
    if (isWeekend(day)) return [];
    const dateStr = format(day, "yyyy-MM-dd");
    return allocations.filter((a) => {
      const start = a.startDate.split("T")[0];
      const end = a.endDate.split("T")[0];
      return dateStr >= start && dateStr <= end;
    }).map((a) => ({
      id: a.id,
      projectId: a.projectId,
      projectName: a.project.name,
      projectColor: a.project.color,
      hoursPerDay: a.hoursPerDay,
      status: a.status,
      notes: a.notes,
      isMultiDay: a.startDate.split("T")[0] !== a.endDate.split("T")[0],
    }));
  };

  // Get vacation for a specific day
  const getVacationForDay = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    const v = vacations.find((vac) => {
      const start = vac.startDate.split("T")[0];
      const end = vac.endDate.split("T")[0];
      return dateStr >= start && dateStr <= end;
    });
    return v ? { type: v.type } : null;
  };

  // Calculate capacity for the visible period
  let totalAllocated = 0;
  let totalCapacity = 0;

  days.forEach((day) => {
    if (isWeekend(day)) return;
    if (isCompanyHoliday(day, disabledHolidayCodes, customHolidays)) return;
    const target = getDailyTarget(day, effectiveCap, disabledHolidayCodes, customHolidays);
    totalCapacity += target;
    const dayAllocs = getAllocationsForDay(day);
    totalAllocated += dayAllocs.reduce((s, a) => s + a.hoursPerDay, 0);
  });

  const avgRatio = totalCapacity > 0 ? totalAllocated / totalCapacity : 0;
  const status = statusOf(avgRatio);
  const roleInfo = getRoleInfo();

  return (
    <tr
      className={cn("group", "transition-all duration-300")}
      style={{ opacity: isDimmed ? 0.4 : 1 }}
    >
      {/* Sticky employee name column — redesigned to match demo */}
      <td
        className={cn(
          "sticky left-0 z-10 border-b border-r border-border p-0 min-w-[220px]",
          isExpanded ? "bg-[#FAFAF9] dark:bg-[#151515]" : "bg-card",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2.5 px-4 py-3 cursor-pointer transition-colors duration-150",
            !isExpanded && "hover:bg-[#F9FAFB] dark:hover:bg-[#1a1a1a]"
          )}
          onClick={onExpand}
        >
          {/* Avatar — 34x34, rounded-[9px] matching demo */}
          <Avatar className="h-[34px] w-[34px] rounded-[9px] shrink-0">
            <AvatarImage src={employee.imageUrl || undefined} className="rounded-[9px]" />
            <AvatarFallback
              className="rounded-[9px] text-[11px] font-bold"
              style={{
                background: `${roleInfo.fg}10`,
                border: `1.5px solid ${roleInfo.fg}30`,
                color: roleInfo.fg,
              }}
            >
              {getInitials()}
            </AvatarFallback>
          </Avatar>

          {/* Info column */}
          <div className="flex-1 min-w-0">
            {/* Row 1: Name + Role badge */}
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-semibold truncate leading-tight">
                {getDisplayName()}
              </span>
              <span
                className="shrink-0 px-1.5 py-px rounded text-[9px] font-bold uppercase tracking-wide"
                style={{ background: roleInfo.bg, color: roleInfo.fg }}
              >
                {employee.employmentType === "freelancer"
                  ? "Freelancer"
                  : employee.isHourly
                    ? (t("hourly") || "Hourly")
                    : `${effectiveCap}${tc("hourAbbrev")}`}
              </span>
            </div>

            {/* Row 2: Utilization bar + Status badge */}
            <div className="flex items-center gap-2 mt-1.5">
              {/* Mini utilization bar */}
              <div className="flex items-center gap-1.5">
                <div className="w-[50px] h-[5px] bg-[#E5E7EB] dark:bg-[#374151] rounded-[3px] overflow-hidden">
                  <div
                    className="h-[5px] rounded-[3px] transition-all duration-400"
                    style={{
                      width: `${Math.min(avgRatio * 100, 100)}%`,
                      backgroundColor: status.fg,
                    }}
                  />
                </div>
                <span
                  className="text-[10px] font-semibold font-mono min-w-[28px]"
                  style={{ color: status.fg, fontVariantNumeric: "tabular-nums" }}
                >
                  {Math.round(avgRatio * 100)}%
                </span>
              </div>

              {/* Status badge */}
              <span
                className="inline-flex items-center gap-1 px-2 py-px rounded-[10px] text-[10px] font-semibold"
                style={{ background: status.bg, color: status.fg }}
              >
                <span
                  className="w-[5px] h-[5px] rounded-full"
                  style={{
                    background: status.dot,
                    animation: status.key === "over" ? "pulse 1.5s ease infinite" : "none",
                  }}
                />
                {status.label}
              </span>
            </div>
          </div>

          {/* Chevron */}
          {!selectionMode && (
            <span
              className="text-[12px] text-[#9CA3AF] transition-transform duration-300 shrink-0"
              style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
            >
              &#x25B8;
            </span>
          )}
        </div>
      </td>

      {/* Day cells */}
      {days.map((day) => {
        const dayAllocations = getAllocationsForDay(day);
        const vacation = getVacationForDay(day);
        const target = getDailyTarget(day, effectiveCap, disabledHolidayCodes, customHolidays);

        return (
          <PlannerCell
            key={day.toISOString()}
            day={day}
            allocations={dayAllocations}
            vacation={vacation}
            dailyTarget={target}
            disabledHolidayCodes={disabledHolidayCodes}
            customHolidays={customHolidays}
            onEmptyClick={(e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              onEmptyCellClick(employee.id, day, rect);
            }}
            onAllocationClick={(alloc, e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const fullAlloc = allocations.find((a) => a.id === alloc.id);
              if (fullAlloc) onAllocationClick(fullAlloc, day, rect);
            }}
            onAllocationDelete={(allocId, isMultiDay) => {
              onAllocationDelete(allocId, isMultiDay ? format(day, "yyyy-MM-dd") : undefined);
            }}
            onAllocationDrop={onAllocationDrop ? (data, targetDate) => onAllocationDrop(employee.id, data, targetDate) : undefined}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onToggleSelection={onToggleSelection}
            onDragSelectStart={onDragSelectStart}
            onDragSelectEnter={onDragSelectEnter}
            onBulkDrop={onBulkDrop}
          />
        );
      })}

      {/* Sticky capacity column */}
      <td className="sticky right-0 z-10 bg-card border-b border-l border-border">
        <CapacityColumn allocated={totalAllocated} capacity={totalCapacity} />
      </td>
    </tr>
  );
}
