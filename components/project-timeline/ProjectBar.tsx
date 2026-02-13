"use client";

import { cn } from "@/lib/utils";
import type { TimelineProjectPhase, DragState } from "./types";

interface ProjectBarProps {
  projectColor: string;
  isStart: boolean;
  isEnd: boolean;
  showPhases: boolean;
  phaseSegments: TimelineProjectPhase[];
  columnStart: Date;
  columnEnd: Date;
  isDragging: boolean;
  isExpanded?: boolean;
  isDimmed?: boolean;
  editMode: boolean;
  onResizeStartLeft: (e: React.MouseEvent) => void;
  onResizeStartRight: (e: React.MouseEvent) => void;
  onMoveStart: (e: React.MouseEvent) => void;
}

export function ProjectBar({
  projectColor,
  isStart,
  isEnd,
  showPhases,
  phaseSegments,
  columnStart,
  columnEnd,
  isDragging,
  isExpanded,
  isDimmed,
  editMode,
  onResizeStartLeft,
  onResizeStartRight,
  onMoveStart,
}: ProjectBarProps) {
  // Filter phase segments that overlap with this column
  const overlappingPhases = showPhases
    ? phaseSegments.filter((ps) => {
        const psStart = new Date(ps.startDate + "T00:00:00");
        const psEnd = new Date(ps.endDate + "T00:00:00");
        return psStart <= columnEnd && psEnd >= columnStart;
      })
    : [];

  // Demo: 0.85 opacity normally, 0.15 when expanded (faded behind activities), 0.85 when dimmed (compact bar)
  const barOpacity = isDragging ? 0.5 : isExpanded ? 0.15 : 0.85;
  const barHeight = isDimmed ? 16 : 24;

  return (
    <div
      className={cn(
        "absolute top-1/2 -translate-y-1/2 inset-x-0 group/bar transition-all duration-300",
        isStart && "left-1 rounded-l-[6px]",
        isEnd && "right-1 rounded-r-[6px]",
      )}
      style={{
        backgroundColor: projectColor,
        opacity: barOpacity,
        height: barHeight,
        borderRadius: isDimmed ? 4 : 6,
      }}
    >
      {/* Phase segments overlay */}
      {overlappingPhases.map((ps) => {
        // Calculate what percentage of this column the phase covers
        const psStart = new Date(ps.startDate + "T00:00:00");
        const psEnd = new Date(ps.endDate + "T00:00:00");
        const colDuration = columnEnd.getTime() - columnStart.getTime() || 1;
        const segStart = Math.max(0, (psStart.getTime() - columnStart.getTime()) / colDuration);
        const segEnd = Math.min(1, (psEnd.getTime() - columnStart.getTime()) / colDuration);
        const width = Math.max(0, segEnd - segStart);

        return (
          <div
            key={ps.id}
            className={cn(
              "absolute top-0 bottom-0",
              ps.status === "completed" && "opacity-60"
            )}
            style={{
              left: `${segStart * 100}%`,
              width: `${width * 100}%`,
              backgroundColor: ps.phaseColor + "80",
            }}
            title={ps.phaseName}
          />
        );
      })}

      {/* Solid bar stripe at top for project color */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 h-1",
          isStart && "rounded-tl-[6px]",
          isEnd && "rounded-tr-[6px]"
        )}
        style={{ backgroundColor: projectColor }}
      />

      {/* Left resize handle */}
      {editMode && isStart && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-20 hover:bg-foreground/20 rounded-l-[6px]"
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onResizeStartLeft(e);
          }}
        />
      )}

      {/* Move zone (center area) */}
      <div
        className={`absolute inset-0 z-10 ${editMode ? "cursor-grab active:cursor-grabbing" : ""}`}
        onMouseDown={(e) => {
          if (!editMode) return;
          e.preventDefault();
          onMoveStart(e);
        }}
      />

      {/* Right resize handle */}
      {editMode && isEnd && (
        <div
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize z-20 hover:bg-foreground/20 rounded-r-[6px]"
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onResizeStartRight(e);
          }}
        />
      )}
    </div>
  );
}
