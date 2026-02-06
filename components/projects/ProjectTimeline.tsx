"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isToday,
  differenceInDays,
  isBefore,
  isAfter,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
  GanttChart,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTranslations, useDateLocale } from "@/lib/i18n";
import { TimelineGrid } from "@/components/project-timeline/TimelineGrid";
import { MilestoneDialog } from "@/components/project-timeline/MilestoneDialog";

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

export function ProjectTimeline() {
  const t = useTranslations("timeline");
  const dateLocale = useDateLocale();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);

  // Calculate visible date range (3 months centered on current)
  const dateRange = useMemo(() => {
    const start = startOfMonth(subMonths(currentDate, 1));
    const end = endOfMonth(addMonths(currentDate, 1));
    return { start, end };
  }, [currentDate]);

  const days = useMemo(() => {
    return eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
  }, [dateRange]);

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

  // Navigation
  const goToPrevious = () => setCurrentDate((d) => subMonths(d, 1));
  const goToNext = () => setCurrentDate((d) => addMonths(d, 1));
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
            days={days}
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
