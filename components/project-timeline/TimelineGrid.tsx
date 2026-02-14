"use client";

import { useMemo, useState, useCallback, useRef, Fragment } from "react";
import { format, isSameMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { useDateLocale, useTranslations } from "@/lib/i18n";
import { getToday } from "@/lib/demo-date";
import { Button } from "@/components/ui/button";
import { Plus, Diamond, CheckCircle, ChevronRight, ChevronDown, Flag, Handshake, Rocket, Eye, CalendarDays } from "lucide-react";
import { ProjectBar } from "./ProjectBar";
import { AllocationSubRow } from "./AllocationSubRow";
import { BurndownSparkline } from "./BurndownSparkline";
import { MilestonePopover } from "./MilestonePopover";
import { DeadlinePopover } from "./DeadlinePopover";
import { ActivityGanttSection } from "./ActivityGanttSection";
import { TimelineContextMenu } from "./TimelineContextMenu";
import { useTimelineDrag } from "./useTimelineDrag";
import type {
  TimelineProject,
  TimelineMilestone,
  TimelineColumn,
  TimelineConflict,
  TimelineViewMode,
  VisibilityToggles,
  CompanyPhase,
  DragResult,
  DeadlineIcon,
} from "./types";
import type { LucideIcon } from "lucide-react";

const MILESTONE_ICON_MAP: Record<string, LucideIcon> = {
  flag: Flag,
  handshake: Handshake,
  rocket: Rocket,
  eye: Eye,
  calendar: CalendarDays,
};

interface TimelineGridProps {
  projects: TimelineProject[];
  milestones: TimelineMilestone[];
  columns: TimelineColumn[];
  viewMode: TimelineViewMode;
  dateRange: { start: Date; end: Date };
  visibility: VisibilityToggles;
  conflicts: TimelineConflict[];
  editMode: boolean;
  onUpdateProjectDates: (projectId: string, startDate: string | null, endDate: string | null) => void;
  onUpdateMilestoneDate: (milestoneId: string, projectId: string, dueDate: string) => void;
  onSaveMilestone: (data: {
    projectId: string;
    milestoneId?: string;
    title: string;
    dueDate: string;
    completed?: boolean;
    type?: "phase" | "custom";
    phaseId?: string | null;
    description?: string | null;
    icon?: DeadlineIcon | null;
    color?: string | null;
  }) => void;
  onDeleteMilestone: (milestoneId: string, projectId: string) => void;
  onAutoPopulatePhases: (projectId: string) => void;
  onUpdateActivityDates: (activityId: string, projectId: string, startDate: string, endDate: string) => void;
  teamMembers: Array<{ id: string; name: string; imageUrl: string | null }>;
  companyPhases: CompanyPhase[];
}

export function TimelineGrid({
  projects,
  milestones,
  columns,
  viewMode,
  dateRange,
  visibility,
  conflicts,
  editMode,
  onUpdateProjectDates,
  onUpdateMilestoneDate,
  onSaveMilestone,
  onDeleteMilestone,
  onAutoPopulatePhases,
  onUpdateActivityDates,
  teamMembers,
  companyPhases,
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

  const [deadlinePopover, setDeadlinePopover] = useState<{
    open: boolean;
    position: { top: number; left: number } | null;
    milestone: TimelineMilestone | null;
    projectId: string;
    projectColor: string;
    defaultDate?: string;
  }>({ open: false, position: null, milestone: null, projectId: "", projectColor: "" });

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: "project" | "activity" | "milestone" | "empty";
    entityId?: string;
    projectId?: string;
    date?: Date;
  } | null>(null);

  // Existing phase deadlines per project (for filtering in popover)
  const phaseDeadlinesByProject = useMemo(() => {
    const map: Record<string, string[]> = {};
    milestones.forEach((m) => {
      if (m.type === "phase" && m.phaseId) {
        if (!map[m.projectId]) map[m.projectId] = [];
        map[m.projectId].push(m.phaseId);
      }
    });
    return map;
  }, [milestones]);

  // Preview dates during drag
  const [previewDates, setPreviewDates] = useState<Record<string, { start: Date; end: Date }>>({});

  // Activity date overrides — keeps ActivityGanttSection in sync after drags
  const [activityDateOverrides, setActivityDateOverrides] = useState<Record<string, { startDate: string; endDate: string }>>({});

  // Drag handler
  const handleDragEnd = useCallback((result: DragResult) => {
    setPreviewDates({});
    lastDragEndRef.current = Date.now();

    if (result.type === "milestone" && result.newDate) {
      onUpdateMilestoneDate(result.entityId, result.projectId, format(result.newDate, "yyyy-MM-dd"));
    } else if (result.type.startsWith("activity-") && result.newStart && result.newEnd) {
      const newStartStr = format(result.newStart, "yyyy-MM-dd");
      const newEndStr = format(result.newEnd, "yyyy-MM-dd");
      // Update local activity state immediately for visual feedback
      setActivityDateOverrides((prev) => ({
        ...prev,
        [result.entityId]: { startDate: newStartStr, endDate: newEndStr },
      }));
      onUpdateActivityDates(result.entityId, result.projectId, newStartStr, newEndStr);
    } else if (result.newStart && result.newEnd) {
      onUpdateProjectDates(
        result.projectId,
        format(result.newStart, "yyyy-MM-dd"),
        format(result.newEnd, "yyyy-MM-dd")
      );
    }
  }, [onUpdateProjectDates, onUpdateMilestoneDate, onUpdateActivityDates]);

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

    // Route deadline milestones to DeadlinePopover
    const isDeadline = milestone.type === "phase" || milestone.icon || milestone.description;
    if (isDeadline) {
      setDeadlinePopover({
        open: true,
        position: { top: rect.bottom + 4, left: rect.left - 100 },
        milestone,
        projectId: project.id,
        projectColor: project.color,
      });
    } else {
      setMilestonePopover({
        open: true,
        position: { top: rect.bottom + 4, left: rect.left - 100 },
        milestone,
        projectId: project.id,
        projectColor: project.color,
      });
    }
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

  const hasExpandableContent = (_project: TimelineProject) => {
    return true; // All projects can have activities
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse table-fixed">
          <colgroup>
            <col className="w-[260px]" />
          </colgroup>

          <thead>
            {/* Group headers */}
            <tr>
              <th className="sticky left-0 z-20 bg-card border-b border-r border-[#E5E7EB] dark:border-[#333] p-3 text-left w-[260px]" rowSpan={2}>
                <span className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[0.06em]">
                  {t("project") || "Projects"}
                </span>
              </th>
              {groupHeaders.map(({ label, colSpan }, idx) => (
                <th
                  key={idx}
                  colSpan={colSpan}
                  className="border-b border-r border-[#F3F4F6] dark:border-[#222] p-1 text-center bg-[#FAFAF9] dark:bg-[#151515]"
                >
                  <span className="text-xs font-semibold">{label}</span>
                </th>
              ))}
              {/* Capacity placeholder */}
              <th className="sticky right-0 z-20 bg-card border-b border-l border-[#E5E7EB] dark:border-[#333] w-[60px]" rowSpan={2} />
            </tr>

            {/* Column headers */}
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  data-timeline-col
                  className={cn(
                    "border-b border-r border-[#F3F4F6] dark:border-[#222] p-1 text-center overflow-hidden",
                    col.containsToday && "bg-[#FFFBEB] dark:bg-amber-950/20"
                  )}
                >
                  <div className={cn(
                    "text-[9px] font-semibold uppercase tracking-[0.05em]",
                    col.containsToday ? "text-[#D97706]" : "text-[#9CA3AF]"
                  )}>
                    {col.containsToday ? "Today" : (viewMode === "day" ? format(col.start, "EEE", { locale: dateLocale }) : "")}
                  </div>
                  <span className={cn(
                    "text-[10px] font-mono",
                    col.containsToday ? "text-[#92400E]" : "text-[#6B7280]"
                  )} style={{ fontVariantNumeric: "tabular-nums" }}>
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
              const hasAnyExpanded = expandedProjects.size > 0;
              const isDimmed = hasAnyExpanded && !isExpanded;

              // Budget bar helper
              const budgetRatio = project.budgetHours ? project.hoursUsed / project.budgetHours : 0;
              const budgetBarColor = budgetRatio > 0.7 ? "#059669" : budgetRatio > 0.5 ? "#D97706" : budgetRatio > 0 ? "#DC2626" : "#9CA3AF";

              return (
                <Fragment key={project.id}>
                  {/* Main project row */}
                  <tr
                    className="group transition-all duration-300"
                    id={`project-row-${project.id}`}
                    style={{ opacity: isDimmed ? 0.4 : 1 }}
                  >
                    {/* Project Info — redesigned to match demo */}
                    <td
                      className={cn(
                        "sticky left-0 z-10 border-b border-r border-[#F3F4F6] dark:border-[#222] p-0 w-[260px]",
                        isExpanded ? "bg-[#FAFAF9] dark:bg-[#151515]" : "bg-card",
                      )}
                    >
                      <div
                        className={cn(
                          "flex items-center gap-2.5 px-5 py-3.5 cursor-pointer transition-colors duration-150",
                          !isExpanded && "hover:bg-[#F9FAFB] dark:hover:bg-[#1a1a1a]"
                        )}
                        onClick={() => { if (!editMode && canExpand) toggleExpand(project.id); }}
                      >
                        {/* Color dot — 10x10, rounded-3 matching demo */}
                        <div
                          className="w-[10px] h-[10px] rounded-[3px] shrink-0"
                          style={{ background: project.color }}
                        />

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          {/* Row 1: Name */}
                          <div className="text-[13px] font-semibold truncate leading-tight">
                            {project.name}
                          </div>
                          {/* Row 2: Client */}
                          {project.client && (
                            <div className="text-[11px] text-[#9CA3AF] mt-0.5 truncate">
                              {project.client}
                            </div>
                          )}
                          {/* Row 3: Phase badge + Budget bar + Activity count */}
                          <div className="flex items-center gap-2 mt-1.5">
                            {project.currentPhase && (
                              <span
                                className="inline-block px-2 py-px rounded text-[10px] font-semibold"
                                style={{
                                  background: project.currentPhase.color || "#F3F4F6",
                                  color: "#374151",
                                }}
                              >
                                {project.currentPhase.name}
                              </span>
                            )}
                            {project.budgetHours ? (
                              <div className="flex items-center gap-1.5">
                                <div style={{ width: 48, height: 4, background: "#E5E7EB", borderRadius: 2 }}>
                                  <div
                                    style={{
                                      width: `${Math.min(budgetRatio * 100, 100)}%`,
                                      height: 4,
                                      background: budgetBarColor,
                                      borderRadius: 2,
                                      transition: "width 0.4s ease",
                                    }}
                                  />
                                </div>
                                <span
                                  className="text-[10px] font-semibold font-mono"
                                  style={{ color: budgetBarColor, fontVariantNumeric: "tabular-nums" }}
                                >
                                  {Math.round(budgetRatio * 100)}%
                                </span>
                              </div>
                            ) : null}
                            {(project.activityCount ?? 0) > 0 && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#F3F4F6] dark:bg-[#374151] text-[#6B7280] font-mono shrink-0" style={{ fontVariantNumeric: "tabular-nums" }}>
                                {project.activityCompletedCount ?? 0}/{project.activityCount}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Chevron */}
                        {!editMode && canExpand && (
                          <span
                            className="text-[12px] text-[#9CA3AF] transition-transform duration-300 shrink-0"
                            style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
                          >
                            &#x25B8;
                          </span>
                        )}

                        {/* Add milestone button */}
                        {editMode && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity shrink-0"
                            aria-label={t("addMilestone") || "Add Milestone"}
                            onClick={(e) => {
                              e.stopPropagation();
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
                        )}
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
                            "border-b border-r p-0 relative",
                            "border-r-[#F9FAFB] dark:border-r-[#1a1a1a]",
                            "border-b-[#F3F4F6] dark:border-b-[#222]",
                            isDimmed ? "h-[48px]" : "h-[72px]",
                            "transition-all duration-300",
                            col.containsToday && "bg-[rgba(251,191,36,0.06)]"
                          )}
                          onContextMenu={(e) => {
                            if (!editMode) return;
                            e.preventDefault();
                            setContextMenu({
                              x: e.clientX,
                              y: e.clientY,
                              type: inProject ? "project" : "empty",
                              projectId: project.id,
                              date: col.start,
                            });
                          }}
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
                              isExpanded={isExpanded}
                              isDimmed={isDimmed}
                              editMode={editMode}
                              onResizeStartLeft={(e) => {
                                if (!editMode || !project.startDate || !project.endDate) return;
                                startDrag("resize-start", project.id, project.id, e.clientX, new Date(project.startDate + "T00:00:00"), new Date(project.endDate + "T00:00:00"));
                              }}
                              onResizeStartRight={(e) => {
                                if (!editMode || !project.startDate || !project.endDate) return;
                                startDrag("resize-end", project.id, project.id, e.clientX, new Date(project.startDate + "T00:00:00"), new Date(project.endDate + "T00:00:00"));
                              }}
                              onMoveStart={(e) => {
                                if (!editMode || !project.startDate || !project.endDate) return;
                                startDrag("move", project.id, project.id, e.clientX, new Date(project.startDate + "T00:00:00"), new Date(project.endDate + "T00:00:00"));
                              }}
                            />
                          )}

                          {/* Milestone markers */}
                          {colMilestones.length === 1 && (() => {
                            const ms = colMilestones[0];
                            const msColor = ms.completed
                              ? undefined
                              : ms.type === "phase"
                                ? ms.phaseColor || project.color
                                : ms.color || project.color;

                            const renderMilestoneIcon = () => {
                              if (ms.completed) {
                                return <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" fill="currentColor" />;
                              }
                              if (ms.icon && MILESTONE_ICON_MAP[ms.icon]) {
                                const Icon = MILESTONE_ICON_MAP[ms.icon];
                                return <Icon className="h-4 w-4" style={{ color: msColor }} />;
                              }
                              if (ms.type === "phase") {
                                return <Diamond className="h-4 w-4" style={{ color: msColor }} fill="currentColor" />;
                              }
                              return <Diamond className="h-4 w-4" style={{ color: msColor }} fill="currentColor" />;
                            };

                            const dueDate = new Date(ms.dueDate + "T00:00:00");
                            const today = getToday(); today.setHours(0,0,0,0);
                            const isOverdue = dueDate < today && !ms.completed;

                            return (
                              <button
                                className={cn("absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20", isOverdue && "animate-pulse")}
                                onClick={(e) => handleMilestoneClick(ms, project, e)}
                                onMouseDown={(e) => {
                                  if (e.button !== 0 || !editMode) return;
                                  e.stopPropagation();
                                  startDrag("milestone", ms.id, project.id, e.clientX, new Date(ms.dueDate + "T00:00:00"), new Date(ms.dueDate + "T00:00:00"));
                                }}
                                title={ms.title}
                              >
                                {isOverdue ? (
                                  <Diamond className="h-4 w-4 text-red-500" fill="currentColor" />
                                ) : (
                                  renderMilestoneIcon()
                                )}
                              </button>
                            );
                          })()}
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
                          {editMode && !inProject && colMilestones.length === 0 && (
                            <button
                              className="absolute inset-0 opacity-0 hover:opacity-100 flex items-center justify-center"
                              onClick={(e) => handleEmptyCellClick(project, col, e)}
                            >
                              <Plus className="h-3 w-3 text-muted-foreground/40" />
                            </button>
                          )}

                          {/* Today line */}
                          {col.containsToday && (
                            <div className="absolute top-0 bottom-0 left-1/2 w-[2px] bg-studio-amber z-[5]" />
                          )}
                        </td>
                      );
                    })}

                    {/* Right capacity column */}
                    <td className="sticky right-0 z-10 bg-card border-b border-l border-[#E5E7EB] dark:border-[#333] w-[60px]">
                      {project.budgetHours ? (
                        <div className="p-1 text-center">
                          <div className="text-[9px] font-bold font-mono" style={{ color: budgetBarColor, fontVariantNumeric: "tabular-nums" }}>
                            {Math.round(budgetRatio * 100)}%
                          </div>
                          <div className="h-1 rounded-full mt-0.5" style={{ background: "#E5E7EB" }}>
                            <div
                              className="h-full rounded-full transition-all duration-400"
                              style={{ width: `${Math.min(100, budgetRatio * 100)}%`, background: budgetBarColor }}
                            />
                          </div>
                        </div>
                      ) : null}
                    </td>
                  </tr>

                  {/* Expanded sub-rows: activities (Gantt Level 2) */}
                  {isExpanded && (
                    <ActivityGanttSection
                      project={project}
                      columns={columns}
                      startDrag={startDrag}
                      dragState={dragState}
                      dragPreview={dragPreview}
                      activityDateOverrides={activityDateOverrides}
                      teamMembers={teamMembers}
                      companyPhases={companyPhases}
                      milestones={milestonesByProject[project.id] || []}
                      editMode={editMode}
                      onSaveDeadline={async (data) => {
                        await onSaveMilestone(data);
                      }}
                      onDeleteDeadline={onDeleteMilestone}
                    />
                  )}

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
        <div className="flex items-center gap-6 p-4 border-t border-[#F3F4F6] dark:border-[#222] text-[10px] bg-[#FAFAF9] dark:bg-[#151515]">
          <div className="flex items-center gap-2">
            <Diamond className="h-4 w-4 text-brand-500" fill="currentColor" />
            <span className="text-muted-foreground">{t("milestone") || "Milestone"}</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" fill="currentColor" />
            <span className="text-muted-foreground">{t("completed") || "Completed"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-brand-500" />
            <span className="text-muted-foreground">{t("deadline") || "Deadline"}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-studio-amber" />
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

      {/* Deadline popover (for deadline milestones) */}
      <DeadlinePopover
        open={deadlinePopover.open}
        position={deadlinePopover.position}
        milestone={deadlinePopover.milestone}
        projectId={deadlinePopover.projectId}
        projectColor={deadlinePopover.projectColor}
        companyPhases={companyPhases}
        existingPhaseDeadlines={phaseDeadlinesByProject[deadlinePopover.projectId] || []}
        defaultDate={deadlinePopover.defaultDate}
        onSave={async (data) => {
          await onSaveMilestone(data);
          setDeadlinePopover((p) => ({ ...p, open: false }));
        }}
        onDelete={(milestoneId, projectId) => {
          onDeleteMilestone(milestoneId, projectId);
          setDeadlinePopover((p) => ({ ...p, open: false }));
        }}
        onClose={() => setDeadlinePopover((p) => ({ ...p, open: false }))}
      />

      {/* Context menu */}
      {editMode && contextMenu && (
        <TimelineContextMenu
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          onAddMilestone={(projectId, date) => {
            const project = projects.find((p) => p.id === projectId);
            setMilestonePopover({
              open: true,
              position: { top: contextMenu.y, left: contextMenu.x },
              milestone: null,
              projectId,
              projectColor: project?.color || "#6366F1",
              defaultDate: format(date, "yyyy-MM-dd"),
            });
          }}
          onAddActivity={() => {}}
          onEditActivity={() => {}}
          onDuplicateActivity={() => {}}
          onDeleteActivity={() => {}}
          onEditMilestone={(milestoneId) => {
            const ms = milestones.find((m) => m.id === milestoneId);
            if (!ms) return;
            const project = projects.find((p) => p.id === ms.projectId);
            const isDeadline = ms.type === "phase" || ms.icon || ms.description;
            if (isDeadline) {
              setDeadlinePopover({
                open: true,
                position: { top: contextMenu.y, left: contextMenu.x },
                milestone: ms,
                projectId: ms.projectId,
                projectColor: project?.color || "#6366F1",
              });
            } else {
              setMilestonePopover({
                open: true,
                position: { top: contextMenu.y, left: contextMenu.x },
                milestone: ms,
                projectId: ms.projectId,
                projectColor: project?.color || "#6366F1",
              });
            }
          }}
          onDeleteMilestone={(milestoneId, projectId) => {
            onDeleteMilestone(milestoneId, projectId);
          }}
        />
      )}
    </>
  );
}
