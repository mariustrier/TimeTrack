"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";
import { Users, AlertTriangle, CheckCircle } from "lucide-react";

interface Employee {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

interface CapacitySummaryProps {
  employees: Employee[];
  utilization: Record<string, { allocated: number; target: number }>;
}

export function CapacitySummary({ employees, utilization }: CapacitySummaryProps) {
  const t = useTranslations("resourcePlanner");

  const overbooked = employees.filter((emp) => {
    const u = utilization[emp.id];
    return u && u.allocated > u.target;
  });

  const underutilized = employees.filter((emp) => {
    const u = utilization[emp.id];
    return u && u.target > 0 && u.allocated < u.target * 0.5;
  });

  const totalAllocated = Object.values(utilization).reduce((sum, u) => sum + u.allocated, 0);
  const totalTarget = Object.values(utilization).reduce((sum, u) => sum + u.target, 0);
  const overallUtilization = totalTarget > 0 ? Math.round((totalAllocated / totalTarget) * 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Overall Utilization */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              overallUtilization > 100 ? "bg-red-100 dark:bg-red-900" :
              overallUtilization > 80 ? "bg-green-100 dark:bg-green-900" :
              "bg-yellow-100 dark:bg-yellow-900"
            )}>
              <Users className={cn(
                "h-5 w-5",
                overallUtilization > 100 ? "text-red-600 dark:text-red-400" :
                overallUtilization > 80 ? "text-green-600 dark:text-green-400" :
                "text-yellow-600 dark:text-yellow-400"
              )} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("teamUtilization") || "Team Utilization"}</p>
              <p className="text-2xl font-bold font-mono">{overallUtilization}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overbooked */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              overbooked.length > 0 ? "bg-red-100 dark:bg-red-900" : "bg-green-100 dark:bg-green-900"
            )}>
              {overbooked.length > 0 ? (
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("overbooked") || "Overbooked"}</p>
              <p className="text-2xl font-bold font-mono">{overbooked.length}</p>
              {overbooked.length > 0 && (
                <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                  {overbooked.map(e => e.firstName || e.email.split("@")[0]).join(", ")}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Underutilized */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              underutilized.length > 0 ? "bg-yellow-100 dark:bg-yellow-900" : "bg-green-100 dark:bg-green-900"
            )}>
              <Users className={cn(
                "h-5 w-5",
                underutilized.length > 0 ? "text-yellow-600 dark:text-yellow-400" : "text-green-600 dark:text-green-400"
              )} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("available") || "Available"}</p>
              <p className="text-2xl font-bold font-mono">{underutilized.length}</p>
              {underutilized.length > 0 && (
                <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                  {underutilized.map(e => e.firstName || e.email.split("@")[0]).join(", ")}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
