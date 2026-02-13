"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Search, MousePointerClick } from "lucide-react";
import { useTranslations, useDateLocale } from "@/lib/i18n";
import { format } from "date-fns";

type ViewMode = "week" | "twoWeeks" | "month";

interface Project {
  id: string;
  name: string;
  color: string;
}

interface PlannerControlsProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  currentSpan: number;
  onSpanChange: (span: number) => void;
  spanConfig: { min: number; max: number; step: number; unit: "weeks" | "months" };
  dateRange: { start: Date; end: Date };
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  projects: Project[];
  projectFilter: string | null;
  onProjectFilterChange: (projectId: string | null) => void;
  employeeSearch: string;
  onEmployeeSearchChange: (search: string) => void;
  selectionMode?: boolean;
  onSelectionModeToggle?: () => void;
}

export function PlannerControls({
  viewMode,
  onViewModeChange,
  currentSpan,
  onSpanChange,
  spanConfig,
  dateRange,
  onPrevious,
  onNext,
  onToday,
  projects,
  projectFilter,
  onProjectFilterChange,
  employeeSearch,
  onEmployeeSearchChange,
  selectionMode,
  onSelectionModeToggle,
}: PlannerControlsProps) {
  const t = useTranslations("resourcePlanner");
  const dateLocale = useDateLocale();

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      {/* Left: Nav */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={onPrevious}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" className="h-8" onClick={onToday}>
          {t("today") || "Today"}
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={onNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium text-muted-foreground ml-1">
          {format(dateRange.start, "MMM d", { locale: dateLocale })} –{" "}
          {format(dateRange.end, "MMM d, yyyy", { locale: dateLocale })}
        </span>
      </div>

      {/* Right: View mode, span, filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Selection mode toggle */}
        {onSelectionModeToggle && (
          <Button
            variant={selectionMode ? "default" : "outline"}
            size="sm"
            className="h-8 text-sm gap-1.5"
            onClick={onSelectionModeToggle}
          >
            <MousePointerClick className="h-3.5 w-3.5" />
            {t("select") || "Select"}
          </Button>
        )}

        {/* Employee search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={employeeSearch}
            onChange={(e) => onEmployeeSearchChange(e.target.value)}
            placeholder={t("searchEmployee") || "Search..."}
            className="h-8 w-[140px] pl-7 text-sm"
          />
        </div>

        {/* Project filter */}
        <Select
          value={projectFilter || "all"}
          onValueChange={(v) => onProjectFilterChange(v === "all" ? null : v)}
        >
          <SelectTrigger className="h-8 w-[160px] text-sm">
            <SelectValue placeholder={t("allProjects") || "All projects"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allProjects") || "All projects"}</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="truncate">{p.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* View mode buttons */}
        <div className="flex rounded-md border">
          {(["week", "twoWeeks", "month"] as const).map((mode) => (
            <Button
              key={mode}
              variant={viewMode === mode ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs rounded-none first:rounded-l-md last:rounded-r-md"
              onClick={() => onViewModeChange(mode)}
            >
              {mode === "week"
                ? t("viewWeek") || "Week"
                : mode === "twoWeeks"
                  ? t("viewTwoWeeks") || "2 Weeks"
                  : t("viewMonth") || "Month"}
            </Button>
          ))}
        </div>

        {/* Span slider */}
        <div className="flex items-center gap-2">
          <Slider
            value={[currentSpan]}
            onValueChange={([v]) => onSpanChange(v)}
            min={spanConfig.min}
            max={spanConfig.max}
            step={spanConfig.step}
            className="w-[80px]"
          />
          <span className="text-xs text-muted-foreground w-10 text-right">
            {currentSpan} {t(spanConfig.unit) || (spanConfig.unit === "weeks" ? "wk" : "mo")}
          </span>
        </div>
      </div>
    </div>
  );
}
