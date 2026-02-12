"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  isToday,
  isWithinInterval,
  getISOWeek,
} from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useTranslations, useDateLocale } from "@/lib/i18n";
import { TimelineGrid } from "@/components/project-timeline/TimelineGrid";
import { TimelineFilters } from "@/components/project-timeline/TimelineFilters";
import { ConflictPanel } from "@/components/project-timeline/ConflictPanel";
import type {
  TimelineProject,
  TimelineMilestone,
  TimelineColumn,
  TimelineConflict,
  TimelineViewMode,
  VisibilityToggles,
  CompanyPhase,
} from "@/components/project-timeline/types";

export function ProjectTimeline() {
  const t = useTranslations("timeline");
  const dateLocale = useDateLocale();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [projects, setProjects] = useState<TimelineProject[]>([]);
  const [milestones, setMilestones] = useState<TimelineMilestone[]>([]);
  const [phases, setPhases] = useState<CompanyPhase[]>([]);
  const [conflicts, setConflicts] = useState<TimelineConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<TimelineViewMode>("day");
  const [spans, setSpans] = useState<Record<TimelineViewMode, number>>({ day: 3, week: 6, month: 12 });

  // Filters
  const [clientFilter, setClientFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [visibility, setVisibility] = useState<VisibilityToggles>({
    phases: true,
    team: false,
    burndown: false,
    conflicts: true,
  });

  const spanConfig: Record<TimelineViewMode, { min: number; max: number; step: number }> = {
    day: { min: 1, max: 6, step: 1 },
    week: { min: 2, max: 12, step: 1 },
    month: { min: 6, max: 24, step: 3 },
  };

  const currentSpan = spans[viewMode];

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Calculate visible date range
  const dateRange = useMemo(() => {
    const half = Math.floor(currentSpan / 2);
    const remainder = currentSpan - half;

    switch (viewMode) {
      case "day":
        return {
          start: startOfMonth(subMonths(currentDate, half)),
          end: endOfMonth(addMonths(currentDate, remainder - 1)),
        };
      case "week":
        return {
          start: startOfWeek(subMonths(currentDate, half), { weekStartsOn: 1 }),
          end: endOfWeek(addMonths(currentDate, remainder), { weekStartsOn: 1 }),
        };
      case "month":
        return {
          start: startOfMonth(subMonths(currentDate, half)),
          end: endOfMonth(addMonths(currentDate, remainder)),
        };
    }
  }, [currentDate, viewMode, currentSpan]);

  // Generate columns
  const columns = useMemo((): TimelineColumn[] => {
    const today = new Date();

    switch (viewMode) {
      case "day":
        return eachDayOfInterval({ start: dateRange.start, end: dateRange.end }).map((day) => ({
          key: format(day, "yyyy-MM-dd"),
          label: format(day, "d"),
          start: day,
          end: day,
          containsToday: isToday(day),
          month: startOfMonth(day),
        }));
      case "week":
        return eachWeekOfInterval(
          { start: dateRange.start, end: dateRange.end },
          { weekStartsOn: 1 }
        ).map((weekStart) => {
          const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
          return {
            key: format(weekStart, "yyyy") + "-W" + getISOWeek(weekStart),
            label: "W" + getISOWeek(weekStart),
            start: weekStart,
            end: weekEnd,
            containsToday: isWithinInterval(today, { start: weekStart, end: weekEnd }),
            month: startOfMonth(weekStart),
          };
        });
      case "month":
        return eachMonthOfInterval({ start: dateRange.start, end: dateRange.end }).map((monthStart) => {
          const monthEnd = endOfMonth(monthStart);
          return {
            key: format(monthStart, "yyyy-MM"),
            label: format(monthStart, "MMM", { locale: dateLocale }),
            start: monthStart,
            end: monthEnd,
            containsToday: isWithinInterval(today, { start: monthStart, end: monthEnd }),
            month: monthStart,
          };
        });
    }
  }, [dateRange, viewMode, dateLocale]);

  // Build includes based on visibility
  const includes = useMemo(() => {
    const parts: string[] = [];
    if (visibility.phases) parts.push("phases");
    if (visibility.team) parts.push("allocations");
    if (visibility.burndown) parts.push("burndown");
    if (visibility.conflicts) parts.push("conflicts");
    return parts.join(",");
  }, [visibility]);

  // Fetch data from enriched timeline endpoint
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        startDate: format(dateRange.start, "yyyy-MM-dd"),
        endDate: format(dateRange.end, "yyyy-MM-dd"),
        status: statusFilter,
      });
      if (includes) params.set("include", includes);
      if (clientFilter && clientFilter !== "all") params.set("client", clientFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/projects/timeline?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch timeline data");

      const data = await res.json();
      setProjects(data.projects || []);
      setMilestones(data.milestones || []);
      setPhases(data.phases || []);
      setConflicts(data.conflicts || []);
    } catch (error) {
      console.error("Error fetching timeline data:", error);
      toast.error(t("fetchError") || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [dateRange, includes, clientFilter, statusFilter, debouncedSearch, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Navigation
  const goToPrevious = () => setCurrentDate((d) => subMonths(d, 1));
  const goToNext = () => setCurrentDate((d) => addMonths(d, 1));
  const goToToday = () => setCurrentDate(new Date());

  // Unique clients for filter
  const clients = useMemo(() => {
    const uniqueClients = new Set<string>();
    projects.forEach((p) => {
      if (p.client) uniqueClients.add(p.client);
    });
    return Array.from(uniqueClients).sort();
  }, [projects]);

  // Update project dates (from drag)
  const handleUpdateProjectDates = async (
    projectId: string,
    startDate: string | null,
    endDate: string | null
  ) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate }),
      });
      if (!res.ok) throw new Error("Failed to update project");
      toast.success(t("projectUpdated") || "Project dates updated");
      fetchData();
    } catch (error) {
      console.error("Error updating project:", error);
      toast.error(t("updateError") || "Failed to update project");
    }
  };

  // Update milestone date (from drag)
  const handleUpdateMilestoneDate = async (
    milestoneId: string,
    projectId: string,
    dueDate: string
  ) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/milestones`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestoneId, dueDate }),
      });
      if (!res.ok) throw new Error("Failed to update milestone");
      toast.success(t("milestoneUpdated") || "Milestone updated");
      fetchData();
    } catch (error) {
      console.error("Error updating milestone:", error);
      toast.error(t("updateError") || "Failed to update milestone");
    }
  };

  // Save milestone (from popover)
  const handleSaveMilestone = async (data: {
    projectId: string;
    milestoneId?: string;
    title: string;
    dueDate: string;
    completed?: boolean;
  }) => {
    try {
      if (data.milestoneId) {
        const res = await fetch(`/api/projects/${data.projectId}/milestones`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            milestoneId: data.milestoneId,
            title: data.title,
            dueDate: data.dueDate,
            completed: data.completed,
          }),
        });
        if (!res.ok) throw new Error("Failed to update milestone");
        toast.success(t("milestoneUpdated") || "Milestone updated");
      } else {
        const res = await fetch(`/api/projects/${data.projectId}/milestones`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: data.title, dueDate: data.dueDate }),
        });
        if (!res.ok) throw new Error("Failed to create milestone");
        toast.success(t("milestoneCreated") || "Milestone created");
      }
      fetchData();
    } catch (error) {
      console.error("Error saving milestone:", error);
      toast.error(t("saveError") || "Failed to save milestone");
    }
  };

  // Delete milestone
  const handleDeleteMilestone = async (milestoneId: string, projectId: string) => {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/milestones?milestoneId=${milestoneId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete milestone");
      toast.success(t("milestoneDeleted") || "Milestone deleted");
      fetchData();
    } catch (error) {
      console.error("Error deleting milestone:", error);
      toast.error(t("deleteError") || "Failed to delete milestone");
    }
  };

  // Auto-populate phases for a project
  const handleAutoPopulatePhases = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/project-phases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "auto-populate" }),
      });
      if (!res.ok) throw new Error("Failed to auto-populate phases");
      toast.success(t("phaseDateUpdated") || "Phase dates created");
      fetchData();
    } catch (error) {
      console.error("Error auto-populating phases:", error);
      toast.error(t("updateError") || "Failed to create phase dates");
    }
  };

  // Scroll to a project row
  const handleConflictClick = (projectId: string) => {
    const row = document.getElementById(`project-row-${projectId}`);
    if (row) {
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      row.classList.add("bg-amber-50", "dark:bg-amber-950/30");
      setTimeout(() => {
        row.classList.remove("bg-amber-50", "dark:bg-amber-950/30");
      }, 2000);
    }
  };

  const dateRangeLabel = `${format(dateRange.start, "MMM yyyy", { locale: dateLocale })} - ${format(dateRange.end, "MMM yyyy", { locale: dateLocale })}`;

  if (loading && projects.length === 0) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      {/* Controls */}
      <TimelineFilters
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        currentSpan={currentSpan}
        spanConfig={spanConfig[viewMode]}
        onSpanChange={(v) => setSpans((s) => ({ ...s, [viewMode]: v }))}
        clients={clients}
        selectedClient={clientFilter}
        onClientChange={setClientFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        search={search}
        onSearchChange={setSearch}
        visibility={visibility}
        onVisibilityChange={setVisibility}
        onPrevious={goToPrevious}
        onNext={goToNext}
        onToday={goToToday}
        dateRangeLabel={dateRangeLabel}
      />

      {/* Timeline Grid */}
      <Card>
        <CardContent className="p-0">
          <TimelineGrid
            projects={projects}
            milestones={milestones}
            columns={columns}
            viewMode={viewMode}
            dateRange={dateRange}
            visibility={visibility}
            conflicts={conflicts}
            onUpdateProjectDates={handleUpdateProjectDates}
            onUpdateMilestoneDate={handleUpdateMilestoneDate}
            onSaveMilestone={handleSaveMilestone}
            onDeleteMilestone={handleDeleteMilestone}
            onAutoPopulatePhases={handleAutoPopulatePhases}
          />
        </CardContent>
      </Card>

      {/* Conflict Panel */}
      {visibility.conflicts && conflicts.length > 0 && (
        <ConflictPanel
          conflicts={conflicts}
          onConflictClick={handleConflictClick}
        />
      )}
    </div>
  );
}
