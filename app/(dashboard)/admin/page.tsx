"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  startOfWeek,
  endOfWeek,
  format,
  subWeeks,
  addWeeks,
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
  Download,
  Save,
  FileSpreadsheet,
  Globe,
  RefreshCw,
  AlertTriangle,
  Wallet,
  Building2,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { SUPPORTED_CURRENCIES, convertAndFormat, convertAndFormatBudget } from "@/lib/currency";
import { useTranslations, useDateLocale } from "@/lib/i18n";
import { PageGuide } from "@/components/ui/page-guide";
import { InfoTooltip } from "@/components/ui/info-tooltip";

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
  utilization: number;
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
  allocations: { userId: string; userName: string; hours: number; hoursUsed: number }[];
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
  currency: string;
  defaultHourlyRate: number | null;
  useUniversalRate: boolean;
}

export default function AdminPage() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const tt = useTranslations("team");
  const dateLocale = useDateLocale();
  const formatOpts = dateLocale ? { locale: dateLocale } : undefined;

  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const isRefreshing = useRef(false);

  // e-conomic export state
  const [ecoRevenueAccount, setEcoRevenueAccount] = useState("");
  const [ecoCounterAccount, setEcoCounterAccount] = useState("");
  const [ecoVatCode, setEcoVatCode] = useState("");
  const [ecoCurrency, setEcoCurrency] = useState("DKK");
  const [ecoSaving, setEcoSaving] = useState(false);
  const [ecoSaved, setEcoSaved] = useState(false);
  const [ecoExportStart, setEcoExportStart] = useState("");
  const [ecoExportEnd, setEcoExportEnd] = useState("");
  const [ecoExporting, setEcoExporting] = useState(false);
  const [ecoError, setEcoError] = useState("");
  const [masterCurrency, setMasterCurrency] = useState("USD");
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [showMasterCurrencyDialog, setShowMasterCurrencyDialog] = useState(false);
  const [newMasterCurrency, setNewMasterCurrency] = useState("USD");
  const [useUniversalRate, setUseUniversalRate] = useState(false);
  const [universalRateInput, setUniversalRateInput] = useState("");
  const [universalRateSaving, setUniversalRateSaving] = useState(false);
  const [expenseThresholdInput, setExpenseThresholdInput] = useState("");
  const [expenseThresholdSaving, setExpenseThresholdSaving] = useState(false);
  const [receiptExportStart, setReceiptExportStart] = useState("");
  const [receiptExportEnd, setReceiptExportEnd] = useState("");
  const [receiptExporting, setReceiptExporting] = useState(false);

  // Allocation dialog state
  const [allocDialogOpen, setAllocDialogOpen] = useState(false);
  const [allocProject, setAllocProject] = useState<ProjectStat | null>(null);
  const [allocInputs, setAllocInputs] = useState<Record<string, string>>({});
  const [allocSaving, setAllocSaving] = useState(false);

  const weekStart = useMemo(() => startOfWeek(currentWeek, { weekStartsOn: 1 }), [currentWeek]);
  const weekEnd = useMemo(() => endOfWeek(currentWeek, { weekStartsOn: 1 }), [currentWeek]);

  const fetchStats = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    isRefreshing.current = true;
    try {
      const start = format(weekStart, "yyyy-MM-dd");
      const end = format(weekEnd, "yyyy-MM-dd");
      const res = await fetch(`/api/admin/stats?startDate=${start}&endDate=${end}`);
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
  }, [weekStart, weekEnd]);

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

  // Load e-conomic settings + company currency on mount
  useEffect(() => {
    fetch("/api/admin/economic")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data) {
          setMasterCurrency(data.currency || "USD");
          setDisplayCurrency(data.currency || "USD");
          setEcoRevenueAccount(data.economicRevenueAccount || "");
          setEcoCounterAccount(data.economicCounterAccount || "");
          setEcoVatCode(data.economicVatCode || "");
          setEcoCurrency(data.economicCurrency || "DKK");
          setUseUniversalRate(data.useUniversalRate || false);
          setUniversalRateInput(data.defaultHourlyRate?.toString() || "");
          setExpenseThresholdInput(data.expenseAutoApproveThreshold?.toString() || "");
        }
      })
      .catch(() => {});
  }, []);

  async function handleEcoSave() {
    setEcoSaving(true);
    setEcoSaved(false);
    try {
      await fetch("/api/admin/economic", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          economicRevenueAccount: ecoRevenueAccount,
          economicCounterAccount: ecoCounterAccount,
          economicVatCode: ecoVatCode,
          economicCurrency: ecoCurrency,
        }),
      });
      setEcoSaved(true);
      setTimeout(() => setEcoSaved(false), 2000);
    } catch {
      setEcoError("Failed to save settings");
    } finally {
      setEcoSaving(false);
    }
  }

  async function handleEcoExport() {
    setEcoExporting(true);
    setEcoError("");
    try {
      const res = await fetch(
        `/api/admin/economic/export?startDate=${ecoExportStart}&endDate=${ecoExportEnd}`
      );
      if (!res.ok) {
        const data = await res.json();
        setEcoError(data.error || "Export failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `e-conomic-export-${ecoExportStart}-to-${ecoExportEnd}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setEcoError("Export failed");
    } finally {
      setEcoExporting(false);
    }
  }

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
      fetchStats(true); // silent refresh
    } catch {
      // handle error
    } finally {
      setAllocSaving(false);
    }
  }

  function openAllocDialog(project: ProjectStat) {
    setAllocProject(project);
    const inputs: Record<string, string> = {};
    // Pre-fill from existing allocations
    for (const a of project.allocations) {
      inputs[a.userId] = String(a.hours);
    }
    // Also include team members without allocations
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
        <h3 className="mt-4 text-lg font-semibold text-foreground">{t("noData")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t("noDataDescription")}</p>
      </div>
    );
  }

  const monthlyProjection = {
    revenue: stats.totalRevenue * 4,
    cost: (stats.totalCost + stats.totalExpenses) * 4,
    profit: (stats.totalProfit - stats.totalExpenses) * 4,
  };

  return (
    <div className="space-y-6">
      <PageGuide
        pageId="admin"
        titleKey="adminTitle"
        descKey="adminDesc"
        tips={["adminTip1", "adminTip2", "adminTip3"]}
      />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <Select value={displayCurrency} onValueChange={setDisplayCurrency}>
            <SelectTrigger className="w-[100px]">
              <Globe className="mr-1 h-3.5 w-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
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
          <Button variant="outline" size="icon" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setCurrentWeek(new Date())}>
            {t("thisWeek")}
          </Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-sm text-muted-foreground">
            {format(weekStart, "MMM d", formatOpts)} - {format(weekEnd, "MMM d, yyyy", formatOpts)}
          </span>
          <Button variant="ghost" size="icon" onClick={() => fetchStats(true)} className="ml-1">
            <RefreshCw className="h-4 w-4" />
          </Button>
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              {tc("lastUpdated").replace("{time}", format(lastUpdated, "HH:mm:ss"))}
            </span>
          )}
        </div>
      </div>

      {/* Company Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950">
                <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">{t("revenue")} <InfoTooltip textKey="revenue" size={12} /></p>
                <p className="text-xl font-bold">{convertAndFormat(stats.totalRevenue, masterCurrency, displayCurrency)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950">
                <Receipt className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("cost")}</p>
                <p className="text-xl font-bold">{convertAndFormat(stats.totalCost, masterCurrency, displayCurrency)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                stats.totalProfit >= 0 ? "bg-emerald-50 dark:bg-emerald-950" : "bg-red-50 dark:bg-red-950"
              )}>
                {stats.totalProfit >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("profit")}</p>
                <p className="text-xl font-bold">{convertAndFormat(stats.totalProfit - stats.totalExpenses, masterCurrency, displayCurrency)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950">
                <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">{t("utilization")} <InfoTooltip textKey="utilization" size={12} /></p>
                <p className="text-xl font-bold">{formatPercentage(stats.utilization)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-950">
                <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("teamHours")}</p>
                <p className="text-xl font-bold">{formatHours(stats.totalHours)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950">
                <Wallet className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("totalExpenses")}</p>
                <p className="text-xl font-bold">{convertAndFormat(stats.totalExpenses, masterCurrency, displayCurrency)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Projection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t("monthlyProjection")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground">{t("revenue")}</p>
              <p className="text-lg font-bold text-emerald-600">{convertAndFormat(monthlyProjection.revenue, masterCurrency, displayCurrency)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("cost")}</p>
              <p className="text-lg font-bold text-red-600">{convertAndFormat(monthlyProjection.cost, masterCurrency, displayCurrency)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("profit")}</p>
              <p className={cn("text-lg font-bold", monthlyProjection.profit >= 0 ? "text-emerald-600" : "text-red-600")}>
                {convertAndFormat(monthlyProjection.profit, masterCurrency, displayCurrency)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Project Budgets */}
      {stats.projectStats && stats.projectStats.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t("projectBudgets")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.projectStats.map((project) => {
              const isFixed = project.pricingType === "fixed_price" && project.fixedPrice;
              const totalHours = project.budgetTotalHours || 0;
              const percent = totalHours > 0
                ? (project.hoursUsed / totalHours) * 100
                : 0;
              const progressColor = percent >= 90 ? "bg-red-500" : percent >= 75 ? "bg-amber-500" : "bg-emerald-500";
              const noRate = isFixed && !project.budgetTotalHours;

              return (
                <div key={project.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: project.color }} />
                      <span className="text-sm font-medium">{project.name}</span>
                      {project.client && <span className="text-xs text-muted-foreground">({project.client})</span>}
                      {isFixed && <Badge variant="outline" className="text-xs">{t("fixedPrice")}</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      {noRate ? (
                        <span className="text-sm text-amber-600">{t("noRateSet")}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {project.hoursUsed} / {totalHours}h ({Math.round(percent)}%)
                        </span>
                      )}
                      <Button variant="outline" size="sm" onClick={() => openAllocDialog(project)}>
                        {t("allocate")}
                      </Button>
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", progressColor)} style={{ width: `${Math.min(percent, 100)}%` }} />
                  </div>
                  {isFixed && project.effectiveRate > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {convertAndFormat(project.fixedPrice!, masterCurrency, displayCurrency)} @ {convertAndFormat(project.effectiveRate, masterCurrency, displayCurrency)}/h
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
        <h2 className="mb-4 text-lg font-semibold text-foreground">{t("employeeProfitability")}</h2>
        {stats.employeeStats.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">{t("noMembersTitle")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("noMembersDescription")}</p>
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
                        <Badge variant="outline" className="border-amber-500 text-amber-600">
                          {tt("freelancer")}
                        </Badge>
                      )}
                      <Badge variant={emp.profit >= 0 ? "default" : "destructive"}>
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
                      <span className="text-muted-foreground">{tc("hours")}</span>
                      <span className="font-medium">
                        {formatHours(emp.hours)} / {formatHours(emp.weeklyTarget)}
                      </span>
                    </div>
                    <Progress
                      value={Math.min(emp.utilization, 100)}
                      className="h-2"
                    />
                  </div>

                  {/* Rates */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">{tt("billRate")}</p>
                      <p className="font-medium">
                        {convertAndFormat(emp.hourlyRate, masterCurrency, displayCurrency)}/h
                        {stats.useUniversalRate && emp.employmentType !== "freelancer" && (
                          <span className="ml-1 text-xs text-muted-foreground">(universal)</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{tt("costRate")}</p>
                      <p className="font-medium">{convertAndFormat(emp.costRate, masterCurrency, displayCurrency)}/h</p>
                    </div>
                  </div>

                  {/* Weekly P&L */}
                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("revenue")}</span>
                        <span className="text-emerald-600">{convertAndFormat(emp.revenue, masterCurrency, displayCurrency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("cost")}</span>
                        <span className="text-red-600">-{convertAndFormat(emp.cost, masterCurrency, displayCurrency)}</span>
                      </div>
                      <div className="border-t pt-1 flex justify-between font-semibold">
                        <span>{t("profit")}</span>
                        <span className={emp.profit >= 0 ? "text-emerald-600" : "text-red-600"}>
                          {convertAndFormat(emp.profit, masterCurrency, displayCurrency)}
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

      {/* Master Currency */}
      <Card data-tour="admin-currency">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-foreground">{t("masterCurrency")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("masterCurrencyDescription")}</p>
          <div className="mt-4 flex items-center gap-3">
            <Badge variant="secondary" className="text-base px-3 py-1">{masterCurrency}</Badge>
            <Button variant="outline" size="sm" onClick={() => {
              setNewMasterCurrency(masterCurrency);
              setShowMasterCurrencyDialog(true);
            }}>
              {t("changeMasterCurrency")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Universal Bill Rate */}
      <Card data-tour="admin-bill-rate">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-1.5">{t("universalBillRate")} <InfoTooltip textKey="universalBillRate" /></h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("universalBillRateDesc")}</p>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={async () => {
                const newVal = !useUniversalRate;
                setUseUniversalRate(newVal);
                setUniversalRateSaving(true);
                try {
                  await fetch("/api/admin/economic", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ useUniversalRate: newVal, defaultHourlyRate: universalRateInput }),
                  });
                  fetchStats(true);
                } catch { /* ignore */ } finally {
                  setUniversalRateSaving(false);
                }
              }}
              disabled={universalRateSaving}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                useUniversalRate ? "bg-primary" : "bg-muted-foreground/30"
              )}
            >
              <span className={cn(
                "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                useUniversalRate ? "translate-x-6" : "translate-x-1"
              )} />
            </button>
            <Badge variant={useUniversalRate ? "default" : "secondary"}>
              {useUniversalRate ? t("universalRateEnabled") : t("universalRateDisabled")}
            </Badge>
          </div>
          {useUniversalRate && (
            <div className="mt-4 flex items-center gap-3" data-tour="admin-hourly-rate">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  {t("universalRateLabel").replace("{currency}", masterCurrency)}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    className="w-32"
                    value={universalRateInput}
                    onChange={(e) => setUniversalRateInput(e.target.value)}
                    placeholder="e.g. 800"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={universalRateSaving}
                    onClick={async () => {
                      setUniversalRateSaving(true);
                      try {
                        await fetch("/api/admin/economic", {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ defaultHourlyRate: universalRateInput, useUniversalRate }),
                        });
                        fetchStats(true);
                        toast.success(t("allocationSaved"));
                      } catch { /* ignore */ } finally {
                        setUniversalRateSaving(false);
                      }
                    }}
                  >
                    <Save className="mr-1 h-3 w-3" />
                    {tc("save")}
                  </Button>
                </div>
              </div>
            </div>
          )}
          {useUniversalRate && stats && (() => {
            const freelancerCount = stats.employeeStats.filter(e => e.employmentType === "freelancer").length;
            return freelancerCount > 0 ? (
              <p className="mt-3 text-xs text-amber-600">
                {t("freelancerNote").replace("{count}", freelancerCount.toString())}
              </p>
            ) : null;
          })()}
        </CardContent>
      </Card>

      {/* Expense Settings */}
      <Card data-tour="admin-expense-settings">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">{t("expenseSettings")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("autoApproveDescription")}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Label className="whitespace-nowrap flex items-center gap-1">{t("autoApproveThreshold")} ({masterCurrency}) <InfoTooltip textKey="autoApproveThreshold" size={13} /></Label>
            <Input
              type="number"
              className="w-32"
              value={expenseThresholdInput}
              onChange={(e) => setExpenseThresholdInput(e.target.value)}
              placeholder="0"
            />
            <Button
              size="sm"
              disabled={expenseThresholdSaving}
              onClick={async () => {
                setExpenseThresholdSaving(true);
                try {
                  await fetch("/api/admin/economic", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      expenseAutoApproveThreshold: expenseThresholdInput ? parseFloat(expenseThresholdInput) : null,
                    }),
                  });
                } catch (error) {
                  console.error("Failed to save threshold:", error);
                } finally {
                  setExpenseThresholdSaving(false);
                }
              }}
            >
              <Save className="mr-1 h-4 w-4" />
              {expenseThresholdSaving ? tc("saving") : tc("save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Company Expenses Link */}
      <Card data-tour="admin-company-expenses">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">{t("companyExpenses")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("companyExpensesDescription")}</p>
            </div>
            <Link href="/admin/company-expenses">
              <Button variant="outline">
                <Building2 className="mr-2 h-4 w-4" />
                {t("manageCompanyExpenses")}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Download Receipts */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-foreground">{t("downloadReceipts")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("downloadReceiptsDesc")}</p>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>{tc("startDate")}</Label>
              <Input
                type="date"
                value={receiptExportStart}
                onChange={(e) => setReceiptExportStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{tc("endDate")}</Label>
              <Input
                type="date"
                value={receiptExportEnd}
                onChange={(e) => setReceiptExportEnd(e.target.value)}
              />
            </div>
            <Button
              disabled={receiptExporting || !receiptExportStart || !receiptExportEnd}
              onClick={async () => {
                setReceiptExporting(true);
                try {
                  const res = await fetch(
                    `/api/admin/expenses/export-receipts?startDate=${receiptExportStart}&endDate=${receiptExportEnd}`
                  );
                  if (!res.ok) {
                    const data = await res.json();
                    toast.error(data.error || "Export failed");
                    return;
                  }
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `receipts-${receiptExportStart}-${receiptExportEnd}.zip`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                } catch {
                  toast.error("Export failed");
                } finally {
                  setReceiptExporting(false);
                }
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              {receiptExporting ? t("exporting") : t("downloadReceipts")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* e-conomic Export */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-brand-600" />
            <CardTitle className="text-lg">{t("economicExport")}</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("economicDescription")}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Settings */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">{t("accountSettings")}</h3>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="eco-revenue" className="flex items-center gap-1">{t("revenueAccount")} <InfoTooltip textKey="revenueAccount" size={13} /></Label>
                <Input
                  id="eco-revenue"
                  value={ecoRevenueAccount}
                  onChange={(e) => setEcoRevenueAccount(e.target.value)}
                  placeholder="e.g. 1000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eco-counter" className="flex items-center gap-1">{t("counterAccount")} <InfoTooltip textKey="counterAccount" size={13} /></Label>
                <Input
                  id="eco-counter"
                  value={ecoCounterAccount}
                  onChange={(e) => setEcoCounterAccount(e.target.value)}
                  placeholder="e.g. 5800"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eco-vat" className="flex items-center gap-1">{t("vatCode")} <InfoTooltip textKey="vatCode" size={13} /></Label>
                <Input
                  id="eco-vat"
                  value={ecoVatCode}
                  onChange={(e) => setEcoVatCode(e.target.value)}
                  placeholder="e.g. U25"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eco-currency">{tc("currency")}</Label>
                <Input
                  id="eco-currency"
                  value={ecoCurrency}
                  onChange={(e) => setEcoCurrency(e.target.value)}
                  placeholder="DKK"
                />
              </div>
            </div>
            <Button
              className="mt-3"
              variant="outline"
              size="sm"
              onClick={handleEcoSave}
              disabled={ecoSaving}
            >
              <Save className="mr-2 h-4 w-4" />
              {ecoSaved ? t("saved") : ecoSaving ? tc("saving") : t("saveSettings")}
            </Button>
          </div>

          <Separator />

          {/* Export */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">{t("downloadExport")}</h3>
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label htmlFor="eco-start">{tc("startDate")}</Label>
                <Input
                  id="eco-start"
                  type="date"
                  value={ecoExportStart}
                  onChange={(e) => setEcoExportStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eco-end">{tc("endDate")}</Label>
                <Input
                  id="eco-end"
                  type="date"
                  value={ecoExportEnd}
                  onChange={(e) => setEcoExportEnd(e.target.value)}
                />
              </div>
              <Button
                onClick={handleEcoExport}
                disabled={ecoExporting || !ecoExportStart || !ecoExportEnd || !ecoRevenueAccount}
              >
                <Download className="mr-2 h-4 w-4" />
                {ecoExporting ? t("exporting") : t("downloadCsv")}
              </Button>
            </div>
            {!ecoRevenueAccount && (
              <p className="mt-2 text-sm text-amber-600">
                {t("saveRevenueFirst")}
              </p>
            )}
            {ecoError && (
              <p className="mt-2 text-sm text-red-600">{ecoError}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Allocation Dialog */}
      <Dialog open={allocDialogOpen} onOpenChange={setAllocDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("allocateHours")}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {t("allocateDescription").replace("{project}", allocProject?.name || "")}
            </p>
          </DialogHeader>
          {allocProject && (
            <div className="space-y-4">
              <div className="flex justify-between text-sm font-medium">
                <span>{tc("project")}: {allocProject.name}</span>
                <span>
                  {allocProject.budgetTotalHours
                    ? `Budget: ${allocProject.budgetTotalHours}h`
                    : allocProject?.pricingType === "fixed_price"
                      ? `${t("fixedPrice")}: ${convertAndFormat(allocProject?.fixedPrice || 0, masterCurrency, displayCurrency)}`
                      : `Budget: ${allocProject?.budgetHours || 0}h`}
                </span>
              </div>
              {/* Rate mode indicator for fixed-price projects */}
              {allocProject.pricingType === "fixed_price" && (() => {
                const rm = allocProject.rateMode || "COMPANY_RATE";
                return (
                  <div className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
                    {rm === "EMPLOYEE_RATES" ? (
                      <span>{tt("billRate")} per employee</span>
                    ) : allocProject.effectiveRate > 0 ? (
                      <span>
                        {allocProject.effectiveRate} {masterCurrency}{t("perHour")}
                        {allocProject.budgetTotalHours && (
                          <span className="ml-2 text-foreground font-medium">
                            ({allocProject.budgetTotalHours}h available)
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-amber-600">{t("noRateSet")}</span>
                    )}
                    {allocProject.fixedPrice && (
                      <span className="ml-2">
                        ({convertAndFormat(allocProject.fixedPrice, masterCurrency, displayCurrency)})
                      </span>
                    )}
                  </div>
                );
              })()}
              <div className="space-y-3">
                {stats?.employeeStats.map((emp) => {
                  const isEmployeeRates = allocProject.pricingType === "fixed_price" && allocProject.rateMode === "EMPLOYEE_RATES";
                  const empHours = parseFloat(allocInputs[emp.id] || "0") || 0;
                  const empRate = emp.hourlyRate || stats?.defaultHourlyRate || 0;
                  return (
                    <div key={emp.id} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm truncate block">{emp.name}</span>
                        {isEmployeeRates && (
                          <span className="text-xs text-muted-foreground">
                            {empRate} {masterCurrency}{t("perHour")}
                            {empHours > 0 && ` = ${convertAndFormat(empHours * empRate, masterCurrency, displayCurrency)}`}
                          </span>
                        )}
                      </div>
                      <Input
                        type="number"
                        className="w-24"
                        placeholder="0"
                        value={allocInputs[emp.id] || ""}
                        onChange={(e) => setAllocInputs(prev => ({ ...prev, [emp.id]: e.target.value }))}
                      />
                      <span className="text-xs text-muted-foreground w-6">h</span>
                    </div>
                  );
                })}
              </div>
              {/* Show allocated total */}
              {(() => {
                const isFixed = allocProject.pricingType === "fixed_price" && allocProject.fixedPrice;
                const rm = allocProject.rateMode || "COMPANY_RATE";
                const totalAllocated = Object.values(allocInputs).reduce((s, v) => s + (parseFloat(v) || 0), 0);

                if (!isFixed) {
                  // Hourly project: simple hours comparison
                  const remaining = (allocProject.budgetHours || 0) - totalAllocated;
                  return (
                    <div className={cn("rounded-lg p-3 text-sm", remaining < 0 ? "bg-red-50 dark:bg-red-950" : "bg-muted/50")}>
                      <div className="flex justify-between">
                        <span>{t("allocated")}</span>
                        <span className="font-medium">{totalAllocated}h</span>
                      </div>
                      {remaining >= 0 ? (
                        <div className="flex justify-between text-muted-foreground">
                          <span>{t("unallocated")}</span>
                          <span>{remaining}h</span>
                        </div>
                      ) : (
                        <div className="flex justify-between text-red-600">
                          <span>{t("overAllocated").replace("{hours}", Math.abs(remaining).toString())}</span>
                        </div>
                      )}
                    </div>
                  );
                }

                if (rm === "EMPLOYEE_RATES") {
                  // Employee rates: sum cost per person and compare to fixed price
                  const totalCost = (stats?.employeeStats || []).reduce((sum, emp) => {
                    const empHours = parseFloat(allocInputs[emp.id] || "0") || 0;
                    const empRate = emp.hourlyRate || stats?.defaultHourlyRate || 0;
                    return sum + empHours * empRate;
                  }, 0);
                  const budgetRemaining = (allocProject.fixedPrice || 0) - totalCost;
                  const isOver = budgetRemaining < 0;
                  return (
                    <div className={cn("rounded-lg p-3 text-sm", isOver ? "bg-red-50 dark:bg-red-950" : "bg-muted/50")}>
                      <div className="flex justify-between">
                        <span>{t("allocated")}</span>
                        <span className="font-medium">{totalAllocated}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t("budgetUsedMoney")}</span>
                        <span className="font-medium">{convertAndFormat(totalCost, masterCurrency, displayCurrency)}</span>
                      </div>
                      <Separator className="my-1" />
                      <div className={cn("flex justify-between font-medium", isOver ? "text-red-600" : "text-muted-foreground")}>
                        <span>{t("budgetRemaining")}</span>
                        <span>
                          {isOver && "-"}{convertAndFormat(Math.abs(budgetRemaining), masterCurrency, displayCurrency)}
                        </span>
                      </div>
                    </div>
                  );
                }

                // Company rate or Project rate: use pre-calculated budgetTotalHours
                const availableHours = allocProject.budgetTotalHours;
                if (!availableHours || availableHours <= 0) {
                  return (
                    <div className="rounded-lg p-3 text-sm bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400">
                      {t("noRateSet")}
                    </div>
                  );
                }
                const remaining = Math.round((availableHours - totalAllocated) * 10) / 10;
                return (
                  <div className={cn("rounded-lg p-3 text-sm", remaining < 0 ? "bg-red-50 dark:bg-red-950" : "bg-muted/50")}>
                    <div className="flex justify-between">
                      <span>{t("allocated")}</span>
                      <span className="font-medium">{totalAllocated}h / {availableHours}h</span>
                    </div>
                    {remaining >= 0 ? (
                      <div className="flex justify-between text-muted-foreground">
                        <span>{t("unallocated")}</span>
                        <span>{remaining}h</span>
                      </div>
                    ) : (
                      <div className="flex justify-between text-red-600">
                        <span>{t("overAllocated").replace("{hours}", Math.abs(remaining).toString())}</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAllocDialogOpen(false)}>{tc("cancel")}</Button>
            <Button onClick={handleAllocSave} disabled={allocSaving}>
              {allocSaving ? tc("saving") : tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Master Currency Change Dialog */}
      <Dialog open={showMasterCurrencyDialog} onOpenChange={setShowMasterCurrencyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("changeMasterCurrency")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 p-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5 shrink-0" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">{t("changeMasterCurrencyWarning")}</p>
            </div>
            <div>
              <Select value={newMasterCurrency} onValueChange={setNewMasterCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowMasterCurrencyDialog(false)}>
                {tc("cancel")}
              </Button>
              <Button onClick={async () => {
                try {
                  await fetch("/api/admin/economic", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ currency: newMasterCurrency }),
                  });
                  setMasterCurrency(newMasterCurrency);
                  setDisplayCurrency(newMasterCurrency);
                  setShowMasterCurrencyDialog(false);
                } catch {}
              }}>
                {t("changeCurrency")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
