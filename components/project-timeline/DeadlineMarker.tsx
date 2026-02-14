"use client";

import { useMemo } from "react";
import { Flag, Handshake, Rocket, Eye, CalendarDays, AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getToday } from "@/lib/demo-date";
import type { TimelineMilestone, DeadlineIcon } from "./types";
import type { LucideIcon } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  flag: Flag,
  handshake: Handshake,
  rocket: Rocket,
  eye: Eye,
  calendar: CalendarDays,
};

interface DeadlineMarkerProps {
  milestone: TimelineMilestone;
  projectColor: string;
  onClick: (e: React.MouseEvent) => void;
}

export function DeadlineMarker({ milestone, projectColor, onClick }: DeadlineMarkerProps) {
  const today = useMemo(() => {
    const d = getToday();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const dueDate = new Date(milestone.dueDate + "T00:00:00");
  const isOverdue = dueDate < today && !milestone.completed;
  const isPhase = milestone.type === "phase";

  // Determine line color
  const lineColor = isOverdue
    ? "#ef4444"
    : milestone.completed
      ? "#22c55e"
      : isPhase
        ? milestone.phaseColor || projectColor
        : milestone.color || projectColor;

  // Determine icon
  const IconComponent = milestone.icon ? ICON_MAP[milestone.icon] : null;

  return (
    <button
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center z-10 group/deadline cursor-pointer",
        milestone.completed && "opacity-60"
      )}
      onClick={onClick}
      title={milestone.title}
    >
      {/* Vertical line */}
      <div
        className={cn(
          "absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5",
          isPhase ? "border-l-2 border-dashed" : "border-l-2 border-dotted"
        )}
        style={{ borderColor: lineColor }}
      />

      {/* Icon + label */}
      <div className="relative z-10 flex flex-col items-center gap-0.5">
        {isOverdue ? (
          <AlertTriangle className="h-3 w-3 text-red-500" />
        ) : milestone.completed ? (
          <CheckCircle className="h-3 w-3 text-green-500" />
        ) : IconComponent ? (
          <IconComponent className="h-3 w-3" style={{ color: lineColor }} />
        ) : isPhase ? (
          <div className="w-2.5 h-2.5 rotate-45 border-2" style={{ borderColor: lineColor, backgroundColor: lineColor + "33" }} />
        ) : (
          <Flag className="h-3 w-3" style={{ color: lineColor }} />
        )}

        {/* Title label (visible on hover) */}
        <span
          className={cn(
            "text-[7px] leading-tight max-w-[50px] truncate font-medium opacity-0 group-hover/deadline:opacity-100 transition-opacity",
            isOverdue ? "text-red-500" : milestone.completed ? "text-green-600" : "text-foreground"
          )}
        >
          {milestone.title}
        </span>
      </div>
    </button>
  );
}
