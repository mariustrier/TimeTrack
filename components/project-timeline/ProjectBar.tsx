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

  return (
    <div
      className={cn(
        "absolute top-1/2 -translate-y-1/2 h-5 inset-x-0 group/bar",
        isStart && "left-1 rounded-l-md",
        isEnd && "right-1 rounded-r-md",
        isDragging && "opacity-50"
      )}
      style={{ backgroundColor: projectColor + "40" }}
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
          isStart && "rounded-tl-md",
          isEnd && "rounded-tr-md"
        )}
        style={{ backgroundColor: projectColor }}
      />

      {/* Left resize handle */}
      {isStart && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-20 hover:bg-foreground/20 rounded-l-md"
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onResizeStartLeft(e);
          }}
        />
      )}

      {/* Move zone (center area) */}
      <div
        className="absolute inset-0 cursor-grab active:cursor-grabbing z-10"
        onMouseDown={(e) => {
          e.preventDefault();
          onMoveStart(e);
        }}
      />

      {/* Right resize handle */}
      {isEnd && (
        <div
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize z-20 hover:bg-foreground/20 rounded-r-md"
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
