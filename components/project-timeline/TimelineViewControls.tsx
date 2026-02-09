"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";

export type TimelineViewMode = "day" | "week" | "month";

interface TimelineViewControlsProps {
  viewMode: TimelineViewMode;
  onViewModeChange: (mode: TimelineViewMode) => void;
}

export function TimelineViewControls({ viewMode, onViewModeChange }: TimelineViewControlsProps) {
  const t = useTranslations("timeline");

  const options: { value: TimelineViewMode; label: string }[] = [
    { value: "day", label: t("viewDay") || "Day" },
    { value: "week", label: t("viewWeek") || "Week" },
    { value: "month", label: t("viewMonth") || "Month" },
  ];

  return (
    <div className="flex rounded-lg border border-border overflow-hidden">
      {options.map((option) => (
        <Button
          key={option.value}
          variant="ghost"
          size="sm"
          className={cn(
            "rounded-none border-r last:border-r-0 border-border px-4",
            viewMode === option.value && "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
          )}
          onClick={() => onViewModeChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
