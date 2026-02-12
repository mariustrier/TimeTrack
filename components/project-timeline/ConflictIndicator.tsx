"use client";

import { TriangleAlert } from "lucide-react";
import type { TimelineConflict } from "./types";

interface ConflictIndicatorProps {
  conflict: TimelineConflict;
}

export function ConflictIndicator({ conflict }: ConflictIndicatorProps) {
  const details = conflict.projects
    .map((p) => `${p.projectName} (${p.hours}t)`)
    .join(" + ");

  return (
    <div
      className="inline-flex items-center gap-1"
      title={`${conflict.userName}: ${details} = ${conflict.totalHours.toFixed(1)}t (kapacitet: ${conflict.dailyCapacity.toFixed(1)}t)`}
    >
      <TriangleAlert className="h-3 w-3 text-amber-500" />
    </div>
  );
}
