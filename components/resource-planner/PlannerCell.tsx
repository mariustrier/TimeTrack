"use client";

import { format, isWeekend, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { isCompanyHoliday, getCompanyHolidayName, type CustomHoliday } from "@/lib/holidays";
import { Plus } from "lucide-react";
import { AllocationBlock } from "./AllocationBlock";
import { VacationBlock } from "./VacationBlock";
import { useLocale } from "@/lib/i18n";

interface CellAllocation {
  id: string;
  projectId: string;
  projectName: string;
  projectColor: string;
  hoursPerDay: number;
  status: "tentative" | "confirmed" | "completed";
  notes: string | null;
  isMultiDay: boolean;
}

interface CellVacation {
  type: string;
}

interface PlannerCellProps {
  day: Date;
  allocations: CellAllocation[];
  vacation: CellVacation | null;
  dailyTarget: number;
  disabledHolidayCodes: string[];
  customHolidays: CustomHoliday[];
  onEmptyClick: (e: React.MouseEvent) => void;
  onAllocationClick: (allocation: CellAllocation, e: React.MouseEvent) => void;
  onAllocationDelete: (allocationId: string, isMultiDay: boolean, e: React.MouseEvent) => void;
}

export function PlannerCell({
  day,
  allocations,
  vacation,
  dailyTarget,
  disabledHolidayCodes,
  customHolidays,
  onEmptyClick,
  onAllocationClick,
  onAllocationDelete,
}: PlannerCellProps) {
  const { locale } = useLocale();
  const weekend = isWeekend(day);
  const holiday = !weekend && isCompanyHoliday(day, disabledHolidayCodes, customHolidays);
  const holidayName = !weekend ? getCompanyHolidayName(day, locale as "en" | "da", disabledHolidayCodes, customHolidays) : null;
  const today = isToday(day);
  const totalAllocated = allocations.reduce((s, a) => s + a.hoursPerDay, 0);
  const isOverbooked = !weekend && !holiday && dailyTarget > 0 && totalAllocated > dailyTarget;
  const isEmpty = allocations.length === 0 && !vacation;

  return (
    <td
      className={cn(
        "border-b border-r border-border p-0.5 relative h-[56px] transition-colors align-top",
        weekend && "bg-muted/30",
        holiday && "bg-amber-50/50 dark:bg-amber-950/20",
        today && "bg-brand-50/40 dark:bg-brand-950/40",
        isOverbooked && "border-b-2 border-b-red-400 dark:border-b-red-500",
        isEmpty && !weekend && !holiday && "group/cell hover:bg-accent/50 cursor-pointer"
      )}
      onClick={(e) => {
        if (isEmpty && !weekend && !holiday) {
          onEmptyClick(e);
        }
      }}
      title={holidayName || undefined}
    >
      <div className="flex flex-col gap-0.5 p-0.5 min-h-[48px]">
        {/* Vacation */}
        {vacation && <VacationBlock type={vacation.type} />}

        {/* Allocations */}
        {allocations.map((alloc) => (
          <AllocationBlock
            key={alloc.id + "-" + format(day, "yyyy-MM-dd")}
            id={alloc.id}
            projectName={alloc.projectName}
            projectColor={alloc.projectColor}
            hoursPerDay={alloc.hoursPerDay}
            status={alloc.status}
            notes={alloc.notes}
            onClick={(e) => {
              e.stopPropagation();
              onAllocationClick(alloc, e);
            }}
            onDelete={(e) => onAllocationDelete(alloc.id, alloc.isMultiDay, e)}
          />
        ))}

        {/* Add button for empty cells */}
        {isEmpty && !weekend && !holiday && (
          <div className="flex items-center justify-center h-full opacity-0 group-hover/cell:opacity-40 transition-opacity">
            <Plus className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Today indicator line */}
      {today && (
        <div className="absolute top-0 left-0 w-0.5 h-full bg-brand-500 z-[5]" />
      )}
    </td>
  );
}
