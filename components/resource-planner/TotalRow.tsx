"use client";

import { format, isWeekend } from "date-fns";
import { cn } from "@/lib/utils";
import { isCompanyHoliday, type CustomHoliday } from "@/lib/holidays";
import { isToday } from "date-fns";

interface Allocation {
  userId: string;
  startDate: string;
  endDate: string;
  hoursPerDay: number;
}

interface TotalRowProps {
  days: Date[];
  allocations: Allocation[];
  totalCapacity: number;
  totalAllocated: number;
  disabledHolidayCodes: string[];
  customHolidays: CustomHoliday[];
}

export function TotalRow({
  days,
  allocations,
  totalCapacity,
  totalAllocated,
  disabledHolidayCodes,
  customHolidays,
}: TotalRowProps) {
  const totalUtil = totalCapacity > 0 ? (totalAllocated / totalCapacity) * 100 : 0;

  return (
    <tr className="bg-muted/20 font-medium">
      {/* Label */}
      <td className="sticky left-0 z-10 bg-muted/40 border-t-2 border-r border-border p-2 text-sm text-muted-foreground">
        Total
      </td>

      {/* Day totals */}
      {days.map((day) => {
        const dateStr = format(day, "yyyy-MM-dd");
        const weekend = isWeekend(day);
        const holiday = !weekend && isCompanyHoliday(day, disabledHolidayCodes, customHolidays);

        let dayTotal = 0;
        if (!weekend && !holiday) {
          allocations.forEach((a) => {
            const start = a.startDate.split("T")[0];
            const end = a.endDate.split("T")[0];
            if (dateStr >= start && dateStr <= end) {
              dayTotal += a.hoursPerDay;
            }
          });
        }

        return (
          <td
            key={day.toISOString()}
            className={cn(
              "border-t-2 border-r border-border p-1 text-center",
              weekend && "bg-muted/30",
              holiday && "bg-amber-50/30 dark:bg-amber-950/10",
              isToday(day) && "bg-brand-50/30 dark:bg-brand-950/30"
            )}
          >
            {!weekend && !holiday && dayTotal > 0 && (
              <span className="text-[11px] text-muted-foreground">
                {dayTotal.toFixed(0)}h
              </span>
            )}
          </td>
        );
      })}

      {/* Total capacity */}
      <td className="sticky right-0 z-10 bg-muted/40 border-t-2 border-l border-border p-2 text-center">
        <div className="text-[11px] text-muted-foreground">
          {totalAllocated.toFixed(0)}/{totalCapacity.toFixed(0)}h
        </div>
        <div className="text-[10px] text-muted-foreground">
          {totalUtil.toFixed(0)}%
        </div>
      </td>
    </tr>
  );
}
