"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AllocationBlockProps {
  id: string;
  projectName: string;
  projectColor: string;
  hoursPerDay: number;
  status: "tentative" | "confirmed" | "completed";
  notes: string | null;
  onClick: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

export function AllocationBlock({
  projectName,
  projectColor,
  hoursPerDay,
  status,
  notes,
  onClick,
  onDelete,
}: AllocationBlockProps) {
  return (
    <div
      className={cn(
        "group/block relative flex items-center gap-1 rounded px-1.5 py-0.5 cursor-pointer transition-all",
        "hover:ring-1 hover:ring-foreground/20",
        status === "tentative" && "opacity-75 border border-dashed border-white/40"
      )}
      style={{
        backgroundColor: projectColor + (status === "tentative" ? "99" : "CC"),
      }}
      title={notes || undefined}
      onClick={onClick}
    >
      <div
        className="w-0.5 h-3 rounded-full shrink-0"
        style={{ backgroundColor: projectColor }}
      />
      <span className="text-[11px] font-medium text-white truncate drop-shadow-sm">
        {projectName}
      </span>
      <span className="text-[10px] text-white/80 shrink-0 ml-auto">
        {hoursPerDay}h
      </span>
      <button
        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover/block:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(e);
        }}
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}
