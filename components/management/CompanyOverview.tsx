"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  startOfMonth,
  endOfMonth,
  format,
  subMonths,
  addMonths,
} from "date-fns";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Receipt,
  ChevronLeft,
  ChevronRight,
  Users,
  RefreshCw,
  Wallet,
  Lock,
  Unlock,
  Archive,
  ArchiveRestore,
  Globe,
  Eye,
  EyeOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatHours, formatPercentage } from "@/lib/calculations";
import { getToday } from "@/lib/demo-date";
import { useIsDemo } from "@/lib/company-context";
import {
  SUPPORTED_CURRENCIES,
  convertAndFormat,
  convertAndFormatBudget,
} from "@/lib/currency";
import { useTranslations, useDateLocale } from "@/lib/i18n";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { TeamUtilizationBars } from "@/components/admin/TeamUtilizationBars";
import { AtRiskProjects } from "@/components/admin/AtRiskProjects";

interface EmployeeStat {
  id: string;
  name: string;
  email: string;
  hours: number;
  billableHours: number;
  revenue: number;
  cost: number;
  profit: number;
  hourlyRate: number;
  costRate: number;
  weeklyTarget: number;
  isHourly: boolean;
  utilization: number | null;
  employmentType: string;
}

interface ProjectStat {
  id: string;
  name: string;
  client: string | null;
  color: string;
  pricingType: string;
  fixedPrice: number | null;
  budgetHours: number | null;
  rateMode: string;
  projectRate: number | null;
  effectiveRate: number;
  budgetTotalHours: number | null;
  hoursUsed: number;
  allocations: {
    userId: string;
    userName: string;
    hours: number;
    hoursUsed: number;
  }[];
  locked: boolean;
  archived: boolean;
  systemManaged: boolean;
}

interface Stats {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  totalHours: number;
  billableHours: number;
  utilization: number;
  employeeStats: EmployeeStat[];
  projectStats: ProjectStat[];
  totalProjectExpenses: number;
  totalOverhead: number;
  totalExpenses: number;
  workingDays: number;
  totalPeriodWorkingDays: number;
  currency: string;
  defaultHourlyRate: number | null;
  useUniversalRate: boolean;
}

export function CompanyOverview() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const tt = useTranslations("team");
  const dateLocale = useDateLocale();
  const formatOpts = dateLocale ? { locale: dateLocale } : undefined;
  const isDemo = useIsDemo();

  const [currentMonth, setCurrentMonth] = useState(() => getToday(isDemo));
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const isRefreshing = useRef(false);

  const [masterCurrency, setMasterCurrency] = useState("USD");
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [showCostRates, setShowCostRates] = useState(false);

  // Allocation dialog state
  const [allocDialogOpen, setAllocDialogOpen] = useState(false);
  const [allocProject, setAllocProject] = useState<ProjectStat | null>(null);
  const [allocInputs, setAllocInputs] = useState<Record<string, string>>({});
  const [allocSaving, setAllocSaving] = useState(false);

  const monthStart = useMemo(
    () => startOfMonth(currentMonth),
    [currentMonth]
  );
  const monthEnd = useMemo(() => endOfMonth(currentMonth), [currentMonth]);

  const fetchStats = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      isRefreshing.current = true;
      try {
        const start = format(monthStart, "yyyy-MM-dd");
        const end = format(monthEnd, "yyyy-MM-dd");
        const res = await fetch(
          `/api/admin/stats?startDate=${start}&endDate=${end}`
        );
        if (res.ok) {
          setStats(await res.json());
          setLastUpdated(new Date());
        }
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setLoading(false);
        isRefreshing.current = false;
      }
    },
    [monthStart, monthEnd]
  );

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Auto-refresh: 30s polling + refetch on window focus
  useEffect(() => {
    const onFocus = () => fetchStats(true);
    window.addEventListener("focus", onFocus);
    const interval = setInterval(() => fetchStats(true), 30000);
    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(interval);
    };
  }, [fetchStats]);

  // Fetch company currency on mount
  useEffect(() => {
    fetch("/api/admin/economic")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setMasterCurrency(data.currency || "USD");
          setDisplayCurrency(data.currency || "USD");
        }
      })
      .catch(() => {});
  }, []);

  async function handleAllocSave() {
    if (!allocProject) return;
    setAllocSaving(true);
    try {
      const allocations = Object.entries(allocInputs)
        .filter(([, v]) => parseFloat(v) > 0)
        .map(([userId, hours]) => ({ userId, hours: parseFloat(hours) }));
      await fetch(`/api/projects/${allocProject.id}/allocations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allocations }),
      });
      toast.success(t("allocationSaved"));
      setAllocDialogOpen(false);
      fetchStats(true);
    } catch {
      // handle error
    } finally {
      setAllocSaving(false);
    }
  }

  function openAllocDialog(project: ProjectStat) {
    setAllocProject(project);
    const inputs: Record<string, string> = {};
    for (const a of project.allocations) {
      inputs[a.userId] = String(a.hours);
    }
    if (stats) {
      for (const emp of stats.employeeStats) {
        if (!(emp.id in inputs)) {
          inputs[emp.id] = "";
        }
      }
    }
    setAllocInputs(inputs);
    setAllocDialogOpen(true);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <BarChart3 className="h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-semibold text-foreground">
          {t("noData")}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("noDataDescription")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={displayCurrency} onValueChange={setDisplayCurrency}>
            <SelectTrigger className="w-[100px]">
              <Globe className="mr-1 h-3.5 w-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {displayCurrency !== masterCurrency && (
            <span className="text-xs text-muted-foreground">
              {t("convertedFrom").replace("{currency}", masterCurrency)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => setCurrentMonth(getToday(isDemo))}
          >
            {t("thisMonth")}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-sm text-muted-foreground">
            {format(monthStart, "MMMM yyyy", formatOpts)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fetchStats(true)}
            className="ml-1"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              {tc("lastUpdated").replace(
                "{time}",
                format(lastUpdated, "HH:mm:ss")
              )}
            </span>
          )}
        </div>
      </div>

      {/* Company Stat Cards - Row 1: Financial */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950">
                <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {t("revenue")}{" "}
                  <InfoTooltip textKey="revenue" size={12} />
                </p>
                <p
                  className="text-lg font-bold truncate"
                  title={convertAndFormat(
                    stats.totalRevenue,
                    masterCurrency,
                    displayCurrency
                  )}
                >
                  {convertAndFormat(
                    stats.totalRevenue,
                    masterCurrency,
                    displayCurrency
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950">
                <Receipt className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">{t("cost")}</p>
                <p
                  className="text-lg font-bold truncate"
                  title={convertAndFormat(
                    stats.totalCost,
                    masterCurrency,
                    displayCurrency
                  )}
                >
                  {convertAndFormat(
                    stats.totalCost,
                    masterCurrency,
                    displayCurrency
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                  stats.totalProfit >= 0
                    ? "bg-emerald-50 dark:bg-emerald-950"
                    : "bg-red-50 dark:bg-red-950"
                )}
              >
                {stats.totalProfit >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">{t("profit")}</p>
                <p
                  className="text-lg font-bold truncate"
                  title={convertAndFormat(
                    stats.totalProfit - stats.totalExpenses,
                    masterCurrency,
                    displayCurrency
                  )}
                >
                  {convertAndFormat(
                    stats.totalProfit - stats.totalExpenses,
                    masterCurrency,
                    displayCurrency
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Company Stat Cards - Row 2: Operations */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950">
                <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {t("utilization")}{" "}
                  <InfoTooltip textKey="utilization" size={12} />
                </p>
                <p className="text-lg font-bold truncate">
                  {formatPercentage(stats.utilization)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-950">
                <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">
                  {t("teamHours")}
                </p>
                <p className="text-lg font-bold truncate">
                  {formatHours(stats.totalHours, tc("hourAbbrev"))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950">
                <Wallet className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">
                  {t("totalExpenses")}
                </p>
                <p
                  className="text-lg font-bold truncate"
                  title={convertAndFormat(
                    stats.totalExpenses,
                    masterCurrency,
                    displayCurrency
                  )}
                >
                  {convertAndFormat(
                    stats.totalExpenses,
                    masterCurrency,
                    displayCurrency
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Overview Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TeamUtilizationBars
          employees={stats.employeeStats.map((emp) => ({
            id: emp.id,
            name: emp.name,
            hours: emp.hours,
            weeklyTarget: emp.weeklyTarget,
            isHourly: emp.isHourly,
            utilization: emp.utilization,
          }))}
        />
        <AtRiskProjects
          projects={stats.projectStats.map((p) => ({
            id: p.id,
            name: p.name,
            client: p.client,
            color: p.color,
            budgetHours: p.budgetHours,
            budgetTotalHours: p.budgetTotalHours,
            hoursUsed: p.hoursUsed,
            locked: p.locked,
            archived: p.archived,
          }))}
        />
      </div>

      {/* Project Budgets */}
      {stats.projectStats && stats.projectStats.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t("projectBudgets")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.projectStats.map((project) => {
              const isFixed =
                project.pricingType === "fixed_price" && project.fixedPrice;
              const totalHours = project.budgetTotalHours || 0;
              const percent =
                totalHours > 0
                  ? (project.hoursUsed / totalHours) * 100
                  : 0;
              const progressColor =
                percent >= 90
                  ? "bg-red-500"
                  : percent >= 75
                    ? "bg-amber-500"
                    : "bg-emerald-500";
              const noRate = isFixed && !project.budgetTotalHours;

              return (
                <div
                  key={project.id}
                  className={cn(
                    "space-y-2",
                    project.archived && "opacity-50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: project.color }}
                      />
                      <span className="text-sm font-medium">
                        {project.name}
                      </span>
                      {project.client && (
                        <span className="text-xs text-muted-foreground">
                          ({project.client})
                        </span>
                      )}
                      {isFixed && (
                        <Badge variant="outline" className="text-xs">
                          {t("fixedPrice")}
                        </Badge>
                      )}
                      {project.locked && (
                        <Badge variant="secondary" className="text-xs">
                          <Lock className="h-3 w-3 mr-1" />
                          {t("projectLocked")}
                        </Badge>
                      )}
                      {project.archived && (
                        <Badge variant="secondary" className="text-xs">
                          <Archive className="h-3 w-3 mr-1" />
                          {t("projectArchived")}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {noRate ? (
                        <span className="text-sm text-amber-600">
                          {t("noRateSet")}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {project.hoursUsed} / {totalHours}
                          {tc("hourAbbrev")} ({Math.round(percent)}%)
                        </span>
                      )}
                      {!project.systemManaged && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              try {
                                const res = await fetch(
                                  `/api/projects/${project.id}`,
                                  {
                                    method: "PUT",
                                    headers: {
                                      "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                      locked: !project.locked,
                                    }),
                                  }
                                );
                                if (res.ok) {
                                  fetchStats(true);
                                  toast.success(
                                    project.locked
                                      ? t("projectUnlocked")
                                      : t("projectLockedSuccess")
                                  );
                                }
                              } catch {
                                toast.error("Failed to update project");
                              }
                            }}
                            title={
                              project.locked
                                ? t("unlockProject")
                                : t("lockProject")
                            }
                          >
                            {project.locked ? (
                              <Unlock className="h-4 w-4" />
                            ) : (
                              <Lock className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              try {
                                const res = await fetch(
                                  `/api/projects/${project.id}`,
                                  {
                                    method: "PUT",
                                    headers: {
                                      "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                      archived: !project.archived,
                                    }),
                                  }
                                );
                                if (res.ok) {
                                  fetchStats(true);
                                  toast.success(
                                    project.archived
                                      ? t("projectUnarchived")
                                      : t("projectArchivedSuccess")
                                  );
                                }
                              } catch {
                                toast.error("Failed to update project");
                              }
                            }}
                            title={
                              project.archived
                                ? t("unarchiveProject")
                                : t("archiveProject")
                            }
                          >
                            {project.archived ? (
                              <ArchiveRestore className="h-4 w-4" />
                            ) : (
                              <Archive className="h-4 w-4" />
                            )}
                          </Button>
                        </>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAllocDialog(project)}
                      >
                        {t("allocate")}
                      </Button>
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        progressColor
                      )}
                      style={{
                        width: `${Math.min(percent, 100)}%`,
                      }}
                    />
                  </div>
                  {isFixed && project.effectiveRate > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {convertAndFormat(
                        project.fixedPrice!,
                        masterCurrency,
                        displayCurrency
                      )}{" "}
                      @{" "}
                      {convertAndFormat(
                        project.effectiveRate,
                        masterCurrency,
                        displayCurrency
                      )}
                      {t("perHour")}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Employee Profitability */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">
            {t("employeeProfitability")}
          </h2>
          <button
            type="button"
            onClick={() => setShowCostRates(!showCostRates)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title={
              showCostRates ? tt("hideCostRates") : tt("showCostRates")
            }
          >
            {showCostRates ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
          </button>
        </div>
        {stats.employeeStats.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                {t("noMembersTitle")}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("noMembersDescription")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stats.employeeStats.map((emp) => (
              <Card key={emp.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{emp.name}</CardTitle>
                    <div className="flex items-center gap-1.5">
                      {emp.employmentType === "freelancer" && (
                        <Badge
                          variant="outline"
                          className="border-amber-500 text-amber-600"
                        >
                          {tt("freelancer")}
                        </Badge>
                      )}
                      <Badge
                        variant={
                          emp.profit >= 0 ? "default" : "destructive"
                        }
                      >
                        {emp.profit >= 0 ? t("profitable") : t("loss")}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{emp.email}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Hours Progress */}
                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {tc("hours")}
                      </span>
                      <span className="font-medium">
                        {emp.isHourly
                          ? formatHours(emp.hours, tc("hourAbbrev"))
                          : `${formatHours(emp.hours, tc("hourAbbrev"))} / ${formatHours(Math.round((emp.weeklyTarget / 5) * (stats.totalPeriodWorkingDays || 1)), tc("hourAbbrev"))}`}
                      </span>
                    </div>
                    {!emp.isHourly && (
                      <>
                        <Progress
                          value={Math.min(emp.utilization ?? 0, 100)}
                          className="h-2"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {emp.weeklyTarget}
                          {tc("hourAbbrev")}
                          {t("perWeek")}
                        </p>
                      </>
                    )}
                    {emp.isHourly && (
                      <Badge
                        variant="outline"
                        className="border-blue-500 text-blue-600 text-xs"
                      >
                        {tt("hourly")}
                      </Badge>
                    )}
                  </div>

                  {/* Rates */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">
                        {tt("billRate")}
                      </p>
                      <p className="font-medium">
                        {convertAndFormat(
                          emp.hourlyRate,
                          masterCurrency,
                          displayCurrency
                        )}
                        {t("perHour")}
                        {stats.useUniversalRate &&
                          emp.employmentType !== "freelancer" && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              (universal)
                            </span>
                          )}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">
                        {tt("costRate")}
                      </p>
                      <p className="font-medium">
                        {showCostRates
                          ? `${convertAndFormat(emp.costRate, masterCurrency, displayCurrency)}${t("perHour")}`
                          : `*** kr.${t("perHour")}`}
                      </p>
                    </div>
                  </div>

                  {/* Weekly P&L */}
                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {t("revenue")}
                        </span>
                        <span className="text-emerald-600">
                          {convertAndFormat(
                            emp.revenue,
                            masterCurrency,
                            displayCurrency
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {t("cost")}
                        </span>
                        <span className="text-red-600">
                          {showCostRates
                            ? `-${convertAndFormat(emp.cost, masterCurrency, displayCurrency)}`
                            : "***"}
                        </span>
                      </div>
                      <div className="border-t pt-1 flex justify-between font-semibold">
                        <span>{t("profit")}</span>
                        <span
                          className={
                            emp.profit >= 0
                              ? "text-emerald-600"
                              : "text-red-600"
                          }
                        >
                          {showCostRates
                            ? convertAndFormat(
                                emp.profit,
                                masterCurrency,
                                displayCurrency
                              )
                            : "***"}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Allocation Dialog */}
      <Dialog open={allocDialogOpen} onOpenChange={setAllocDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("allocateHours")}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {t("allocateDescription").replace(
                "{project}",
                allocProject?.name || ""
              )}
            </p>
          </DialogHeader>
          {allocProject && (
            <div className="space-y-4">
              <div className="flex justify-between text-sm font-medium">
                <span>
                  {tc("project")}: {allocProject.name}
                </span>
                <span>
                  {allocProject.budgetTotalHours
                    ? `Budget: ${allocProject.budgetTotalHours}${tc("hourAbbrev")}`
                    : allocProject?.pricingType === "fixed_price"
                      ? `${t("fixedPrice")}: ${convertAndFormat(allocProject?.fixedPrice || 0, masterCurrency, displayCurrency)}`
                      : `Budget: ${allocProject?.budgetHours || 0}${tc("hourAbbrev")}`}
                </span>
              </div>
              {/* Rate mode indicator for fixed-price projects */}
              {allocProject.pricingType === "fixed_price" &&
                (() => {
                  const rm = allocProject.rateMode || "COMPANY_RATE";
                  return (
                    <div className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
                      {rm === "EMPLOYEE_RATES" ? (
                        <span>{tt("billRate")} per employee</span>
                      ) : allocProject.effectiveRate > 0 ? (
                        <span>
                          {allocProject.effectiveRate} {masterCurrency}
                          {t("perHour")}
                          {allocProject.budgetTotalHours && (
                            <span className="ml-2 text-foreground font-medium">
                              ({allocProject.budgetTotalHours}
                              {tc("hourAbbrev")} available)
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-amber-600">
                          {t("noRateSet")}
                        </span>
                      )}
                      {allocProject.fixedPrice && (
                        <span className="ml-2">
                          (
                          {convertAndFormat(
                            allocProject.fixedPrice,
                            masterCurrency,
                            displayCurrency
                          )}
                          )
                        </span>
                      )}
                    </div>
                  );
                })()}
              <div className="space-y-3">
                {stats?.employeeStats.map((emp) => {
                  const isEmployeeRates =
                    allocProject.pricingType === "fixed_price" &&
                    allocProject.rateMode === "EMPLOYEE_RATES";
                  const empHours =
                    parseFloat(allocInputs[emp.id] || "0") || 0;
                  const empRate =
                    emp.hourlyRate || stats?.defaultHourlyRate || 0;
                  const allocData = allocProject.allocations.find(
                    (a) => a.userId === emp.id
                  );
                  const usedHours = allocData?.hoursUsed || 0;
                  const unusedHours = empHours - usedHours;
                  const belowUsed = empHours > 0 && empHours < usedHours;
                  return (
                    <div key={emp.id} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm truncate block">
                          {emp.name}
                        </span>
                        <div className="flex items-center gap-2">
                          {usedHours > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {t("usedHours")}: {usedHours}
                              {tc("hourAbbrev")}
                            </span>
                          )}
                          {isEmployeeRates && (
                            <span className="text-xs text-muted-foreground">
                              {empRate} {masterCurrency}
                              {t("perHour")}
                              {empHours > 0 &&
                                ` = ${convertAndFormat(empHours * empRate, masterCurrency, displayCurrency)}`}
                            </span>
                          )}
                        </div>
                      </div>
                      <Input
                        type="number"
                        className={cn(
                          "w-24",
                          belowUsed && "border-red-500"
                        )}
                        placeholder="0"
                        min={usedHours}
                        value={allocInputs[emp.id] || ""}
                        onChange={(e) =>
                          setAllocInputs((prev) => ({
                            ...prev,
                            [emp.id]: e.target.value,
                          }))
                        }
                      />
                      <div className="text-xs text-muted-foreground w-16 text-right">
                        {empHours > 0 && unusedHours > 0 && (
                          <span className="text-emerald-600">
                            +{unusedHours}
                            {tc("hourAbbrev")}
                          </span>
                        )}
                        {belowUsed && (
                          <span className="text-red-600">
                            min {usedHours}
                            {tc("hourAbbrev")}
                          </span>
                        )}
                        {empHours === 0 && tc("hourAbbrev")}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Show allocated total */}
              {(() => {
                const isFixed =
                  allocProject.pricingType === "fixed_price" &&
                  allocProject.fixedPrice;
                const rm = allocProject.rateMode || "COMPANY_RATE";
                const totalAllocated = Object.values(allocInputs).reduce(
                  (s, v) => s + (parseFloat(v) || 0),
                  0
                );

                if (!isFixed) {
                  const remaining =
                    (allocProject.budgetHours || 0) - totalAllocated;
                  return (
                    <div
                      className={cn(
                        "rounded-lg p-3 text-sm",
                        remaining < 0
                          ? "bg-red-50 dark:bg-red-950"
                          : "bg-muted/50"
                      )}
                    >
                      <div className="flex justify-between">
                        <span>{t("allocated")}</span>
                        <span className="font-medium">
                          {totalAllocated}
                          {tc("hourAbbrev")}
                        </span>
                      </div>
                      {remaining >= 0 ? (
                        <div className="flex justify-between text-muted-foreground">
                          <span>{t("unallocated")}</span>
                          <span>
                            {remaining}
                            {tc("hourAbbrev")}
                          </span>
                        </div>
                      ) : (
                        <div className="flex justify-between text-red-600">
                          <span>
                            {t("overAllocated").replace(
                              "{hours}",
                              Math.abs(remaining).toString()
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                }

                if (rm === "EMPLOYEE_RATES") {
                  const totalCost = (stats?.employeeStats || []).reduce(
                    (sum, emp) => {
                      const empHours =
                        parseFloat(allocInputs[emp.id] || "0") || 0;
                      const empRate =
                        emp.hourlyRate || stats?.defaultHourlyRate || 0;
                      return sum + empHours * empRate;
                    },
                    0
                  );
                  const budgetRemaining =
                    (allocProject.fixedPrice || 0) - totalCost;
                  const isOver = budgetRemaining < 0;
                  return (
                    <div
                      className={cn(
                        "rounded-lg p-3 text-sm",
                        isOver
                          ? "bg-red-50 dark:bg-red-950"
                          : "bg-muted/50"
                      )}
                    >
                      <div className="flex justify-between">
                        <span>{t("allocated")}</span>
                        <span className="font-medium">
                          {totalAllocated}
                          {tc("hourAbbrev")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t("budgetUsedMoney")}</span>
                        <span className="font-medium">
                          {convertAndFormat(
                            totalCost,
                            masterCurrency,
                            displayCurrency
                          )}
                        </span>
                      </div>
                      <Separator className="my-1" />
                      <div
                        className={cn(
                          "flex justify-between font-medium",
                          isOver
                            ? "text-red-600"
                            : "text-muted-foreground"
                        )}
                      >
                        <span>{t("budgetRemaining")}</span>
                        <span>
                          {isOver && "-"}
                          {convertAndFormat(
                            Math.abs(budgetRemaining),
                            masterCurrency,
                            displayCurrency
                          )}
                        </span>
                      </div>
                    </div>
                  );
                }

                const availableHours = allocProject.budgetTotalHours;
                if (!availableHours || availableHours <= 0) {
                  return (
                    <div className="rounded-lg p-3 text-sm bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400">
                      {t("noRateSet")}
                    </div>
                  );
                }
                const remaining =
                  Math.round((availableHours - totalAllocated) * 10) / 10;
                return (
                  <div
                    className={cn(
                      "rounded-lg p-3 text-sm",
                      remaining < 0
                        ? "bg-red-50 dark:bg-red-950"
                        : "bg-muted/50"
                    )}
                  >
                    <div className="flex justify-between">
                      <span>{t("allocated")}</span>
                      <span className="font-medium">
                        {totalAllocated}
                        {tc("hourAbbrev")} / {availableHours}
                        {tc("hourAbbrev")}
                      </span>
                    </div>
                    {remaining >= 0 ? (
                      <div className="flex justify-between text-muted-foreground">
                        <span>{t("unallocated")}</span>
                        <span>
                          {remaining}
                          {tc("hourAbbrev")}
                        </span>
                      </div>
                    ) : (
                      <div className="flex justify-between text-red-600">
                        <span>
                          {t("overAllocated").replace(
                            "{hours}",
                            Math.abs(remaining).toString()
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAllocDialogOpen(false)}
            >
              {tc("cancel")}
            </Button>
            <Button onClick={handleAllocSave} disabled={allocSaving}>
              {allocSaving ? tc("saving") : tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
