"use client";

import { useMemo, useState, useCallback, useRef, Fragment } from "react";
import { format, isSameMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { useDateLocale, useTranslations } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Plus, Diamond, CheckCircle, ChevronRight, ChevronDown } from "lucide-react";
import { ProjectBar } from "./ProjectBar";
import { AllocationSubRow } from "./AllocationSubRow";
import { BurndownSparkline } from "./BurndownSparkline";
import { MilestonePopover } from "./MilestonePopover";
import { useTimelineDrag } from "./useTimelineDrag";
import type {
  TimelineProject,
  TimelineMilestone,
  TimelineColumn,
  TimelineConflict,
  TimelineViewMode,
  VisibilityToggles,
  DragResult,
} from "./types";

interface TimelineGridProps {
  projects: TimelineProject[];
  milestones: TimelineMilestone[];
  columns: TimelineColumn[];
  viewMode: TimelineViewMode;
  dateRange: { start: Date; end: Date };
  visibility: VisibilityToggles;
  conflicts: TimelineConflict[];
  onUpdateProjectDates: (projectId: string, startDate: string | null, endDate: string | null) => void;
  onUpdateMilestoneDate: (milestoneId: string, projectId: string, dueDate: string) => void;
  onSaveMilestone: (data: { projectId: string; milestoneId?: string; title: string; dueDate: string; completed?: boolean }) => void;
  onDeleteMilestone: (milestoneId: string, projectId: string) => void;
  onAutoPopulatePhases: (projectId: string) => void;
}

export function TimelineGrid({
  projects,
  milestones,
  columns,
  viewMode,
  dateRange,
  visibility,
  conflicts,
  onUpdateProjectDates,
  onUpdateMilestoneDate,
  onSaveMilestone,
  onDeleteMilestone,
  onAutoPopulatePhases,
}: TimelineGridProps) {
  const dateLocale = useDateLocale();
  const t = useTranslations("timeline");

  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const lastDragEndRef = useRef(0);

  const [milestonePopover, setMilestonePopover] = useState<{
    open: boolean;
    position: { top: number; left: number } | null;
    milestone: TimelineMilestone | null;
    projectId: string;
    projectColor: string;
    defaultDate?: string;
  }>({ open: false, position: null, milestone: null, projectId: "", projectColor: "" });

  // Preview dates during drag
  const [previewDates, setPreviewDates] = useState<Record<string, { start: Date; end: Date }>>({});

  // Drag handler
  const handleDragEnd = useCallback((result: DragResult) => {
    setPreviewDates({});
    lastDragEndRef.current = Date.now();

    if (result.type === "milestone" && result.newDate) {
      onUpdateMilestoneDate(result.entityId, result.projectId, format(result.newDate, "yyyy-MM-dd"));
    } else if (result.newStart && result.newEnd) {
      onUpdateProjectDates(
        result.projectId,
        format(result.newStart, "yyyy-MM-dd"),
        format(result.newEnd, "yyyy-MM-dd")
      );
    }
  }, [onUpdateProjectDates, onUpdateMilestoneDate]);

  const { dragState, startDrag, isDragging, previewDates: dragPreview } = useTimelineDrag({
    columns,
    viewMode,
    onDragEnd: handleDragEnd,
  });

  // Update preview dates during drag
  // (We use the drag hook's previewDates directly in rendering instead)

  // Group milestones by project
  const milestonesByProject = useMemo(() => {
    const map: Record<string, TimelineMilestone[]> = {};
    milestones.forEach((m) => {
      if (!map[m.projectId]) map[m.projectId] = [];
      map[m.projectId].push(m);
    });
    return map;
  }, [milestones]);

  // Budget health
  const getBudgetHealth = (project: TimelineProject) => {
    if (!project.budgetHours || project.budgetHours === 0) return null;
    const percentage = (project.hoursUsed / project.budgetHours) * 100;
    if (percentage >= 100) return "red";
    if (percentage >= 80) return "yellow";
    return "green";
  };

  // Check if column overlaps with project date range (with drag preview support)
  const getProjectDates = (project: TimelineProject): { start: Date | null; end: Date | null } => {
    // If this project is being dragged, use preview dates
    if (dragState && dragPreview && dragState.projectId === project.id && dragState.type !== "milestone") {
      return { start: dragPreview.start, end: dragPreview.end };
    }
    return {
      start: project.startDate ? new Date(project.startDate + "T00:00:00") : null,
      end: project.endDate ? new Date(project.endDate + "T00:00:00") : null,
    };
  };

  const isColumnInProject = (project: TimelineProject, col: TimelineColumn) => {
    const { start, end } = getProjectDates(project);
    if (!start && !end) return false;
    if (start && end) return col.start <= end && col.end >= start;
    if (start) return col.end >= start;
    if (end) return col.start <= end;
    return false;
  };

  const isProjectStartCol = (project: TimelineProject, col: TimelineColumn) => {
    const { start } = getProjectDates(project);
    if (!start) return false;
    return start >= col.start && start <= col.end;
  };

  const isProjectEndCol = (project: TimelineProject, col: TimelineColumn) => {
    const { end } = getProjectDates(project);
    if (!end) return false;
    return end >= col.start && end <= col.end;
  };

  // Get milestones for a column (with drag preview for milestone being dragged)
  const getMilestonesForColumn = (projectId: string, col: TimelineColumn) => {
    const projectMilestones = milestonesByProject[projectId] || [];
    return projectMilestones.filter((m) => {
      let dueDate: Date;
      if (dragState && dragPreview && dragState.type === "milestone" && dragState.entityId === m.id) {
        dueDate = dragPreview.start;
      } else {
        dueDate = new Date(m.dueDate + "T00:00:00");
      }
      return dueDate >= col.start && dueDate <= col.end;
    });
  };

  // Generate group headers
  const groupHeaders = useMemo(() => {
    if (viewMode === "month") {
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

  const toggleExpand = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const handleMilestoneClick = (milestone: TimelineMilestone, project: TimelineProject, e: React.MouseEvent) => {
    e.stopPropagation();
    // Skip if a drag just ended (prevents popover opening after drag)
    if (Date.now() - lastDragEndRef.current < 200) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMilestonePopover({
      open: true,
      position: { top: rect.bottom + 4, left: rect.left - 100 },
      milestone,
      projectId: project.id,
      projectColor: project.color,
    });
  };

  const handleEmptyCellClick = (project: TimelineProject, col: TimelineColumn, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMilestonePopover({
      open: true,
      position: { top: rect.bottom + 4, left: rect.left - 100 },
      milestone: null,
      projectId: project.id,
      projectColor: project.color,
      defaultDate: format(col.start, "yyyy-MM-dd"),
    });
  };

  const hasExpandableContent = (project: TimelineProject) => {
    return (visibility.team && project.allocations && project.allocations.length > 0) ||
           (visibility.burndown && project.budgetHours);
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse table-fixed">
          <colgroup>
            <col className="w-[220px]" />
          </colgroup>

          <thead>
            {/* Group headers */}
            <tr>
              <th className="sticky left-0 z-20 bg-card border-b border-r border-border p-3 text-left w-[220px]" rowSpan={2}>
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
              {/* Capacity placeholder */}
              <th className="sticky right-0 z-20 bg-card border-b border-l border-border w-[60px]" rowSpan={2} />
            </tr>

            {/* Column headers */}
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  data-timeline-col
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

          <tbody>
            {projects.map((project) => {
              const budgetHealth = getBudgetHealth(project);
              const isExpanded = expandedProjects.has(project.id);
              const canExpand = hasExpandableContent(project);
              const isDraggingThis = isDragging && dragState?.projectId === project.id;

              return (
                <Fragment key={project.id}>
                  {/* Main project row */}
                  <tr className="group" id={`project-row-${project.id}`}>
                    {/* Project Info */}
                    <td className="sticky left-0 z-10 bg-card border-b border-r border-border p-2">
                      <div className="flex items-center gap-1.5">
                        {/* Expand toggle */}
                        {canExpand ? (
                          <button
                            className="p-0.5 rounded hover:bg-muted shrink-0"
                            onClick={() => toggleExpand(project.id)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </button>
                        ) : (
                          <div className="w-[18px]" />
                        )}

                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: project.color }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate leading-tight">{project.name}</p>
                          {project.client && (
                            <p className="text-[10px] text-muted-foreground truncate leading-tight">{project.client}</p>
                          )}
                        </div>

                        {/* Budget badge */}
                        {budgetHealth && (
                          <div className="flex items-center gap-1 shrink-0">
                            <div className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              budgetHealth === "green" && "bg-green-500",
                              budgetHealth === "yellow" && "bg-yellow-500",
                              budgetHealth === "red" && "bg-red-500"
                            )} />
                            <span className="text-[9px] text-muted-foreground">
                              {project.hoursUsed.toFixed(0)}/{project.budgetHours}t
                            </span>
                          </div>
                        )}

                        {/* Current phase badge */}
                        {project.currentPhase && (
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded-full shrink-0 text-white truncate max-w-[60px]"
                            style={{ backgroundColor: project.currentPhase.color + "cc" }}
                            title={project.currentPhase.name}
                          >
                            {project.currentPhase.name}
                          </span>
                        )}

                        {/* Add milestone button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity shrink-0"
                          aria-label={t("addMilestone") || "Add Milestone"}
                          onClick={() => {
                            setMilestonePopover({
                              open: true,
                              position: { top: 200, left: 400 },
                              milestone: null,
                              projectId: project.id,
                              projectColor: project.color,
                            });
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>

                    {/* Column cells */}
                    {columns.map((col) => {
                      const inProject = isColumnInProject(project, col);
                      const isStart = isProjectStartCol(project, col);
                      const isEnd = isProjectEndCol(project, col);
                      const colMilestones = getMilestonesForColumn(project.id, col);

                      return (
                        <td
                          key={col.key}
                          data-timeline-col
                          className={cn(
                            "border-b border-r border-border p-0 h-[44px] relative",
                            col.containsToday && "bg-brand-50/50 dark:bg-brand-950/50"
                          )}
                        >
                          {/* Project bar */}
                          {inProject && (
                            <ProjectBar
                              projectColor={project.color}
                              isStart={isStart}
                              isEnd={isEnd}
                              showPhases={visibility.phases}
                              phaseSegments={project.projectPhases || []}
                              columnStart={col.start}
                              columnEnd={col.end}
                              isDragging={isDraggingThis && dragState?.type !== "milestone"}
                              onResizeStartLeft={(e) => {
                                if (!project.startDate || !project.endDate) return;
                                startDrag("resize-start", project.id, project.id, e.clientX, new Date(project.startDate + "T00:00:00"), new Date(project.endDate + "T00:00:00"));
                              }}
                              onResizeStartRight={(e) => {
                                if (!project.startDate || !project.endDate) return;
                                startDrag("resize-end", project.id, project.id, e.clientX, new Date(project.startDate + "T00:00:00"), new Date(project.endDate + "T00:00:00"));
                              }}
                              onMoveStart={(e) => {
                                if (!project.startDate || !project.endDate) return;
                                startDrag("move", project.id, project.id, e.clientX, new Date(project.startDate + "T00:00:00"), new Date(project.endDate + "T00:00:00"));
                              }}
                            />
                          )}

                          {/* Milestone markers */}
                          {colMilestones.length === 1 && (
                            <button
                              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
                              onClick={(e) => handleMilestoneClick(colMilestones[0], project, e)}
                              onMouseDown={(e) => {
                                if (e.button !== 0) return;
                                e.stopPropagation();
                                const ms = colMilestones[0];
                                startDrag("milestone", ms.id, project.id, e.clientX, new Date(ms.dueDate + "T00:00:00"), new Date(ms.dueDate + "T00:00:00"));
                              }}
                              title={colMilestones[0].title}
                            >
                              {colMilestones[0].completed ? (
                                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" fill="currentColor" />
                              ) : (
                                <Diamond className="h-4 w-4" style={{ color: project.color }} fill="currentColor" />
                              )}
                            </button>
                          )}
                          {colMilestones.length > 1 && (
                            <button
                              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex items-center gap-0.5"
                              onClick={(e) => handleMilestoneClick(colMilestones[0], project, e)}
                              title={colMilestones.map((m) => m.title).join(", ")}
                            >
                              <Diamond className="h-4 w-4" style={{ color: project.color }} fill="currentColor" />
                              <span className="text-[9px] font-bold text-muted-foreground">+{colMilestones.length - 1}</span>
                            </button>
                          )}

                          {/* Click empty area to add milestone */}
                          {!inProject && colMilestones.length === 0 && (
                            <button
                              className="absolute inset-0 opacity-0 hover:opacity-100 flex items-center justify-center"
                              onClick={(e) => handleEmptyCellClick(project, col, e)}
                            >
                              <Plus className="h-3 w-3 text-muted-foreground/40" />
                            </button>
                          )}

                          {/* Today line */}
                          {col.containsToday && (
                            <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-red-500 z-[5]" />
                          )}
                        </td>
                      );
                    })}

                    {/* Right capacity column placeholder */}
                    <td className="sticky right-0 z-10 bg-card border-b border-l border-border w-[60px]">
                      {project.budgetHours ? (
                        <div className="p-1 text-center">
                          <div className="text-[9px] text-muted-foreground">
                            {Math.round((project.hoursUsed / project.budgetHours) * 100)}%
                          </div>
                          <div className="h-1 rounded-full bg-muted mt-0.5">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                getBudgetHealth(project) === "green" && "bg-green-500",
                                getBudgetHealth(project) === "yellow" && "bg-yellow-500",
                                getBudgetHealth(project) === "red" && "bg-red-500"
                              )}
                              style={{ width: `${Math.min(100, (project.hoursUsed / project.budgetHours) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ) : null}
                    </td>
                  </tr>

                  {/* Expanded sub-rows: allocations */}
                  {isExpanded && visibility.team && project.allocations?.map((alloc) => (
                    <AllocationSubRow
                      key={alloc.id}
                      allocation={alloc}
                      projectColor={project.color}
                      columns={columns}
                      conflicts={conflicts}
                    />
                  ))}

                  {/* Expanded sub-rows: burndown */}
                  {isExpanded && visibility.burndown && (
                    <BurndownSparkline
                      burndownData={project.burndown || []}
                      budgetHours={project.budgetHours}
                      projectColor={project.color}
                      columns={columns}
                    />
                  )}

                  {/* Auto-populate phases hint */}
                  {isExpanded && visibility.phases && project.startDate && project.endDate &&
                   (!project.projectPhases || project.projectPhases.length === 0) && (
                    <tr className="bg-muted/5">
                      <td className="sticky left-0 z-10 bg-card border-b border-r border-border p-2 min-w-[220px]" />
                      <td colSpan={columns.length} className="border-b border-border p-2">
                        <button
                          className="text-[10px] text-brand-600 dark:text-brand-400 hover:underline"
                          onClick={() => onAutoPopulatePhases(project.id)}
                        >
                          {t("autoPopulatePhases") || "Auto-populate phase dates"}
                        </button>
                      </td>
                      <td className="border-b border-l border-border" />
                    </tr>
                  )}
                </Fragment>
              );
            })}

            {projects.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className="text-center py-12 text-muted-foreground">
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

      {/* Milestone popover */}
      <MilestonePopover
        open={milestonePopover.open}
        position={milestonePopover.position}
        milestone={milestonePopover.milestone}
        projectId={milestonePopover.projectId}
        projectColor={milestonePopover.projectColor}
        defaultDate={milestonePopover.defaultDate}
        onSave={async (data) => {
          await onSaveMilestone(data);
          setMilestonePopover((p) => ({ ...p, open: false }));
        }}
        onDelete={(milestoneId, projectId) => {
          onDeleteMilestone(milestoneId, projectId);
          setMilestonePopover((p) => ({ ...p, open: false }));
        }}
        onClose={() => setMilestonePopover((p) => ({ ...p, open: false }))}
      />
    </>
  );
}
