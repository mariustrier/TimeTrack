"use client";

import { useState } from "react";
import { format, isWeekend } from "date-fns";
import { isToday } from "@/lib/demo-date";
import { cn } from "@/lib/utils";
import { isCompanyHoliday, getCompanyHolidayName, type CustomHoliday } from "@/lib/holidays";
import { Plus } from "lucide-react";
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
  onAllocationDrop?: (data: { allocationId: string; sourceDate: string; isMultiDay: boolean; shiftKey: boolean }, targetDate: string) => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelection?: (allocationId: string) => void;
  onDragSelectStart?: (allocationIds: string[]) => void;
  onDragSelectEnter?: (allocationIds: string[]) => void;
  onBulkDrop?: (selectedIds: string[], sourceDate: string, targetDate: string) => void;
}

/** Heatmap color for utilization ratio — matches demo exactly */
function heatColor(ratio: number): { bg: string; text: string } {
  if (ratio > 1.02) return { bg: "#FEE2E2", text: "#B91C1C" };
  if (ratio > 0.85) return { bg: "#D1FAE5", text: "#047857" };
  if (ratio > 0.5)  return { bg: "#FEF9C3", text: "#A16207" };
  if (ratio > 0.01) return { bg: "#F3F4F6", text: "#6B7280" };
  return                    { bg: "#FAFAFA", text: "#D1D5DB" };
}

export { heatColor };

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
  onAllocationDrop,
  selectionMode,
  selectedIds,
  onToggleSelection,
  onDragSelectStart,
  onDragSelectEnter,
  onBulkDrop,
}: PlannerCellProps) {
  const { locale } = useLocale();
  const weekend = isWeekend(day);
  const holiday = !weekend && isCompanyHoliday(day, disabledHolidayCodes, customHolidays);
  const holidayName = !weekend ? getCompanyHolidayName(day, locale as "en" | "da", disabledHolidayCodes, customHolidays) : null;
  const today = isToday(day);
  const totalAllocated = allocations.reduce((s, a) => s + a.hoursPerDay, 0);
  const ratio = dailyTarget > 0 ? totalAllocated / dailyTarget : 0;
  const isEmpty = allocations.length === 0 && !vacation;
  const dateStr = format(day, "yyyy-MM-dd");
  const hc = heatColor(ratio);
  const hasAnySelected = selectionMode && selectedIds && allocations.some(a => selectedIds.has(a.id));

  const [dragOver, setDragOver] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    if (weekend || holiday) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (weekend || holiday) return;
    try {
      const raw = e.dataTransfer.getData("application/json");
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.sourceDate === dateStr) return;
      if (data.bulkMove && onBulkDrop) {
        onBulkDrop(data.selectedIds, data.sourceDate, dateStr);
      } else if (onAllocationDrop) {
        onAllocationDrop({
          allocationId: data.allocationId,
          sourceDate: data.sourceDate,
          isMultiDay: data.isMultiDay,
          shiftKey: data.shiftKey || e.shiftKey,
        }, dateStr);
      }
    } catch {
      // ignore
    }
  };

  const handleCellClick = (e: React.MouseEvent) => {
    if (weekend || holiday) return;
    if (selectionMode && allocations.length > 0) {
      // In selection mode, toggle all allocations in this cell
      if (onToggleSelection) {
        allocations.forEach(a => onToggleSelection(a.id));
      }
      return;
    }
    // Always open create popover on cell click — lets user add more hours
    // Clicking the pill itself handles editing (see pill onClick below)
    onEmptyClick(e);
  };

  return (
    <td
      className={cn(
        "border-b border-r p-0 relative h-[56px] align-middle",
        // Barely-visible borders matching demo
        "border-r-[#F9FAFB] dark:border-r-[#1a1a1a]",
        "border-b-[#F3F4F6] dark:border-b-[#222]",
        weekend && "bg-muted/15",
        holiday && "bg-amber-50/20 dark:bg-amber-950/10",
        today && "bg-[rgba(251,191,36,0.05)]",
        isEmpty && !weekend && !holiday && "group/cell cursor-pointer",
        !isEmpty && !weekend && !holiday && "cursor-pointer",
        dragOver && "ring-2 ring-inset ring-brand-500 bg-brand-50/30 dark:bg-brand-950/30",
        hasAnySelected && "bg-blue-50/50 dark:bg-blue-950/20"
      )}
      onClick={handleCellClick}
      onMouseDown={(e) => {
        if (selectionMode && allocations.length > 0 && e.button === 0) {
          const hasSelected = selectedIds && allocations.some((a) => selectedIds.has(a.id));
          if (hasSelected) return;
          if (onDragSelectStart) {
            e.preventDefault();
            onDragSelectStart(allocations.map((a) => a.id));
          }
        }
      }}
      onMouseEnter={() => {
        if (selectionMode && onDragSelectEnter && allocations.length > 0) {
          onDragSelectEnter(allocations.map((a) => a.id));
        }
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      title={holidayName || undefined}
    >
      <div className="flex items-center justify-center h-full">
        {/* Vacation pill */}
        {vacation && !weekend && (
          <VacationBlock type={vacation.type} />
        )}

        {/* Heatmap pill — click to edit existing allocation */}
        {!vacation && totalAllocated > 0 && !weekend && !holiday && (
          <div
            className="rounded-[6px] px-2.5 py-1.5 text-center min-w-[44px] transition-all duration-200 cursor-pointer"
            style={{
              backgroundColor: hc.bg,
              transform: isHovered ? "scale(1.08)" : "scale(1)",
              boxShadow: isHovered ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={(e) => {
              e.stopPropagation();
              if (selectionMode) return;
              if (allocations.length > 0) {
                onAllocationClick(allocations[0], e);
              }
            }}
          >
            <div
              className="text-[13px] font-bold font-mono leading-none"
              style={{ color: hc.text, fontVariantNumeric: "tabular-nums" }}
            >
              {totalAllocated}
            </div>
            <div
              className="text-[8px] font-medium leading-none mt-0.5"
              style={{ color: hc.text, opacity: 0.7 }}
            >
              hrs
            </div>
          </div>
        )}

        {/* Empty state — subtle plus icon on hover */}
        {isEmpty && !weekend && !holiday && (
          <div className="flex items-center justify-center h-full opacity-0 group-hover/cell:opacity-30 transition-opacity">
            <Plus className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Over-capacity pulsing dot */}
      {ratio > 1.02 && (
        <div className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
      )}

      {/* Today vertical line — amber, subtle */}
      {today && (
        <div className="absolute top-0 left-1/2 bottom-0 w-0.5 bg-[#F59E0B] opacity-30 z-[5]" />
      )}
    </td>
  );
}
