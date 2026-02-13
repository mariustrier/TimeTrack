"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";
import { InlineEditCell } from "./InlineEditCell";
import { ActivityBlock } from "./ActivityBlock";
import type { TimelineActivity, TimelineColumn, DragState } from "./types";

interface ActivityRowProps {
  activity: TimelineActivity;
  projectColor: string;
  columns: TimelineColumn[];
  teamMembers: { id: string; name: string; imageUrl: string | null }[];
  onUpdate: (activityId: string, data: Record<string, unknown>) => void;
  onDelete: (activityId: string) => void;
  onClick: (activity: TimelineActivity, e: React.MouseEvent) => void;
  startDrag: (
    type: DragState["type"],
    entityId: string,
    projectId: string,
    mouseX: number,
    originalStart: Date,
    originalEnd: Date
  ) => void;
  dragState: DragState | null;
}

const STATUS_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: "not_started", label: "Not Started", color: "#9ca3af" },
  { value: "in_progress", label: "In Progress", color: "#f59e0b" },
  { value: "needs_review", label: "Needs Review", color: "#f97316" },
  { value: "complete", label: "Complete", color: "#22c55e" },
];

const STATUS_COLORS: Record<string, string> = {
  not_started: "#9ca3af",
  in_progress: "#f59e0b",
  needs_review: "#f97316",
  complete: "#22c55e",
  overdue: "#ef4444",
};

export function ActivityRow({
  activity,
  projectColor,
  columns,
  teamMembers,
  onUpdate,
  onDelete,
  onClick,
  startDrag,
  dragState,
}: ActivityRowProps) {
  const t = useTranslations("timeline");

  const startDate = useMemo(() => new Date(activity.startDate + "T00:00:00"), [activity.startDate]);
  const endDate = useMemo(() => new Date(activity.endDate + "T00:00:00"), [activity.endDate]);
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const isOverdue = endDate < today && activity.status !== "complete";

  const computedStatus = isOverdue ? "overdue" : activity.status;

  const blockColor = activity.color || activity.phaseColor || projectColor;

  // Assignee initials
  const assigneeInitials = useMemo(() => {
    if (!activity.assignedUserName) return "?";
    return activity.assignedUserName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }, [activity.assignedUserName]);

  // Helper: check if column overlaps with activity
  const isInActivity = (col: TimelineColumn) => {
    return col.start <= endDate && col.end >= startDate;
  };

  const isActivityStartCol = (col: TimelineColumn) => {
    return startDate >= col.start && startDate <= col.end;
  };

  const isActivityEndCol = (col: TimelineColumn) => {
    return endDate >= col.start && endDate <= col.end;
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr + "T00:00:00"), "dd/MM");
    } catch {
      return dateStr;
    }
  };

  const renderStatusBadge = (statusValue: string) => {
    const displayStatus = statusValue === "overdue" ? "overdue" : statusValue;
    const color = STATUS_COLORS[displayStatus] || STATUS_COLORS.not_started;
    const labelMap: Record<string, string> = {
      not_started: t("statusNotStarted") || "Not Started",
      in_progress: t("statusInProgress") || "In Progress",
      needs_review: t("statusNeedsReview") || "Review",
      complete: t("statusComplete") || "Done",
      overdue: t("statusOverdue") || "Overdue",
    };
    const label = labelMap[displayStatus] || displayStatus;

    return (
      <span className="flex items-center gap-1 text-[9px]">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="truncate">{label}</span>
      </span>
    );
  };

  return (
    <tr className="group/activity hover:bg-muted/5">
      {/* Sticky left cell */}
      <td className="sticky left-0 z-10 bg-card border-b border-r border-border p-1.5 min-w-[220px]">
        <div className="pl-4">
          {/* Line 1: Name */}
          <InlineEditCell
            value={activity.name}
            onSave={(v) => onUpdate(activity.id, { name: v })}
            type="text"
            className="text-xs font-medium"
            placeholder={t("activityName") || "Activity name"}
          />

          {/* Line 2: Meta */}
          <div className="flex items-center gap-1.5 mt-0.5">
            {/* Assignee avatar */}
            <div
              className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[8px] shrink-0"
              title={activity.assignedUserName || t("unassigned") || "Unassigned"}
            >
              {assigneeInitials}
            </div>

            {/* Status badge */}
            <InlineEditCell
              type="select"
              value={activity.status}
              options={STATUS_OPTIONS}
              onSave={(v) => onUpdate(activity.id, { status: v })}
              renderDisplay={() => renderStatusBadge(computedStatus)}
            />

            {/* Dates */}
            <span className="text-[9px] text-muted-foreground">
              {formatDate(activity.startDate)} – {formatDate(activity.endDate)}
            </span>
          </div>
        </div>
      </td>

      {/* Grid cells */}
      {columns.map((col) => (
        <td
          key={col.key}
          className={cn(
            "border-b border-r border-border p-0 h-[32px] relative",
            col.containsToday && "bg-brand-50/20 dark:bg-brand-950/20"
          )}
        >
          {isInActivity(col) && (
            <ActivityBlock
              activity={activity}
              blockColor={blockColor}
              isStart={isActivityStartCol(col)}
              isEnd={isActivityEndCol(col)}
              isOverdue={isOverdue}
              isDragging={dragState?.entityId === activity.id}
              onResizeStartLeft={(e) => {
                e.stopPropagation();
                startDrag(
                  "activity-resize-start",
                  activity.id,
                  activity.projectId,
                  e.clientX,
                  startDate,
                  endDate
                );
              }}
              onResizeStartRight={(e) => {
                e.stopPropagation();
                startDrag(
                  "activity-resize-end",
                  activity.id,
                  activity.projectId,
                  e.clientX,
                  startDate,
                  endDate
                );
              }}
              onMoveStart={(e) => {
                e.preventDefault();
                startDrag(
                  "activity-move",
                  activity.id,
                  activity.projectId,
                  e.clientX,
                  startDate,
                  endDate
                );
              }}
              onClick={(e) => onClick(activity, e)}
            />
          )}

          {/* Today line */}
          {col.containsToday && (
            <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-red-500 z-[5]" />
          )}
        </td>
      ))}

      {/* Right capacity cell */}
      <td className="border-b border-l border-border" />
    </tr>
  );
}
