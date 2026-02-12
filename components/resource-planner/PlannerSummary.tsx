"use client";

import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface PlannerSummaryProps {
  utilizationPercent: number;
  overbookedCount: number;
  availableCount: number;
}

export function PlannerSummary({
  utilizationPercent,
  overbookedCount,
  availableCount,
}: PlannerSummaryProps) {
  const t = useTranslations("resourcePlanner");

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5">
        <span className="text-xs text-muted-foreground">
          {t("teamUtilization") || "Team Utilization"}
        </span>
        <span
          className={cn(
            "text-sm font-semibold",
            utilizationPercent > 100
              ? "text-red-600 dark:text-red-400"
              : utilizationPercent > 85
                ? "text-amber-600 dark:text-amber-400"
                : "text-emerald-600 dark:text-emerald-400"
          )}
        >
          {utilizationPercent.toFixed(0)}%
        </span>
      </div>

      {overbookedCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-1.5">
          <span className="text-xs text-red-600 dark:text-red-400">
            {t("overbooked") || "Overbooked"}
          </span>
          <span className="text-sm font-semibold text-red-600 dark:text-red-400">
            {overbookedCount}
          </span>
        </div>
      )}

      <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5">
        <span className="text-xs text-muted-foreground">
          {t("available") || "Available"}
        </span>
        <span className="text-sm font-semibold text-foreground">
          {availableCount}
        </span>
      </div>
    </div>
  );
}
