"use client";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TriangleAlert } from "lucide-react";
import type { TimelineColumn, TimelineAllocation, TimelineConflict } from "./types";

interface AllocationSubRowProps {
  allocation: TimelineAllocation;
  projectColor: string;
  columns: TimelineColumn[];
  conflicts: TimelineConflict[];
}

export function AllocationSubRow({
  allocation,
  projectColor,
  columns,
  conflicts,
}: AllocationSubRowProps) {
  const initials = allocation.userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Check if allocation overlaps with a column
  const isInAllocation = (col: TimelineColumn) => {
    const start = new Date(allocation.startDate);
    const end = new Date(allocation.endDate);
    return col.start <= end && col.end >= start;
  };

  const isStartCol = (col: TimelineColumn) => {
    const start = new Date(allocation.startDate);
    return start >= col.start && start <= col.end;
  };

  const isEndCol = (col: TimelineColumn) => {
    const end = new Date(allocation.endDate);
    return end >= col.start && end <= col.end;
  };

  // Check if this allocation has a conflict on a specific column
  const hasConflict = (col: TimelineColumn) => {
    const colDateStr =
      col.start.toISOString().split("T")[0];
    return conflicts.some(
      (c) =>
        c.userId === allocation.userId &&
        c.date === colDateStr
    );
  };

  return (
    <tr className="bg-muted/10">
      {/* Employee name cell */}
      <td className="sticky left-0 z-10 bg-card border-b border-r border-border p-2 min-w-[200px]">
        <div className="flex items-center gap-2 pl-6">
          <Avatar className="h-5 w-5">
            <AvatarImage src={allocation.userImageUrl || undefined} />
            <AvatarFallback className="text-[8px]">{initials}</AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground truncate">
            {allocation.userName}
          </span>
          <span className="text-[10px] text-muted-foreground/60">
            {allocation.hoursPerDay}t
          </span>
        </div>
      </td>

      {/* Column cells */}
      {columns.map((col) => {
        const inAlloc = isInAllocation(col);
        const isStart = isStartCol(col);
        const isEnd = isEndCol(col);
        const conflict = inAlloc && hasConflict(col);

        return (
          <td
            key={col.key}
            className={cn(
              "border-b border-r border-border p-0 h-[28px] relative",
              col.containsToday && "bg-brand-50/20 dark:bg-brand-950/20"
            )}
          >
            {inAlloc && (
              <div
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 h-3 inset-x-0",
                  isStart && "left-1 rounded-l-sm",
                  isEnd && "right-1 rounded-r-sm",
                  allocation.status === "tentative" && "border border-dashed"
                )}
                style={{
                  backgroundColor: projectColor + "30",
                  borderColor: allocation.status === "tentative" ? projectColor + "60" : undefined,
                }}
              />
            )}
            {conflict && (
              <div className="absolute top-0 right-0 z-10">
                <TriangleAlert className="h-3 w-3 text-amber-500" />
              </div>
            )}
          </td>
        );
      })}

      {/* Empty capacity column */}
      <td className="border-b border-l border-border" />
    </tr>
  );
}
