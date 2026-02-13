"use client";

import { format, isWeekend } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTranslations } from "@/lib/i18n";
import { getEffectiveWeeklyCapacity, getDailyTarget } from "@/lib/calculations";
import { isCompanyHoliday, type CustomHoliday } from "@/lib/holidays";
import { PlannerCell } from "./PlannerCell";
import { CapacityColumn } from "./CapacityColumn";

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
}

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

  const getSubtitle = () => {
    if (employee.employmentType === "freelancer") return "Freelancer";
    if (employee.isHourly) return t("hourly") || "Hourly";
    return `${effectiveCap}${tc("hourAbbrev")}/${t("viewWeek") || "week"}`;
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

  return (
    <tr className="group">
      {/* Sticky employee name column */}
      <td className="sticky left-0 z-10 bg-card border-b border-r border-border p-2 min-w-[180px]">
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
