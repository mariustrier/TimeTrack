"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";

type ViewMode = "week" | "twoWeeks" | "month";

interface ViewControlsProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function ViewControls({ viewMode, onViewModeChange }: ViewControlsProps) {
  const t = useTranslations("resourcePlanner");

  const options: { value: ViewMode; label: string }[] = [
    { value: "week", label: t("viewWeek") || "Week" },
    { value: "twoWeeks", label: t("viewTwoWeeks") || "2 Weeks" },
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
