"use client";

import { cn } from "@/lib/utils";

interface ActivityBlockProps {
  activity: {
    id: string;
    name: string;
    status: string;
    color: string | null;
    startDate: string;
    endDate: string;
  };
  blockColor: string;
  isStart: boolean;
  isEnd: boolean;
  isOverdue: boolean;
  isDragging: boolean;
  editMode?: boolean;
  onResizeStartLeft: (e: React.MouseEvent) => void;
  onResizeStartRight: (e: React.MouseEvent) => void;
  onMoveStart: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
}

const STATUS_STRIPE_COLORS: Record<string, string> = {
  not_started: "#9ca3af",   // gray-400
  in_progress: "#f59e0b",   // amber-500
  needs_review: "#f97316",  // orange-500
  complete: "#22c55e",      // green-500
};

export function ActivityBlock({
  activity,
  blockColor,
  isStart,
  isEnd,
  isOverdue,
  isDragging,
  editMode = true,
  onResizeStartLeft,
  onResizeStartRight,
  onMoveStart,
  onClick,
}: ActivityBlockProps) {
  const stripeColor = STATUS_STRIPE_COLORS[activity.status] || STATUS_STRIPE_COLORS.not_started;

  return (
    <div
      className={cn(
        "absolute top-1 bottom-1 inset-x-0 transition-all duration-150 group/actblock",
        isStart && "left-0.5 rounded-l-[5px]",
        isEnd && "right-0.5 rounded-r-[5px]",
        isDragging && "opacity-50",
        activity.status === "not_started" && "border border-dashed opacity-50",
        activity.status === "in_progress" && "opacity-100",
        activity.status === "complete" && "opacity-70",
        isOverdue && "ring-2 ring-red-400",
        !isDragging && "hover:shadow-md"
      )}
      style={{
        backgroundColor: blockColor + "CC",
        borderColor: activity.status === "not_started" ? blockColor : undefined,
      }}
      onMouseEnter={(e) => {
        if (!isDragging) (e.currentTarget as HTMLElement).style.backgroundColor = blockColor;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = blockColor + "CC";
      }}
    >
      {/* Status stripe at top */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 h-[3px]",
          isStart && "rounded-tl-[5px]",
          isEnd && "rounded-tr-[5px]"
        )}
        style={{ backgroundColor: stripeColor }}
      />

      {/* Left resize handle — visible circle in edit mode */}
      {editMode && isStart && !isDragging && (
        <div
          className="absolute -left-[7px] top-1/2 -translate-y-1/2 w-[14px] h-[14px] rounded-full bg-white border-2 shadow-sm flex items-center justify-center cursor-col-resize z-30 opacity-70 hover:opacity-100 hover:scale-125 transition-all"
          style={{ borderColor: blockColor }}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onResizeStartLeft(e);
          }}
        >
          <span className="text-[9px] font-black leading-none select-none" style={{ color: blockColor }}>−</span>
        </div>
      )}

      {/* Move zone (center area) */}
      <div
        className={`absolute inset-0 z-10 ${editMode ? "cursor-grab active:cursor-grabbing" : ""}`}
        onMouseDown={(e) => {
          if (!editMode) return;
          e.preventDefault();
          onMoveStart(e);
        }}
        onClick={onClick}
      />

      {/* Right resize handle — visible circle in edit mode */}
      {editMode && isEnd && !isDragging && (
        <div
          className="absolute -right-[7px] top-1/2 -translate-y-1/2 w-[14px] h-[14px] rounded-full bg-white border-2 shadow-sm flex items-center justify-center cursor-col-resize z-30 opacity-70 hover:opacity-100 hover:scale-125 transition-all"
          style={{ borderColor: blockColor }}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onResizeStartRight(e);
          }}
        >
          <span className="text-[9px] font-black leading-none select-none" style={{ color: blockColor }}>+</span>
        </div>
      )}

      {/* Activity name */}
      <span
        className="absolute inset-0 flex items-center px-2 text-[10px] text-white font-medium truncate pointer-events-none z-30"
        style={{ textShadow: "0 1px 2px rgba(0,0,0,0.15)" }}
      >
        {activity.name}
      </span>
    </div>
  );
}
