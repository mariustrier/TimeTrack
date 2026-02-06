"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";
import { Users } from "lucide-react";

interface Employee {
  id: string;
  name: string;
  hours: number;
  weeklyTarget: number;
  utilization: number;
}

interface TeamUtilizationBarsProps {
  employees: Employee[];
}

export function TeamUtilizationBars({ employees }: TeamUtilizationBarsProps) {
  const t = useTranslations("admin");

  // Sort by utilization descending
  const sorted = [...employees].sort((a, b) => b.utilization - a.utilization);

  // Show top 10 for space
  const display = sorted.slice(0, 10);

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 120) return "bg-red-500";
    if (utilization >= 100) return "bg-amber-500";
    if (utilization >= 70) return "bg-green-500";
    return "bg-yellow-500";
  };

  const getUtilizationBg = (utilization: number) => {
    if (utilization >= 120) return "bg-red-100 dark:bg-red-950";
    if (utilization >= 100) return "bg-amber-100 dark:bg-amber-950";
    if (utilization >= 70) return "bg-green-100 dark:bg-green-950";
    return "bg-yellow-100 dark:bg-yellow-950";
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Users className="h-4 w-4" />
          {t("teamUtilization") || "Team Utilization"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {display.map((emp) => (
            <div key={emp.id} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium truncate max-w-[150px]">{emp.name}</span>
                <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded",
                  getUtilizationBg(emp.utilization)
                )}>
                  {emp.utilization}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    getUtilizationColor(emp.utilization)
                  )}
                  style={{ width: `${Math.min(emp.utilization, 150)}%` }}
                />
              </div>
            </div>
          ))}
          {employees.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t("noEmployees") || "No employee data"}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
