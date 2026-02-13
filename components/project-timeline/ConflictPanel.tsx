"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { useDateLocale } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, TriangleAlert } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import type { TimelineConflict } from "./types";

interface ConflictPanelProps {
  conflicts: TimelineConflict[];
  onConflictClick?: (projectId: string) => void;
}

export function ConflictPanel({ conflicts, onConflictClick }: ConflictPanelProps) {
  const t = useTranslations("timeline");
  const dateLocale = useDateLocale();
  const [expanded, setExpanded] = useState(true);

  // Group conflicts by userId and consecutive date ranges
  const groupedConflicts = useMemo(() => {
    if (conflicts.length === 0) return [];

    // Group by user + project set
    const groups: Record<string, {
      userId: string;
      userName: string;
      dates: string[];
      totalHours: number;
      dailyCapacity: number;
      projects: TimelineConflict["projects"];
    }> = {};

    for (const c of conflicts) {
      const key = c.userId + "|" + c.projects.map((p) => p.projectId).sort().join(",");
      if (!groups[key]) {
        groups[key] = {
          userId: c.userId,
          userName: c.userName,
          dates: [],
          totalHours: c.totalHours,
          dailyCapacity: c.dailyCapacity,
          projects: c.projects,
        };
      }
      groups[key].dates.push(c.date);
    }

    return Object.values(groups).map((g) => {
      const sortedDates = g.dates.sort();
      const startDate = sortedDates[0];
      const endDate = sortedDates[sortedDates.length - 1];
      return {
        ...g,
        startDate,
        endDate,
        dayCount: sortedDates.length,
      };
    });
  }, [conflicts]);

  if (conflicts.length === 0) return null;

  return (
    <Card className="border-amber-200 dark:border-amber-800">
      <CardHeader
        className="p-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-amber-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-amber-500" />
          )}
          <TriangleAlert className="h-4 w-4 text-amber-500" />
          <CardTitle className="text-sm font-medium">
            {t("conflictsTitle") || "Scheduling Conflicts"} ({groupedConflicts.length})
          </CardTitle>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="p-3 pt-0 space-y-2">
          {groupedConflicts.map((group, i) => {
            const dateRange = group.startDate === group.endDate
              ? format(new Date(group.startDate + "T00:00:00"), "d. MMM", { locale: dateLocale })
              : `${format(new Date(group.startDate + "T00:00:00"), "d. MMM", { locale: dateLocale })} – ${format(new Date(group.endDate + "T00:00:00"), "d. MMM", { locale: dateLocale })}`;

            const details = group.projects
              .map((p) => `${p.projectName} (${p.hours}t)`)
              .join(" + ");

            const severity = group.totalHours / group.dailyCapacity;

            return (
              <div
                key={i}
                className="flex items-start gap-2 text-xs p-2 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${severity > 1.2 ? "bg-red-500" : "bg-amber-500"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">
                    {group.userName} — {dateRange}
                  </p>
                  <p className="text-muted-foreground mt-0.5">
                    {details} = {group.totalHours.toFixed(1)}t/{t("day") || "day"} ({t("capacity") || "capacity"}: {group.dailyCapacity.toFixed(1)}t)
                  </p>
                </div>
                {onConflictClick && group.projects.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] shrink-0"
                    onClick={() => onConflictClick(group.projects[0].projectId)}
                  >
                    {t("goToProject") || "Go to"}
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}
