"use client";

import { useMemo } from "react";
import { format, isToday, isSameMonth, isSameDay, differenceInDays, isBefore, isAfter } from "date-fns";
import { cn } from "@/lib/utils";
import { useDateLocale, useTranslations } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Plus, Diamond, CheckCircle } from "lucide-react";

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

interface TimelineGridProps {
  projects: Project[];
  milestones: Milestone[];
  days: Date[];
  dateRange: { start: Date; end: Date };
  onAddMilestone: (project: Project) => void;
  onEditMilestone: (milestone: Milestone) => void;
  onUpdateProjectDates: (projectId: string, startDate: string | null, endDate: string | null) => void;
}

export function TimelineGrid({
  projects,
  milestones,
  days,
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

  // Calculate budget health (percentage used)
  const getBudgetHealth = (project: Project) => {
    if (!project.budgetHours || project.budgetHours === 0) return null;
    const percentage = (project.hoursUsed / project.budgetHours) * 100;
    if (percentage >= 100) return "red";
    if (percentage >= 80) return "yellow";
    return "green";
  };

  // Check if a day is within project date range
  const isDayInProject = (project: Project, day: Date) => {
    if (!project.startDate && !project.endDate) return false;
    const start = project.startDate ? new Date(project.startDate) : null;
    const end = project.endDate ? new Date(project.endDate) : null;

    if (start && end) {
      return day >= start && day <= end;
    } else if (start) {
      return day >= start;
    } else if (end) {
      return day <= end;
    }
    return false;
  };

  // Check if this is project start/end day
  const isProjectStart = (project: Project, day: Date) => {
    if (!project.startDate) return false;
    return isSameDay(new Date(project.startDate), day);
  };

  const isProjectEnd = (project: Project, day: Date) => {
    if (!project.endDate) return false;
    return isSameDay(new Date(project.endDate), day);
  };

  // Get milestone for a specific day
  const getMilestoneForDay = (projectId: string, day: Date) => {
    const projectMilestones = milestonesByProject[projectId] || [];
    return projectMilestones.find((m) => isSameDay(new Date(m.dueDate), day));
  };

  // Generate month headers
  const monthHeaders = useMemo(() => {
    const months: { month: Date; colSpan: number; startIndex: number }[] = [];
    let currentMonth: Date | null = null;
    let count = 0;
    let startIndex = 0;

    days.forEach((day, index) => {
      if (!currentMonth || !isSameMonth(day, currentMonth)) {
        if (currentMonth) {
          months.push({ month: currentMonth, colSpan: count, startIndex });
        }
        currentMonth = day;
        count = 1;
        startIndex = index;
      } else {
        count++;
      }
    });

    if (currentMonth) {
      months.push({ month: currentMonth, colSpan: count, startIndex });
    }

    return months;
  }, [days]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse min-w-[1000px]">
        {/* Month Headers */}
        <thead>
          <tr>
            <th className="sticky left-0 z-20 bg-card border-b border-r border-border p-3 text-left min-w-[200px]" rowSpan={2}>
              <span className="text-sm font-medium text-muted-foreground">{t("project") || "Project"}</span>
            </th>
            {monthHeaders.map(({ month, colSpan }, idx) => (
              <th
                key={idx}
                colSpan={colSpan}
                className="border-b border-r border-border p-2 text-center bg-muted/30"
              >
                <span className="text-sm font-semibold">
                  {format(month, "MMMM yyyy", { locale: dateLocale })}
                </span>
              </th>
            ))}
          </tr>

          {/* Day Headers */}
          <tr>
            {days.map((day) => (
              <th
                key={day.toISOString()}
                className={cn(
                  "border-b border-r border-border p-1 text-center min-w-[24px] max-w-[24px]",
                  isToday(day) && "bg-brand-50 dark:bg-brand-950"
                )}
              >
                <span className={cn(
                  "text-[10px] font-medium",
                  isToday(day) ? "text-brand-600 dark:text-brand-400" : "text-muted-foreground"
                )}>
                  {format(day, "d")}
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

                {/* Day Cells */}
                {days.map((day) => {
                  const inProject = isDayInProject(project, day);
                  const isStart = isProjectStart(project, day);
                  const isEnd = isProjectEnd(project, day);
                  const milestone = getMilestoneForDay(project.id, day);

                  return (
                    <td
                      key={day.toISOString()}
                      className={cn(
                        "border-b border-r border-border p-0 h-[40px] relative",
                        isToday(day) && "bg-brand-50/30 dark:bg-brand-950/30"
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

                      {/* Milestone Marker */}
                      {milestone && (
                        <button
                          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
                          onClick={() => onEditMilestone(milestone)}
                          title={milestone.title}
                        >
                          {milestone.completed ? (
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

                      {/* Today Line */}
                      {isToday(day) && (
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
              <td colSpan={days.length + 1} className="text-center py-12 text-muted-foreground">
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
