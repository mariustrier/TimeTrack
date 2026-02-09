"use client";

import { useMemo } from "react";
import { format, isSameMonth, isSameYear } from "date-fns";
import { cn } from "@/lib/utils";
import { useDateLocale, useTranslations } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Plus, Diamond, CheckCircle } from "lucide-react";
import type { TimelineViewMode } from "@/components/project-timeline/TimelineViewControls";

interface Project {
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

interface Milestone {
  id: string;
  projectId: string;
  title: string;
  dueDate: string;
  completed: boolean;
  completedAt: string | null;
  sortOrder: number;
}

interface TimelineColumn {
  key: string;
  label: string;
  start: Date;
  end: Date;
  containsToday: boolean;
  month: Date;
}

interface TimelineGridProps {
  projects: Project[];
  milestones: Milestone[];
  columns: TimelineColumn[];
  viewMode: TimelineViewMode;
  dateRange: { start: Date; end: Date };
  onAddMilestone: (project: Project) => void;
  onEditMilestone: (milestone: Milestone) => void;
  onUpdateProjectDates: (projectId: string, startDate: string | null, endDate: string | null) => void;
}

export function TimelineGrid({
  projects,
  milestones,
  columns,
  viewMode,
  dateRange,
  onAddMilestone,
  onEditMilestone,
  onUpdateProjectDates,
}: TimelineGridProps) {
  const dateLocale = useDateLocale();
  const t = useTranslations("timeline");

  // Group milestones by project
  const milestonesByProject = useMemo(() => {
    const map: Record<string, Milestone[]> = {};
    milestones.forEach((m) => {
      if (!map[m.projectId]) map[m.projectId] = [];
      map[m.projectId].push(m);
    });
    return map;
  }, [milestones]);

  // Budget health
  const getBudgetHealth = (project: Project) => {
    if (!project.budgetHours || project.budgetHours === 0) return null;
    const percentage = (project.hoursUsed / project.budgetHours) * 100;
    if (percentage >= 100) return "red";
    if (percentage >= 80) return "yellow";
    return "green";
  };

  // Check if column overlaps with project date range
  const isColumnInProject = (project: Project, col: TimelineColumn) => {
    if (!project.startDate && !project.endDate) return false;
    const start = project.startDate ? new Date(project.startDate) : null;
    const end = project.endDate ? new Date(project.endDate) : null;

    if (start && end) {
      return col.start <= end && col.end >= start;
    } else if (start) {
      return col.end >= start;
    } else if (end) {
      return col.start <= end;
    }
    return false;
  };

  // Check if project starts/ends within this column
  const isProjectStartCol = (project: Project, col: TimelineColumn) => {
    if (!project.startDate) return false;
    const start = new Date(project.startDate);
    return start >= col.start && start <= col.end;
  };

  const isProjectEndCol = (project: Project, col: TimelineColumn) => {
    if (!project.endDate) return false;
    const end = new Date(project.endDate);
    return end >= col.start && end <= col.end;
  };

  // Get milestones that fall within a column
  const getMilestonesForColumn = (projectId: string, col: TimelineColumn) => {
    const projectMilestones = milestonesByProject[projectId] || [];
    return projectMilestones.filter((m) => {
      const due = new Date(m.dueDate);
      return due >= col.start && due <= col.end;
    });
  };

  // Generate group headers (months for day/week, years for month view)
  const groupHeaders = useMemo(() => {
    if (viewMode === "month") {
      // Group by year
      const groups: { label: string; colSpan: number }[] = [];
      let currentYear: number | null = null;
      let count = 0;

      columns.forEach((col) => {
        const year = col.start.getFullYear();
        if (currentYear !== year) {
          if (currentYear !== null) groups.push({ label: String(currentYear), colSpan: count });
          currentYear = year;
          count = 1;
        } else {
          count++;
        }
      });
      if (currentYear !== null) groups.push({ label: String(currentYear), colSpan: count });
      return groups;
    }

    // Group by month for day/week views
    const groups: { label: string; colSpan: number }[] = [];
    let currentMonth: Date | null = null;
    let count = 0;

    columns.forEach((col) => {
      if (!currentMonth || !isSameMonth(col.start, currentMonth)) {
        if (currentMonth) {
          groups.push({
            label: format(currentMonth, "MMMM yyyy", { locale: dateLocale }),
            colSpan: count,
          });
        }
        currentMonth = col.start;
        count = 1;
      } else {
        count++;
      }
    });
    if (currentMonth) {
      groups.push({
        label: format(currentMonth, "MMMM yyyy", { locale: dateLocale }),
        colSpan: count,
      });
    }
    return groups;
  }, [columns, viewMode, dateLocale]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse table-fixed">
        <colgroup>
          <col className="w-[200px]" />
        </colgroup>
        {/* Group Headers + Column Headers */}
        <thead>
          <tr>
            <th className="sticky left-0 z-20 bg-card border-b border-r border-border p-3 text-left w-[200px]" rowSpan={2}>
              <span className="text-sm font-medium text-muted-foreground">{t("project") || "Project"}</span>
            </th>
            {groupHeaders.map(({ label, colSpan }, idx) => (
              <th
                key={idx}
                colSpan={colSpan}
                className="border-b border-r border-border p-2 text-center bg-muted/30"
              >
                <span className="text-sm font-semibold">{label}</span>
              </th>
            ))}
          </tr>

          {/* Column Headers */}
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "border-b border-r border-border p-1 text-center overflow-hidden",
                  col.containsToday && "bg-brand-50 dark:bg-brand-950"
                )}
              >
                <span className={cn(
                  "text-[10px] font-medium",
                  viewMode !== "day" && "text-xs",
                  col.containsToday ? "text-brand-600 dark:text-brand-400" : "text-muted-foreground"
                )}>
                  {col.label}
                </span>
              </th>
            ))}
          </tr>
        </thead>

        {/* Project Rows */}
        <tbody>
          {projects.map((project) => {
            const budgetHealth = getBudgetHealth(project);

            return (
              <tr key={project.id} className="group">
                {/* Project Info */}
                <td className="sticky left-0 z-10 bg-card border-b border-r border-border p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: project.color }}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{project.name}</p>
                        {project.client && (
                          <p className="text-xs text-muted-foreground truncate">{project.client}</p>
                        )}
                      </div>
                      {budgetHealth && (
                        <div className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          budgetHealth === "green" && "bg-green-500",
                          budgetHealth === "yellow" && "bg-yellow-500",
                          budgetHealth === "red" && "bg-red-500"
                        )} title={`${Math.round((project.hoursUsed / (project.budgetHours || 1)) * 100)}% of budget used`} />
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => onAddMilestone(project)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </td>

                {/* Column Cells */}
                {columns.map((col) => {
                  const inProject = isColumnInProject(project, col);
                  const isStart = isProjectStartCol(project, col);
                  const isEnd = isProjectEndCol(project, col);
                  const colMilestones = getMilestonesForColumn(project.id, col);

                  return (
                    <td
                      key={col.key}
                      className={cn(
                        "border-b border-r border-border p-0 h-[40px] relative",
                        col.containsToday && "bg-brand-50/30 dark:bg-brand-950/30"
                      )}
                    >
                      {/* Project Bar */}
                      {inProject && (
                        <div
                          className={cn(
                            "absolute top-1/2 -translate-y-1/2 h-3",
                            isStart ? "left-0 rounded-l-full" : "left-0",
                            isEnd ? "right-0 rounded-r-full" : "right-0"
                          )}
                          style={{ backgroundColor: project.color + "80" }}
                        />
                      )}

                      {/* Milestone Markers */}
                      {colMilestones.length === 1 && (
                        <button
                          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
                          onClick={() => onEditMilestone(colMilestones[0])}
                          title={colMilestones[0].title}
                        >
                          {colMilestones[0].completed ? (
                            <CheckCircle
                              className="h-4 w-4 text-green-600 dark:text-green-400"
                              fill="currentColor"
                            />
                          ) : (
                            <Diamond
                              className="h-4 w-4"
                              style={{ color: project.color }}
                              fill="currentColor"
                            />
                          )}
                        </button>
                      )}
                      {colMilestones.length > 1 && (
                        <button
                          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex items-center gap-0.5"
                          onClick={() => onEditMilestone(colMilestones[0])}
                          title={colMilestones.map((m) => m.title).join(", ")}
                        >
                          <Diamond
                            className="h-4 w-4"
                            style={{ color: project.color }}
                            fill="currentColor"
                          />
                          <span className="text-[9px] font-bold text-muted-foreground">+{colMilestones.length - 1}</span>
                        </button>
                      )}

                      {/* Today Line */}
                      {col.containsToday && (
                        <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-red-500 z-5" />
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}

          {projects.length === 0 && (
            <tr>
              <td colSpan={columns.length + 1} className="text-center py-12 text-muted-foreground">
                {t("noProjects") || "No projects found"}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Legend */}
      <div className="flex items-center gap-6 p-4 border-t border-border text-sm">
        <div className="flex items-center gap-2">
          <Diamond className="h-4 w-4 text-brand-500" fill="currentColor" />
          <span className="text-muted-foreground">{t("milestone") || "Milestone"}</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-500" fill="currentColor" />
          <span className="text-muted-foreground">{t("completed") || "Completed"}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-red-500" />
          <span className="text-muted-foreground">{t("today") || "Today"}</span>
        </div>
        <div className="flex items-center gap-4 ml-auto">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs text-muted-foreground">&lt;80%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <span className="text-xs text-muted-foreground">80-100%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-xs text-muted-foreground">&gt;100%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
