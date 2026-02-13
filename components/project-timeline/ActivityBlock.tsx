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
  onResizeStartLeft,
  onResizeStartRight,
  onMoveStart,
  onClick,
}: ActivityBlockProps) {
  const stripeColor = STATUS_STRIPE_COLORS[activity.status] || STATUS_STRIPE_COLORS.not_started;

  return (
    <div
      className={cn(
        "absolute top-1 bottom-1 inset-x-0",
        isStart && "left-0.5 rounded-l-md",
        isEnd && "right-0.5 rounded-r-md",
        isDragging && "opacity-50",
        activity.status === "not_started" && "border border-dashed opacity-60",
        activity.status === "in_progress" && "opacity-100",
        activity.status === "complete" && "opacity-70",
        isOverdue && "ring-2 ring-red-500"
      )}
      style={{
        backgroundColor: blockColor + "50",
        borderColor: activity.status === "not_started" ? blockColor : undefined,
      }}
    >
      {/* Status stripe at top */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 h-[2px]",
          isStart && "rounded-tl-md",
          isEnd && "rounded-tr-md"
        )}
        style={{ backgroundColor: stripeColor }}
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
        onClick={onClick}
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

      {/* Activity name */}
      <span className="absolute inset-0 flex items-center px-1.5 text-[10px] text-white font-medium truncate pointer-events-none z-30">
        {activity.name}
      </span>
    </div>
  );
}
