"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";
import { AlertTriangle, CheckCircle } from "lucide-react";

interface Project {
  id: string;
  name: string;
  client: string | null;
  color: string;
  budgetHours: number | null;
  budgetTotalHours: number | null;
  hoursUsed: number;
  locked: boolean;
  archived: boolean;
}

interface AtRiskProjectsProps {
  projects: Project[];
}

export function AtRiskProjects({ projects }: AtRiskProjectsProps) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");

  // Filter to projects with budgets and calculate risk
  const projectsWithRisk = projects
    .filter((p) => !p.archived && (p.budgetHours || p.budgetTotalHours))
    .map((p) => {
      const budget = p.budgetTotalHours || p.budgetHours || 0;
      const percentUsed = budget > 0 ? (p.hoursUsed / budget) * 100 : 0;
      const isOverBudget = percentUsed >= 100;
      const isAtRisk = percentUsed >= 80;
      return { ...p, budget, percentUsed, isOverBudget, isAtRisk };
    })
    .filter((p) => p.isAtRisk)
    .sort((a, b) => b.percentUsed - a.percentUsed)
    .slice(0, 5);

  const allHealthy = projectsWithRisk.length === 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          {allHealthy ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          )}
          {t("projectHealth") || "Project Health"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {allHealthy ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <CheckCircle className="h-8 w-8 text-green-500 mb-2" />
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              {t("allProjectsHealthy") || "All projects on track"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("noBudgetConcerns") || "No budget concerns"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {projectsWithRisk.map((project) => (
              <div key={project.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="text-sm font-medium truncate max-w-[120px]">
                      {project.name}
                    </span>
                  </div>
                  <Badge
                    variant={project.isOverBudget ? "destructive" : "outline"}
                    className="text-xs"
                  >
                    {Math.round(project.percentUsed)}%
                  </Badge>
                </div>
                <Progress
                  value={Math.min(project.percentUsed, 100)}
                  className={cn(
                    "h-1.5",
                    project.isOverBudget && "[&>div]:bg-red-500"
                  )}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{Math.round(project.hoursUsed)}{tc("hourAbbrev")} used</span>
                  <span>{Math.round(project.budget)}{tc("hourAbbrev")} budget</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
