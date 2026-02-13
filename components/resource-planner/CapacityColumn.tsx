"use client";

import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";

interface CapacityColumnProps {
  allocated: number;
  capacity: number;
}

export function CapacityColumn({ allocated, capacity }: CapacityColumnProps) {
  const tc = useTranslations("common");
  const utilization = capacity > 0 ? (allocated / capacity) * 100 : 0;
  const barColor =
    utilization > 100
      ? "bg-red-500"
      : utilization > 85
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <div className="flex flex-col items-center gap-1 px-2 py-1 min-w-[80px]">
      <span className="text-[11px] font-medium text-foreground font-mono">
        {allocated.toFixed(0)}/{capacity.toFixed(0)}{tc("hourAbbrev")}
      </span>
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${Math.min(utilization, 100)}%` }}
        />
      </div>
      <span
        className={cn(
          "text-[10px] font-mono",
          utilization > 100
            ? "text-red-600 dark:text-red-400 font-medium"
            : "text-muted-foreground"
        )}
      >
        {utilization.toFixed(0)}%
      </span>
    </div>
  );
}
