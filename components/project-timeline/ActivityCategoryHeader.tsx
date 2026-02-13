"use client";

import { cn } from "@/lib/utils";

interface ActivityCategoryHeaderProps {
  name: string;
  color: string | null;
  columnCount: number;
}

export function ActivityCategoryHeader({
  name,
  color,
  columnCount,
}: ActivityCategoryHeaderProps) {
  const barColor = color || "#888888";

  return (
    <tr className="bg-muted/20">
      {/* Left sticky cell */}
      <td className="sticky left-0 z-10 bg-card border-b border-r border-border p-1.5 min-w-[220px]">
        <div className="flex items-center gap-2 pl-4">
          <div
            className="w-[3px] h-4 rounded-sm shrink-0"
            style={{ backgroundColor: barColor }}
          />
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground truncate">
            {name}
          </span>
        </div>
      </td>

      {/* Middle: subtle tinted row */}
      <td
        colSpan={columnCount}
        className="border-b border-border p-0 h-[24px]"
        style={{ backgroundColor: barColor + "08" }}
      />

      {/* Right cell */}
      <td className="border-b border-l border-border" />
    </tr>
  );
}
