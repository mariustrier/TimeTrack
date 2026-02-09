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
import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { useTranslations, useDateLocale } from "@/lib/i18n";
import { TimelineGrid } from "@/components/project-timeline/TimelineGrid";
import { MilestoneDialog } from "@/components/project-timeline/MilestoneDialog";
import { TimelineViewControls, type TimelineViewMode } from "@/components/project-timeline/TimelineViewControls";

export interface Project {
  id: string;
  name: string;
  color: string;
  client: string | null;
  startDate: string | null;
  endDate: string | null;
  budgetHours: number | null;
  hoursUsed: number;
  archived: boolean;
}

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  dueDate: string;
  completed: boolean;
  completedAt: string | null;
  sortOrder: number;
}

export interface TimelineColumn {
  key: string;
  label: string;
  start: Date;
  end: Date;
  containsToday: boolean;
  month: Date;
}

export function ProjectTimeline() {
  const t = useTranslations("timeline");
  const dateLocale = useDateLocale();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<TimelineViewMode>("day");
  const [spans, setSpans] = useState<Record<TimelineViewMode, number>>({ day: 3, week: 6, month: 12 });

  const spanConfig: Record<TimelineViewMode, { min: number; max: number; step: number }> = {
    day: { min: 1, max: 6, step: 1 },
    week: { min: 2, max: 12, step: 1 },
    month: { min: 6, max: 24, step: 3 },
  };

  const currentSpan = spans[viewMode];
  const { min, max, step } = spanConfig[viewMode];

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);

  // Calculate visible date range based on view mode and span
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

  // Generate columns based on view mode
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

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const projectsRes = await fetch("/api/projects");
      if (!projectsRes.ok) throw new Error("Failed to fetch projects");

      const projectsData = await projectsRes.json();
      const activeProjects = projectsData.filter((p: Project) => !p.archived);
      setProjects(activeProjects);

      // Fetch milestones for all projects
      const milestonePromises = activeProjects.map((p: Project) =>
        fetch(`/api/projects/${p.id}/milestones`).then((r) => r.json())
      );
      const allMilestones = await Promise.all(milestonePromises);
      setMilestones(allMilestones.flat());
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error(t("fetchError") || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Navigation - step size adapts to span
  const navStep = Math.max(1, Math.ceil(currentSpan / 3));
  const goToPrevious = () => setCurrentDate((d) => subMonths(d, navStep));
  const goToNext = () => setCurrentDate((d) => addMonths(d, navStep));
  const goToToday = () => setCurrentDate(new Date());

  // Milestone handlers
  const handleAddMilestone = (project: Project) => {
    setSelectedProject(project);
    setSelectedMilestone(null);
    setDialogOpen(true);
  };

  const handleEditMilestone = (milestone: Milestone) => {
    const project = projects.find((p) => p.id === milestone.projectId);
    setSelectedProject(project || null);
    setSelectedMilestone(milestone);
    setDialogOpen(true);
  };

  const handleSaveMilestone = async (data: {
    projectId: string;
    title: string;
    dueDate: string;
    completed?: boolean;
  }) => {
    try {
      if (selectedMilestone) {
        // Update existing
        const res = await fetch(`/api/projects/${data.projectId}/milestones`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            milestoneId: selectedMilestone.id,
            title: data.title,
            dueDate: data.dueDate,
            completed: data.completed,
          }),
        });
        if (!res.ok) throw new Error("Failed to update milestone");
        toast.success(t("milestoneUpdated") || "Milestone updated");
      } else {
        // Create new
        const res = await fetch(`/api/projects/${data.projectId}/milestones`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: data.title,
            dueDate: data.dueDate,
          }),
        });
        if (!res.ok) throw new Error("Failed to create milestone");
        toast.success(t("milestoneCreated") || "Milestone created");
      }

      setDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error saving milestone:", error);
      toast.error(t("saveError") || "Failed to save milestone");
    }
  };

  const handleDeleteMilestone = async (milestoneId: string, projectId: string) => {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/milestones?milestoneId=${milestoneId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete milestone");
      toast.success(t("milestoneDeleted") || "Milestone deleted");
      setDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error deleting milestone:", error);
      toast.error(t("deleteError") || "Failed to delete milestone");
    }
  };

  // Update project dates
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

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <TimelineViewControls viewMode={viewMode} onViewModeChange={setViewMode} />
          <div className="flex items-center gap-2">
            <Slider
              value={[currentSpan]}
              onValueChange={([v]) => setSpans((s) => ({ ...s, [viewMode]: v }))}
              min={min}
              max={max}
              step={step}
              className="w-[100px]"
            />
            <span className="text-xs text-muted-foreground w-10 text-right">{currentSpan} {t("months") || "mo"}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={goToPrevious}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={goToToday}>
              {t("today") || "Today"}
            </Button>
            <Button variant="outline" size="icon" onClick={goToNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <span className="text-sm font-medium text-muted-foreground">
            {format(dateRange.start, "MMM yyyy", { locale: dateLocale })} - {format(dateRange.end, "MMM yyyy", { locale: dateLocale })}
          </span>
        </div>
      </div>

      {/* Timeline Grid */}
      <Card>
        <CardContent className="p-0">
          <TimelineGrid
            projects={projects}
            milestones={milestones}
            columns={columns}
            viewMode={viewMode}
            dateRange={dateRange}
            onAddMilestone={handleAddMilestone}
            onEditMilestone={handleEditMilestone}
            onUpdateProjectDates={handleUpdateProjectDates}
          />
        </CardContent>
      </Card>

      {/* Milestone Dialog */}
      <MilestoneDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        project={selectedProject}
        milestone={selectedMilestone}
        onSave={handleSaveMilestone}
        onDelete={handleDeleteMilestone}
      />
    </div>
  );
}
