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
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  Users,
  TrendingDown,
  TriangleAlert,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";
import type { TimelineViewMode, VisibilityToggles } from "./types";

interface TimelineFiltersProps {
  viewMode: TimelineViewMode;
  onViewModeChange: (mode: TimelineViewMode) => void;
  currentSpan: number;
  spanConfig: { min: number; max: number; step: number };
  onSpanChange: (value: number) => void;
  clients: string[];
  selectedClient: string;
  onClientChange: (client: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  search: string;
  onSearchChange: (search: string) => void;
  visibility: VisibilityToggles;
  onVisibilityChange: (toggles: VisibilityToggles) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  dateRangeLabel: string;
}

export function TimelineFilters({
  viewMode,
  onViewModeChange,
  currentSpan,
  spanConfig,
  onSpanChange,
  clients,
  selectedClient,
  onClientChange,
  statusFilter,
  onStatusFilterChange,
  search,
  onSearchChange,
  visibility,
  onVisibilityChange,
  onPrevious,
  onNext,
  onToday,
  dateRangeLabel,
}: TimelineFiltersProps) {
  const t = useTranslations("timeline");

  const toggleVisibility = (key: keyof VisibilityToggles) => {
    onVisibilityChange({ ...visibility, [key]: !visibility[key] });
  };

  return (
    <div className="space-y-3">
      {/* Row 1: View mode + span + navigation */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="inline-flex rounded-md border border-border">
            {(["day", "week", "month"] as const).map((mode) => (
              <Button
                key={mode}
                variant={viewMode === mode ? "default" : "ghost"}
                size="sm"
                className={cn("h-7 text-xs rounded-none first:rounded-l-md last:rounded-r-md", viewMode !== mode && "border-0")}
                onClick={() => onViewModeChange(mode)}
              >
                {mode === "day" ? t("viewDay") || "Day" : mode === "week" ? t("viewWeek") || "Week" : t("viewMonth") || "Month"}
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
              className="w-[100px]"
            />
            <span className="text-xs text-muted-foreground w-10 text-right">
              {currentSpan} {t("months") || "mo"}
            </span>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={onPrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onToday}>
            {t("today") || "Today"}
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={onNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-muted-foreground ml-2">
            {dateRangeLabel}
          </span>
        </div>
      </div>

      {/* Row 2: Filters + visibility toggles */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Client filter */}
        <Select value={selectedClient} onValueChange={onClientChange}>
          <SelectTrigger className="h-7 w-[140px] text-xs">
            <SelectValue placeholder={t("allClients") || "All clients"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allClients") || "All clients"}</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="h-7 w-[120px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">{t("active") || "Active"}</SelectItem>
            <SelectItem value="locked">{t("locked") || "Locked"}</SelectItem>
            <SelectItem value="archived">{t("archivedStatus") || "Archived"}</SelectItem>
            <SelectItem value="all">{t("allStatuses") || "All"}</SelectItem>
          </SelectContent>
        </Select>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("searchProjects") || "Search..."}
            className="h-7 w-[150px] text-xs pl-7"
          />
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Visibility toggles */}
        <div className="flex items-center gap-1.5">
          <Button
            variant={visibility.phases ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => toggleVisibility("phases")}
          >
            <Layers className="h-3 w-3" />
            {t("showPhases") || "Phases"}
          </Button>
          <Button
            variant={visibility.team ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => toggleVisibility("team")}
          >
            <Users className="h-3 w-3" />
            {t("showTeam") || "Team"}
          </Button>
          <Button
            variant={visibility.burndown ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => toggleVisibility("burndown")}
          >
            <TrendingDown className="h-3 w-3" />
            {t("showBurndown") || "Burndown"}
          </Button>
          <Button
            variant={visibility.conflicts ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => toggleVisibility("conflicts")}
          >
            <TriangleAlert className="h-3 w-3" />
            {t("showConflicts") || "Conflicts"}
          </Button>
        </div>
      </div>
    </div>
  );
}
