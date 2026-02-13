"use client";

import { useRef } from "react";
import { X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AllocationBlockProps {
  id: string;
  projectName: string;
  projectColor: string;
  hoursPerDay: number;
  status: "tentative" | "confirmed" | "completed";
  notes: string | null;
  isMultiDay: boolean;
  date: string;
  onClick: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  isSelected?: boolean;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
}

export function AllocationBlock({
  id,
  projectName,
  projectColor,
  hoursPerDay,
  status,
  notes,
  isMultiDay,
  date,
  onClick,
  onDelete,
  isSelected,
  selectionMode,
  selectedIds,
}: AllocationBlockProps) {
  const tc = useTranslations("common");
  const canDrag = !selectionMode || isSelected;
  const didDrag = useRef(false);

  const handleDragStart = (e: React.DragEvent) => {
    didDrag.current = true;
    if (selectionMode && isSelected && selectedIds && selectedIds.size > 1) {
      e.dataTransfer.setData("application/json", JSON.stringify({
        bulkMove: true,
        selectedIds: Array.from(selectedIds),
        sourceDate: date,
        shiftKey: e.shiftKey,
      }));
    } else {
      e.dataTransfer.setData("application/json", JSON.stringify({
        allocationId: id,
        sourceDate: date,
        isMultiDay,
        hoursPerDay,
        projectName,
        projectColor,
        status,
        notes,
        shiftKey: e.shiftKey,
      }));
    }
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    // Reset after a short delay so click (which fires right after) is still suppressed
    setTimeout(() => { didDrag.current = false; }, 0);
  };

  const handleClick = (e: React.MouseEvent) => {
    // Suppress click if a drag just happened
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    onClick(e);
  };

  const statusLabel = status === "tentative" ? (tc("tentative") || "Tentative") : status === "confirmed" ? (tc("confirmed") || "Confirmed") : (tc("completed") || "Completed");

  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            draggable={canDrag}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            className={cn(
              "group/block relative flex items-center gap-1 rounded px-1.5 py-0.5 transition-all duration-150",
              selectionMode
                ? isSelected
                  ? "cursor-grab active:cursor-grabbing active:opacity-60 ring-2 ring-blue-500 ring-offset-1 ring-offset-background"
                  : "cursor-pointer"
                : "cursor-grab active:cursor-grabbing active:opacity-60",
              "hover:ring-1 hover:ring-foreground/15",
              status === "tentative" && "opacity-75 border border-dashed border-white/40"
            )}
            style={{
              backgroundColor: projectColor + (status === "tentative" ? "99" : "CC"),
            }}
            onClick={handleClick}
          >
            {isSelected && (
              <div className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center z-10">
                <Check className="h-2.5 w-2.5" />
              </div>
            )}
            <div
              className="w-0.5 h-3 rounded-full shrink-0"
              style={{ backgroundColor: projectColor }}
            />
            <span className="text-[11px] font-medium text-white truncate drop-shadow-sm">
              {projectName}
            </span>
            <span className="text-[10px] text-white/80 shrink-0 ml-auto font-mono">
              {hoursPerDay}{tc("hourAbbrev")}
            </span>
            {!selectionMode && (
              <button
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover/block:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(e);
                }}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-medium">{projectName}</p>
          <p className="text-muted-foreground font-mono">{hoursPerDay}{tc("hourAbbrev")} &middot; {statusLabel}</p>
          {notes && <p className="text-muted-foreground mt-0.5">{notes}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
