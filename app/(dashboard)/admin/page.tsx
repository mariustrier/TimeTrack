"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatCurrency, formatHours, formatPercentage } from "@/lib/calculations";
import { useTranslations, useDateLocale } from "@/lib/i18n";

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
}

interface Stats {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  totalHours: number;
  billableHours: number;
  utilization: number;
  employeeStats: EmployeeStat[];
  currency: string;
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
  const [companyCurrency, setCompanyCurrency] = useState("USD");

  const weekStart = useMemo(() => startOfWeek(currentWeek, { weekStartsOn: 1 }), [currentWeek]);
  const weekEnd = useMemo(() => endOfWeek(currentWeek, { weekStartsOn: 1 }), [currentWeek]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const start = format(weekStart, "yyyy-MM-dd");
      const end = format(weekEnd, "yyyy-MM-dd");
      const res = await fetch(`/api/admin/stats?startDate=${start}&endDate=${end}`);
      if (res.ok) {
        setStats(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  }, [weekStart, weekEnd]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Load e-conomic settings + company currency on mount
  useEffect(() => {
    fetch("/api/admin/economic")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data) {
          setCompanyCurrency(data.currency || "USD");
          setEcoRevenueAccount(data.economicRevenueAccount || "");
          setEcoCounterAccount(data.economicCounterAccount || "");
          setEcoVatCode(data.economicVatCode || "");
          setEcoCurrency(data.economicCurrency || "DKK");
        }
      })
      .catch(() => {});
  }, []);

  async function handleCurrencyChange(newCurrency: string) {
    setCompanyCurrency(newCurrency);
    try {
      await fetch("/api/admin/economic", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currency: newCurrency,
          economicRevenueAccount: ecoRevenueAccount,
          economicCounterAccount: ecoCounterAccount,
          economicVatCode: ecoVatCode,
          economicCurrency: ecoCurrency,
        }),
      });
    } catch {
      // silently fail - next page load will reload from server
    }
  }

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
    cost: stats.totalCost * 4,
    profit: stats.totalProfit * 4,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <Select value={companyCurrency} onValueChange={handleCurrencyChange}>
            <SelectTrigger className="w-[100px]">
              <Globe className="mr-1 h-3.5 w-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
              <SelectItem value="DKK">DKK</SelectItem>
            </SelectContent>
          </Select>
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
        </div>
      </div>

      {/* Company Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950">
                <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("revenue")}</p>
                <p className="text-xl font-bold">{formatCurrency(stats.totalRevenue, companyCurrency)}</p>
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
                <p className="text-xl font-bold">{formatCurrency(stats.totalCost, companyCurrency)}</p>
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
                <p className="text-xl font-bold">{formatCurrency(stats.totalProfit, companyCurrency)}</p>
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
                <p className="text-xs text-muted-foreground">{t("utilization")}</p>
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
              <p className="text-lg font-bold text-emerald-600">{formatCurrency(monthlyProjection.revenue, companyCurrency)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("cost")}</p>
              <p className="text-lg font-bold text-red-600">{formatCurrency(monthlyProjection.cost, companyCurrency)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("profit")}</p>
              <p className={cn("text-lg font-bold", monthlyProjection.profit >= 0 ? "text-emerald-600" : "text-red-600")}>
                {formatCurrency(monthlyProjection.profit, companyCurrency)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
                    <Badge variant={emp.profit >= 0 ? "default" : "destructive"}>
                      {emp.profit >= 0 ? t("profitable") : t("loss")}
                    </Badge>
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
                      <p className="font-medium">{formatCurrency(emp.hourlyRate, companyCurrency)}/h</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{tt("costRate")}</p>
                      <p className="font-medium">{formatCurrency(emp.costRate, companyCurrency)}/h</p>
                    </div>
                  </div>

                  {/* Weekly P&L */}
                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("revenue")}</span>
                        <span className="text-emerald-600">{formatCurrency(emp.revenue, companyCurrency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("cost")}</span>
                        <span className="text-red-600">-{formatCurrency(emp.cost, companyCurrency)}</span>
                      </div>
                      <div className="border-t pt-1 flex justify-between font-semibold">
                        <span>{t("profit")}</span>
                        <span className={emp.profit >= 0 ? "text-emerald-600" : "text-red-600"}>
                          {formatCurrency(emp.profit, companyCurrency)}
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
                <Label htmlFor="eco-revenue">{t("revenueAccount")}</Label>
                <Input
                  id="eco-revenue"
                  value={ecoRevenueAccount}
                  onChange={(e) => setEcoRevenueAccount(e.target.value)}
                  placeholder="e.g. 1000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eco-counter">{t("counterAccount")}</Label>
                <Input
                  id="eco-counter"
                  value={ecoCounterAccount}
                  onChange={(e) => setEcoCounterAccount(e.target.value)}
                  placeholder="e.g. 5800"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eco-vat">{t("vatCode")}</Label>
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
    </div>
  );
}
