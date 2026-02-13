"use client";

import { useTranslations } from "@/lib/i18n";
import type { TimelineActivity } from "./types";

interface ActivityProgressBarProps {
  activities: TimelineActivity[];
  projectColor: string;
  columnCount: number;
}

export function ActivityProgressBar({
  activities,
  projectColor,
  columnCount,
}: ActivityProgressBarProps) {
  const t = useTranslations("timeline");

  const total = activities.length;
  const completed = activities.filter((a) => a.status === "complete").length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <tr className="bg-muted/10">
      {/* Left sticky cell: progress text */}
      <td className="sticky left-0 z-10 bg-card border-b border-r border-border p-1.5 min-w-[220px]">
        <div className="flex items-center gap-1.5 pl-4">
          <span className="text-[10px] text-muted-foreground">
            {t("progress") || "Progress"}:
          </span>
          <span className="text-[10px] font-medium">
            {completed}/{total} ({percent}%)
          </span>
        </div>
      </td>

      {/* Middle cell: progress bar */}
      <td colSpan={columnCount} className="border-b border-border p-1.5">
        <div className="h-1 rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${percent}%`,
              backgroundColor: projectColor,
            }}
          />
        </div>
      </td>

      {/* Right cell */}
      <td className="border-b border-l border-border" />
    </tr>
  );
}
