"use client";

import { useMemo } from "react";
import { useTranslations } from "@/lib/i18n";
import type { BurndownPoint, TimelineColumn } from "./types";

interface BurndownSparklineProps {
  burndownData: BurndownPoint[];
  budgetHours: number | null;
  projectColor: string;
  columns: TimelineColumn[];
}

export function BurndownSparkline({
  burndownData,
  budgetHours,
  projectColor,
  columns,
}: BurndownSparklineProps) {
  const t = useTranslations("timeline");

  const chartData = useMemo(() => {
    if (!budgetHours || burndownData.length === 0 || columns.length === 0) return null;

    const width = columns.length * 40; // approximate width per column
    const height = 36;
    const padding = { top: 2, bottom: 2, left: 0, right: 0 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const maxY = Math.max(budgetHours, ...burndownData.map((d) => d.actualCumulative)) * 1.1;

    // Map burndown points to x,y coordinates
    const totalPoints = burndownData.length;
    if (totalPoints === 0) return null;

    const plannedPoints: string[] = [];
    const actualPoints: string[] = [];

    burndownData.forEach((point, i) => {
      const x = padding.left + (i / Math.max(1, totalPoints - 1)) * chartW;
      const yPlanned = padding.top + chartH - (point.plannedCumulative / maxY) * chartH;
      const yActual = padding.top + chartH - (point.actualCumulative / maxY) * chartH;
      plannedPoints.push(`${x},${yPlanned}`);
      actualPoints.push(`${x},${yActual}`);
    });

    const plannedPath = `M ${plannedPoints.join(" L ")}`;
    const actualPath = `M ${actualPoints.join(" L ")}`;

    // Area between lines
    const areaPoints = [
      ...actualPoints.map((p) => p),
      ...plannedPoints.reverse().map((p) => p),
    ];
    const areaPath = `M ${areaPoints.join(" L ")} Z`;

    const lastActual = burndownData[burndownData.length - 1];
    const isOverBudget = lastActual && lastActual.actualCumulative > lastActual.plannedCumulative;

    // Last point coordinates
    const lastX = padding.left + ((totalPoints - 1) / Math.max(1, totalPoints - 1)) * chartW;
    const lastY = padding.top + chartH - (lastActual.actualCumulative / maxY) * chartH;

    return {
      width,
      height,
      plannedPath,
      actualPath,
      areaPath,
      isOverBudget,
      lastX,
      lastY,
      lastActual: lastActual.actualCumulative,
    };
  }, [burndownData, budgetHours, columns.length]);

  if (!budgetHours) {
    return (
      <tr className="bg-muted/5">
        <td className="sticky left-0 z-10 bg-card border-b border-r border-border p-2 min-w-[220px]">
          <div className="flex items-center gap-2 pl-6">
            <span className="text-[10px] text-muted-foreground">
              {t("noBudget") || "No budget set"}
            </span>
          </div>
        </td>
        <td colSpan={columns.length} className="border-b border-border p-2">
          <span className="text-[10px] text-muted-foreground italic">
            {t("noBudget") || "No budget set"}
          </span>
        </td>
        <td className="border-b border-l border-border" />
      </tr>
    );
  }

  if (!chartData) {
    return (
      <tr className="bg-muted/5">
        <td className="sticky left-0 z-10 bg-card border-b border-r border-border p-2 min-w-[220px]">
          <div className="flex items-center gap-2 pl-6">
            <span className="text-[10px] text-muted-foreground">
              {t("burndown") || "Burndown"}
            </span>
          </div>
        </td>
        <td colSpan={columns.length} className="border-b border-border p-1" />
        <td className="border-b border-l border-border" />
      </tr>
    );
  }

  return (
    <tr className="bg-muted/5">
      <td className="sticky left-0 z-10 bg-card border-b border-r border-border p-2 min-w-[220px]">
        <div className="flex items-center gap-2 pl-6">
          <span className="text-[10px] text-muted-foreground">
            {t("burndown") || "Burndown"}
          </span>
          <span className={`text-[10px] font-medium ${chartData.isOverBudget ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>
            {chartData.lastActual.toFixed(0)}t / {budgetHours}t
          </span>
        </div>
      </td>
      <td colSpan={columns.length} className="border-b border-border p-0">
        <svg
          width="100%"
          height={chartData.height}
          viewBox={`0 0 ${chartData.width} ${chartData.height}`}
          preserveAspectRatio="none"
          className="overflow-visible"
        >
          {/* Area between lines */}
          <path
            d={chartData.areaPath}
            fill={chartData.isOverBudget ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.08)"}
          />

          {/* Planned line (dashed) */}
          <path
            d={chartData.plannedPath}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
            strokeDasharray="4 3"
            className="text-muted-foreground/40"
          />

          {/* Actual line (solid) */}
          <path
            d={chartData.actualPath}
            fill="none"
            stroke={chartData.isOverBudget ? "#ef4444" : projectColor}
            strokeWidth={1.5}
          />

          {/* Current point */}
          <circle
            cx={chartData.lastX}
            cy={chartData.lastY}
            r={2.5}
            fill={chartData.isOverBudget ? "#ef4444" : projectColor}
          />
        </svg>
      </td>
      <td className="border-b border-l border-border" />
    </tr>
  );
}
