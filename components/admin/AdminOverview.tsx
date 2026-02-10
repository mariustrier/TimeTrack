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
  Upload,
  ImageIcon,
  Trash2,
  ShieldCheck,
  Pencil,
  Plus,
  Calendar,
  Lock,
  Unlock,
  Archive,
  ArchiveRestore,
  Layers,
  ChevronUp,
  ChevronDown,
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
import { useTranslations, useDateLocale, useLocale } from "@/lib/i18n";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { TeamUtilizationBars } from "@/components/admin/TeamUtilizationBars";
import { AtRiskProjects } from "@/components/admin/AtRiskProjects";
import { Switch } from "@/components/ui/switch";
import { PhaseMigrationDialog } from "@/components/admin/PhaseMigrationDialog";
import { ShieldAlert, CheckCircle, XCircle } from "lucide-react";

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
  currency: string;
  defaultHourlyRate: number | null;
  useUniversalRate: boolean;
}

export function AdminOverview() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const tt = useTranslations("team");
  const tSupport = useTranslations("support");
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
  const [aiAnonymization, setAiAnonymization] = useState(true);
  const [aiAnonymizationSaving, setAiAnonymizationSaving] = useState(false);
  const [expenseThresholdInput, setExpenseThresholdInput] = useState("");
  const [expenseThresholdSaving, setExpenseThresholdSaving] = useState(false);
  const [receiptExportStart, setReceiptExportStart] = useState("");
  const [receiptExportEnd, setReceiptExportEnd] = useState("");
  const [receiptExporting, setReceiptExporting] = useState(false);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  // Support access state
  const [supportAccess, setSupportAccess] = useState<{ id: string; status: string }[]>([]);
  const [supportActionLoading, setSupportActionLoading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Absence reasons state
  interface AbsenceReasonUser {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  }
  interface AbsenceReason {
    id: string;
    name: string;
    code: string | null;
    isDefault: boolean;
    active: boolean;
    sortOrder: number;
    users: AbsenceReasonUser[];
  }
  const [absenceReasons, setAbsenceReasons] = useState<AbsenceReason[]>([]);
  const [absenceReasonDialogOpen, setAbsenceReasonDialogOpen] = useState(false);
  const [editingAbsenceReason, setEditingAbsenceReason] = useState<AbsenceReason | null>(null);
  const [absenceReasonName, setAbsenceReasonName] = useState("");
  const [absenceReasonCode, setAbsenceReasonCode] = useState("");
  const [absenceReasonSaving, setAbsenceReasonSaving] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assigningReason, setAssigningReason] = useState<AbsenceReason | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<AbsenceReasonUser[]>([]);
  const [assignSaving, setAssignSaving] = useState(false);

  // Allocation dialog state
  const [allocDialogOpen, setAllocDialogOpen] = useState(false);
  const [allocProject, setAllocProject] = useState<ProjectStat | null>(null);
  const [allocInputs, setAllocInputs] = useState<Record<string, string>>({});
  const [allocSaving, setAllocSaving] = useState(false);

  // Holiday settings state
  interface DanishHolidayInfo {
    code: string;
    nameEn: string;
    nameDa: string;
    date: string;
    enabled: boolean;
  }
  interface CustomHolidayInfo {
    id: string;
    name: string;
    month: number;
    day: number;
    year: number | null;
  }
  const { locale } = useLocale();
  const [danishHolidays, setDanishHolidays] = useState<DanishHolidayInfo[]>([]);
  const [customCompanyHolidays, setCustomCompanyHolidays] = useState<CustomHolidayInfo[]>([]);
  const [holidayDialogOpen, setHolidayDialogOpen] = useState(false);
  const [newHolidayName, setNewHolidayName] = useState("");
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayRecurring, setNewHolidayRecurring] = useState(true);
  const [holidaySaving, setHolidaySaving] = useState(false);
  const [fillingHolidays, setFillingHolidays] = useState(false);

  // Phase management state
  interface Phase {
    id: string;
    name: string;
    sortOrder: number;
    active: boolean;
  }
  const tp = useTranslations("phases");
  const [phasesEnabled, setPhasesEnabled] = useState(false);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [phaseDialogOpen, setPhaseDialogOpen] = useState(false);
  const [editingPhase, setEditingPhase] = useState<Phase | null>(null);
  const [phaseName, setPhaseName] = useState("");
  const [phaseApplyGlobally, setPhaseApplyGlobally] = useState(false);
  const [phaseSaving, setPhaseSaving] = useState(false);
  const [phasesToggleSaving, setPhasesToggleSaving] = useState(false);
  const [migrationDialogOpen, setMigrationDialogOpen] = useState(false);
  const [migrationProjects, setMigrationProjects] = useState<Array<{ id: string; name: string; color: string; systemManaged?: boolean; phasesEnabled: boolean; currentPhase: { id: string; name: string } | null }>>([]);

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

  // Fetch support access requests for this company
  const fetchSupportAccess = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/support-access");
      if (res.ok) {
        setSupportAccess(await res.json());
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchSupportAccess();
    const interval = setInterval(fetchSupportAccess, 30000);
    return () => clearInterval(interval);
  }, [fetchSupportAccess]);

  const handleSupportAction = async (accessId: string, action: "grant" | "revoke") => {
    setSupportActionLoading(true);
    try {
      const url = action === "grant"
        ? "/api/admin/support-access/grant"
        : "/api/admin/support-access/revoke";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supportAccessId: accessId }),
      });
      if (res.ok) {
        toast.success(action === "grant" ? tSupport("accessGranted") : tSupport("accessRevoked"));
        fetchSupportAccess();
      }
    } catch {}
    setSupportActionLoading(false);
  };

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
          setAiAnonymization(data.aiAnonymization ?? true);
          setUniversalRateInput(data.defaultHourlyRate?.toString() || "");
          setExpenseThresholdInput(data.expenseAutoApproveThreshold?.toString() || "");
          setCompanyLogoUrl(data.logoUrl || null);
          setPhasesEnabled(data.phasesEnabled || false);
        }
      })
      .catch(() => {});
    // Load phases
    fetch("/api/admin/phases")
      .then((res) => res.ok ? res.json() : [])
      .then(setPhases)
      .catch(() => {});
  }, []);

  // Load absence reasons, team members, and holidays
  useEffect(() => {
    Promise.all([
      fetch("/api/admin/absence-reasons").then((res) => res.ok ? res.json() : []),
      fetch("/api/team").then((res) => res.ok ? res.json() : []),
      fetch("/api/admin/holidays").then((res) => res.ok ? res.json() : null),
    ]).then(([reasons, team, holidays]) => {
      setAbsenceReasons(reasons);
      if (holidays) {
        setDanishHolidays(holidays.danishHolidays ?? []);
        setCustomCompanyHolidays(holidays.customHolidays ?? []);
      }
      setTeamMembers(team.map((m: { id: string; firstName: string | null; lastName: string | null; email: string }) => ({
        id: m.id,
        firstName: m.firstName,
        lastName: m.lastName,
        email: m.email,
      })));
    }).catch(() => {});
  }, []);

  // Holiday functions
  async function handleToggleDanishHoliday(code: string, enabled: boolean) {
    try {
      const res = await fetch("/api/admin/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggleDanish", code, enabled }),
      });
      if (!res.ok) throw new Error();
      setDanishHolidays((prev) =>
        prev.map((h) => (h.code === code ? { ...h, enabled } : h))
      );
    } catch {
      toast.error(tc("error"));
    }
  }

  async function handleAddCustomHoliday() {
    if (!newHolidayName.trim() || !newHolidayDate) return;
    setHolidaySaving(true);
    try {
      const d = new Date(newHolidayDate);
      const res = await fetch("/api/admin/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "addCustom",
          name: newHolidayName.trim(),
          month: d.getMonth() + 1,
          day: d.getDate(),
          year: newHolidayRecurring ? null : d.getFullYear(),
        }),
      });
      if (!res.ok) throw new Error();
      const holiday = await res.json();
      setCustomCompanyHolidays((prev) => [...prev, holiday]);
      setHolidayDialogOpen(false);
      setNewHolidayName("");
      setNewHolidayDate("");
      setNewHolidayRecurring(true);
      toast.success(t("holidayAdded"));
    } catch {
      toast.error(tc("error"));
    } finally {
      setHolidaySaving(false);
    }
  }

  async function handleDeleteCustomHoliday(id: string) {
    try {
      const res = await fetch(`/api/admin/holidays?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setCustomCompanyHolidays((prev) => prev.filter((h) => h.id !== id));
      toast.success(t("holidayDeleted"));
    } catch {
      toast.error(tc("error"));
    }
  }

  async function handleFillHolidays() {
    setFillingHolidays(true);
    try {
      const res = await fetch("/api/admin/fill-holiday-entries", { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(t("holidayEntriesFilled").replace("{count}", data.entriesCreated.toString()));
    } catch {
      toast.error(tc("error"));
    } finally {
      setFillingHolidays(false);
    }
  }

  // Absence reason functions
  async function handleSaveAbsenceReason() {
    if (!absenceReasonName.trim()) return;
    setAbsenceReasonSaving(true);
    try {
      if (editingAbsenceReason) {
        const res = await fetch(`/api/admin/absence-reasons/${editingAbsenceReason.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: absenceReasonName,
            code: absenceReasonCode || null,
          }),
        });
        if (res.ok) {
          const updated = await res.json();
          setAbsenceReasons(prev => prev.map(r => r.id === updated.id ? updated : r));
          toast.success(t("reasonSaved"));
        } else {
          const data = await res.json();
          toast.error(data.error || "Failed to save");
        }
      } else {
        const res = await fetch("/api/admin/absence-reasons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: absenceReasonName,
            code: absenceReasonCode || null,
          }),
        });
        if (res.ok) {
          const newReason = await res.json();
          setAbsenceReasons(prev => [...prev, newReason]);
          toast.success(t("reasonSaved"));
        } else {
          const data = await res.json();
          toast.error(data.error || "Failed to save");
        }
      }
      setAbsenceReasonDialogOpen(false);
      setEditingAbsenceReason(null);
      setAbsenceReasonName("");
      setAbsenceReasonCode("");
    } catch {
      toast.error("Failed to save");
    } finally {
      setAbsenceReasonSaving(false);
    }
  }

  async function handleDeleteAbsenceReason(reason: AbsenceReason) {
    if (reason.isDefault) {
      toast.error(t("cannotDeleteDefault"));
      return;
    }
    try {
      const res = await fetch(`/api/admin/absence-reasons/${reason.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.softDeleted) {
          // Update the reason to show as inactive
          setAbsenceReasons(prev => prev.map(r => r.id === reason.id ? { ...r, active: false } : r));
          toast.success(t("reasonDeactivated"));
        } else {
          setAbsenceReasons(prev => prev.filter(r => r.id !== reason.id));
          toast.success(t("reasonDeleted"));
        }
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete");
      }
    } catch {
      toast.error("Failed to delete");
    }
  }

  async function handleSaveUserAssignments() {
    if (!assigningReason) return;
    setAssignSaving(true);
    try {
      const res = await fetch(`/api/admin/absence-reasons/${assigningReason.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: selectedUserIds }),
      });
      if (res.ok) {
        const updated = await res.json();
        setAbsenceReasons(prev => prev.map(r => r.id === updated.id ? updated : r));
        toast.success(t("reasonSaved"));
        setAssignDialogOpen(false);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save");
      }
    } catch {
      toast.error("Failed to save");
    } finally {
      setAssignSaving(false);
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
      {/* Support Access Banner */}
      {supportAccess.length > 0 && supportAccess.map((sa) => (
        <div
          key={sa.id}
          className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950"
        >
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {sa.status === "pending" ? tSupport("requestPending") : tSupport("supportActive")}
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-500">
                {sa.status === "pending" ? tSupport("requestPendingDesc") : tSupport("supportActiveDesc")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {sa.status === "pending" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400"
                  onClick={() => handleSupportAction(sa.id, "grant")}
                  disabled={supportActionLoading}
                >
                  <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                  {tSupport("grant")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
                  onClick={() => handleSupportAction(sa.id, "revoke")}
                  disabled={supportActionLoading}
                >
                  <XCircle className="mr-1.5 h-3.5 w-3.5" />
                  {tSupport("deny")}
                </Button>
              </>
            )}
            {(sa.status === "granted" || sa.status === "active") && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
                onClick={() => handleSupportAction(sa.id, "revoke")}
                disabled={supportActionLoading}
              >
                <XCircle className="mr-1.5 h-3.5 w-3.5" />
                {tSupport("revoke")}
              </Button>
            )}
          </div>
        </div>
      ))}

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

      {/* Company Stat Cards - Row 1: Financial */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950">
                <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">{t("revenue")} <InfoTooltip textKey="revenue" size={12} /></p>
                <p className="text-lg font-bold truncate" title={convertAndFormat(stats.totalRevenue, masterCurrency, displayCurrency)}>{convertAndFormat(stats.totalRevenue, masterCurrency, displayCurrency)}</p>
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
                <p className="text-lg font-bold truncate" title={convertAndFormat(stats.totalCost, masterCurrency, displayCurrency)}>{convertAndFormat(stats.totalCost, masterCurrency, displayCurrency)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                stats.totalProfit >= 0 ? "bg-emerald-50 dark:bg-emerald-950" : "bg-red-50 dark:bg-red-950"
              )}>
                {stats.totalProfit >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">{t("profit")}</p>
                <p className="text-lg font-bold truncate" title={convertAndFormat(stats.totalProfit - stats.totalExpenses, masterCurrency, displayCurrency)}>{convertAndFormat(stats.totalProfit - stats.totalExpenses, masterCurrency, displayCurrency)}</p>
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
                <p className="text-xs text-muted-foreground flex items-center gap-1">{t("utilization")} <InfoTooltip textKey="utilization" size={12} /></p>
                <p className="text-lg font-bold truncate">{formatPercentage(stats.utilization)}</p>
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
                <p className="text-xs text-muted-foreground">{t("teamHours")}</p>
                <p className="text-lg font-bold truncate">{formatHours(stats.totalHours)}</p>
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
                <p className="text-xs text-muted-foreground">{t("totalExpenses")}</p>
                <p className="text-lg font-bold truncate" title={convertAndFormat(stats.totalExpenses, masterCurrency, displayCurrency)}>{convertAndFormat(stats.totalExpenses, masterCurrency, displayCurrency)}</p>
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

      {/* Team Overview Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TeamUtilizationBars
          employees={stats.employeeStats.map((emp) => ({
            id: emp.id,
            name: emp.name,
            hours: emp.hours,
            weeklyTarget: emp.weeklyTarget,
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
              const isFixed = project.pricingType === "fixed_price" && project.fixedPrice;
              const totalHours = project.budgetTotalHours || 0;
              const percent = totalHours > 0
                ? (project.hoursUsed / totalHours) * 100
                : 0;
              const progressColor = percent >= 90 ? "bg-red-500" : percent >= 75 ? "bg-amber-500" : "bg-emerald-500";
              const noRate = isFixed && !project.budgetTotalHours;

              return (
                <div key={project.id} className={cn("space-y-2", project.archived && "opacity-50")}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: project.color }} />
                      <span className="text-sm font-medium">{project.name}</span>
                      {project.client && <span className="text-xs text-muted-foreground">({project.client})</span>}
                      {isFixed && <Badge variant="outline" className="text-xs">{t("fixedPrice")}</Badge>}
                      {project.locked && <Badge variant="secondary" className="text-xs"><Lock className="h-3 w-3 mr-1" />{t("projectLocked")}</Badge>}
                      {project.archived && <Badge variant="secondary" className="text-xs"><Archive className="h-3 w-3 mr-1" />{t("projectArchived")}</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      {noRate ? (
                        <span className="text-sm text-amber-600">{t("noRateSet")}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {project.hoursUsed} / {totalHours}h ({Math.round(percent)}%)
                        </span>
                      )}
                      {!project.systemManaged && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              try {
                                const res = await fetch(`/api/projects/${project.id}`, {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ locked: !project.locked }),
                                });
                                if (res.ok) {
                                  fetchStats(true);
                                  toast.success(project.locked ? t("projectUnlocked") : t("projectLockedSuccess"));
                                }
                              } catch {
                                toast.error("Failed to update project");
                              }
                            }}
                            title={project.locked ? t("unlockProject") : t("lockProject")}
                          >
                            {project.locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              try {
                                const res = await fetch(`/api/projects/${project.id}`, {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ archived: !project.archived }),
                                });
                                if (res.ok) {
                                  fetchStats(true);
                                  toast.success(project.archived ? t("projectUnarchived") : t("projectArchivedSuccess"));
                                }
                              } catch {
                                toast.error("Failed to update project");
                              }
                            }}
                            title={project.archived ? t("unarchiveProject") : t("archiveProject")}
                          >
                            {project.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                          </Button>
                        </>
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

      {/* AI Data Privacy */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">{t("aiAnonymization")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("aiAnonymizationDesc")}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={async () => {
                const newVal = !aiAnonymization;
                setAiAnonymization(newVal);
                setAiAnonymizationSaving(true);
                try {
                  await fetch("/api/admin/economic", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ aiAnonymization: newVal }),
                  });
                } catch { /* ignore */ } finally {
                  setAiAnonymizationSaving(false);
                }
              }}
              disabled={aiAnonymizationSaving}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                aiAnonymization ? "bg-primary" : "bg-muted-foreground/30"
              )}
            >
              <span className={cn(
                "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                aiAnonymization ? "translate-x-6" : "translate-x-1"
              )} />
            </button>
            <Badge variant={aiAnonymization ? "default" : "secondary"}>
              {aiAnonymization ? t("anonymizationEnabled") : t("anonymizationDisabled")}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Project Phases */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <Layers className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground">{tp("title")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{tp("description")}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={async () => {
                const newVal = !phasesEnabled;
                setPhasesEnabled(newVal);
                setPhasesToggleSaving(true);
                try {
                  await fetch("/api/admin/economic", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ phasesEnabled: newVal }),
                  });
                  if (newVal) {
                    // Reload phases (defaults may have been created)
                    const res = await fetch("/api/admin/phases");
                    if (res.ok) {
                      const newPhases = await res.json();
                      setPhases(newPhases);
                      // Check if existing projects need phase assignment
                      const projRes = await fetch("/api/projects");
                      if (projRes.ok) {
                        const projects = await projRes.json();
                        const needAssignment = projects.filter((p: { systemManaged?: boolean; currentPhase: unknown }) => !p.systemManaged && !p.currentPhase);
                        if (needAssignment.length > 0) {
                          setMigrationProjects(projects);
                          setMigrationDialogOpen(true);
                        }
                      }
                    }
                  }
                } catch { /* ignore */ } finally {
                  setPhasesToggleSaving(false);
                }
              }}
              disabled={phasesToggleSaving}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                phasesEnabled ? "bg-primary" : "bg-muted-foreground/30"
              )}
            >
              <span className={cn(
                "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                phasesEnabled ? "translate-x-6" : "translate-x-1"
              )} />
            </button>
            <Badge variant={phasesEnabled ? "default" : "secondary"}>
              {phasesEnabled ? tp("enabled") : tp("disabled")}
            </Badge>
          </div>

          {phasesEnabled && (
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-foreground">{tp("title")}</h4>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingPhase(null);
                    setPhaseName("");
                    setPhaseApplyGlobally(false);
                    setPhaseDialogOpen(true);
                  }}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  {tp("addPhase")}
                </Button>
              </div>
              <div className="rounded-lg border">
                {phases.filter(p => p.active).length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">{tp("description")}</p>
                ) : (
                  phases.filter(p => p.active).map((phase, idx, arr) => (
                    <div key={phase.id} className={cn("flex items-center justify-between px-4 py-2", idx < arr.length - 1 && "border-b")}>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-muted-foreground w-5">{idx + 1}</span>
                        <span className="text-sm font-medium">{phase.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={idx === 0}
                          onClick={async () => {
                            const activePhases = phases.filter(p => p.active);
                            const newOrder = [...activePhases];
                            [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
                            const orderedIds = newOrder.map(p => p.id);
                            const res = await fetch("/api/admin/phases/reorder", {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ orderedIds }),
                            });
                            if (res.ok) {
                              setPhases(await res.json());
                              toast.success(tp("phasesReordered"));
                            }
                          }}
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={idx === arr.length - 1}
                          onClick={async () => {
                            const activePhases = phases.filter(p => p.active);
                            const newOrder = [...activePhases];
                            [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
                            const orderedIds = newOrder.map(p => p.id);
                            const res = await fetch("/api/admin/phases/reorder", {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ orderedIds }),
                            });
                            if (res.ok) {
                              setPhases(await res.json());
                              toast.success(tp("phasesReordered"));
                            }
                          }}
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditingPhase(phase);
                            setPhaseName(phase.name);
                            setPhaseApplyGlobally(false);
                            setPhaseDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={async () => {
                            if (!confirm(tp("deletePhaseConfirm").replace("{name}", phase.name))) return;
                            const res = await fetch(`/api/admin/phases/${phase.id}`, { method: "DELETE" });
                            if (res.ok) {
                              const data = await res.json();
                              if (data.softDeleted) {
                                toast.info(tp("phaseDeactivated"));
                              } else {
                                toast.success(tp("phaseDeleted"));
                              }
                              // Reload phases
                              const pRes = await fetch("/api/admin/phases");
                              if (pRes.ok) setPhases(await pRes.json());
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Phase Create/Edit Dialog */}
      <Dialog open={phaseDialogOpen} onOpenChange={setPhaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPhase ? tp("editPhase") : tp("addPhase")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{tp("phaseName")}</Label>
              <Input
                value={phaseName}
                onChange={(e) => setPhaseName(e.target.value)}
                placeholder={tp("phaseNamePlaceholder")}
                maxLength={50}
              />
            </div>
            {editingPhase && phaseName.trim() !== editingPhase.name && (
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="applyGlobally"
                  checked={phaseApplyGlobally}
                  onChange={(e) => setPhaseApplyGlobally(e.target.checked)}
                  className="mt-1"
                />
                <div>
                  <label htmlFor="applyGlobally" className="text-sm font-medium">{tp("applyGlobally")}</label>
                  <p className="text-xs text-muted-foreground">{tp("applyGloballyDesc")}</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPhaseDialogOpen(false)}>{tc("cancel")}</Button>
            <Button
              disabled={phaseSaving || !phaseName.trim()}
              onClick={async () => {
                setPhaseSaving(true);
                try {
                  if (editingPhase) {
                    const res = await fetch(`/api/admin/phases/${editingPhase.id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        name: phaseName.trim(),
                        applyGlobally: phaseApplyGlobally,
                      }),
                    });
                    if (!res.ok) {
                      const data = await res.json();
                      toast.error(data.error || "Failed to update phase");
                      return;
                    }
                    if (phaseApplyGlobally && phaseName.trim() !== editingPhase.name) {
                      toast.success(tp("phaseRenamed"));
                    } else {
                      toast.success(tp("phaseSaved"));
                    }
                  } else {
                    const res = await fetch("/api/admin/phases", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: phaseName.trim() }),
                    });
                    if (!res.ok) {
                      const data = await res.json();
                      toast.error(data.error || "Failed to create phase");
                      return;
                    }
                    toast.success(tp("phaseSaved"));
                  }
                  setPhaseDialogOpen(false);
                  // Reload phases
                  const pRes = await fetch("/api/admin/phases");
                  if (pRes.ok) setPhases(await pRes.json());
                } catch {
                  toast.error("Failed to save phase");
                } finally {
                  setPhaseSaving(false);
                }
              }}
            >
              {phaseSaving ? tc("saving") : editingPhase ? tc("update") : tc("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Company Logo */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-foreground">{t("companyLogo")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("companyLogoDesc")}</p>
          <div className="mt-4 flex items-center gap-4">
            {companyLogoUrl ? (
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-border bg-muted p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={companyLogoUrl}
                    alt="Company logo"
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={logoUploading}
                  >
                    <Upload className="mr-1 h-3 w-3" />
                    {t("uploadLogo")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      setLogoUploading(true);
                      try {
                        const res = await fetch("/api/upload/logo", { method: "DELETE" });
                        if (res.ok) {
                          setCompanyLogoUrl(null);
                          toast.success(t("logoRemoved"));
                        }
                      } catch {
                        toast.error(t("logoUploadError"));
                      } finally {
                        setLogoUploading(false);
                      }
                    }}
                    disabled={logoUploading}
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    {t("removeLogo")}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => logoInputRef.current?.click()}
                disabled={logoUploading}
              >
                <ImageIcon className="mr-2 h-4 w-4" />
                {logoUploading ? tc("saving") : t("uploadLogo")}
              </Button>
            )}
            <input
              ref={logoInputRef}
              type="file"
              accept=".svg,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setLogoUploading(true);
                try {
                  const formData = new FormData();
                  formData.append("file", file);
                  const res = await fetch("/api/upload/logo", {
                    method: "POST",
                    body: formData,
                  });
                  if (res.ok) {
                    const data = await res.json();
                    setCompanyLogoUrl(data.url);
                    toast.success(t("logoUploaded"));
                  } else {
                    const data = await res.json();
                    toast.error(data.error || t("logoUploadError"));
                  }
                } catch {
                  toast.error(t("logoUploadError"));
                } finally {
                  setLogoUploading(false);
                  e.target.value = "";
                }
              }}
            />
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

      {/* Holidays */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">{t("holidays")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("holidaysDesc")}</p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleFillHolidays}
                disabled={fillingHolidays}
              >
                <Calendar className="mr-1 h-4 w-4" />
                {fillingHolidays ? tc("processing") : t("fillHolidayEntries")}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setNewHolidayName("");
                  setNewHolidayDate("");
                  setNewHolidayRecurring(true);
                  setHolidayDialogOpen(true);
                }}
              >
                <Plus className="mr-1 h-4 w-4" />
                {t("addCustomHoliday")}
              </Button>
            </div>
          </div>

          {/* Danish Holidays */}
          <div className="mt-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">{t("danishHolidays")}</h4>
            <div className="space-y-1">
              {danishHolidays.map((holiday) => (
                <div
                  key={holiday.code}
                  className="flex items-center justify-between rounded-lg border p-2.5"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium">
                      {locale === "da" ? holiday.nameDa : holiday.nameEn}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(holiday.date), "d. MMM")}
                    </span>
                  </div>
                  <Switch
                    checked={holiday.enabled}
                    onCheckedChange={(checked) => handleToggleDanishHoliday(holiday.code, checked)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Custom Holidays */}
          {customCompanyHolidays.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">{t("customHolidays")}</h4>
              <div className="space-y-1">
                {customCompanyHolidays.map((holiday) => (
                  <div
                    key={holiday.id}
                    className="flex items-center justify-between rounded-lg border p-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-brand-500" />
                      <span className="text-sm font-medium">{holiday.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {holiday.day}/{holiday.month}
                        {holiday.year ? ` ${holiday.year}` : ` (${t("recurring")})`}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCustomHoliday(holiday.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom Holiday Dialog */}
      <Dialog open={holidayDialogOpen} onOpenChange={setHolidayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addCustomHoliday")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("holidayName")}</Label>
              <Input
                value={newHolidayName}
                onChange={(e) => setNewHolidayName(e.target.value)}
                placeholder={t("holidayNamePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("holidayDate")}</Label>
              <Input
                type="date"
                value={newHolidayDate}
                onChange={(e) => setNewHolidayDate(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={newHolidayRecurring}
                onCheckedChange={setNewHolidayRecurring}
              />
              <Label>{t("recurringYearly")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHolidayDialogOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              onClick={handleAddCustomHoliday}
              disabled={holidaySaving || !newHolidayName.trim() || !newHolidayDate}
            >
              {holidaySaving ? tc("saving") : tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Absence Reasons */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">{t("absenceReasons")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("absenceReasonsDesc")}</p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setEditingAbsenceReason(null);
                setAbsenceReasonName("");
                setAbsenceReasonCode("");
                setAbsenceReasonDialogOpen(true);
              }}
            >
              <Plus className="mr-1 h-4 w-4" />
              {t("addReason")}
            </Button>
          </div>
          <div className="mt-4 space-y-2">
            {absenceReasons.map((reason) => (
              <div
                key={reason.id}
                className={cn(
                  "flex items-center justify-between rounded-lg border p-3",
                  !reason.active && "opacity-50"
                )}
              >
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{reason.name}</span>
                      {reason.code && (
                        <span className="text-xs text-muted-foreground">({reason.code})</span>
                      )}
                      {reason.isDefault && (
                        <Badge variant="secondary" className="text-xs">{t("defaultBadge")}</Badge>
                      )}
                      {!reason.active && (
                        <Badge variant="outline" className="text-xs">{tc("inactive")}</Badge>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      <Users className="inline-block h-3 w-3 mr-1" />
                      {reason.users?.length || 0} {t("employeesAssigned")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAssigningReason(reason);
                      setSelectedUserIds(reason.users?.map(u => u.id) || []);
                      setAssignDialogOpen(true);
                    }}
                    title={t("manageEmployees")}
                  >
                    <Users className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingAbsenceReason(reason);
                      setAbsenceReasonName(reason.name);
                      setAbsenceReasonCode(reason.code || "");
                      setAbsenceReasonDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {!reason.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteAbsenceReason(reason)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {absenceReasons.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No absence reasons configured yet.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Absence Reason Dialog */}
      <Dialog open={absenceReasonDialogOpen} onOpenChange={setAbsenceReasonDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAbsenceReason ? t("editReason") : t("addReason")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("reasonName")}</Label>
              <Input
                value={absenceReasonName}
                onChange={(e) => setAbsenceReasonName(e.target.value)}
                placeholder="e.g. Sygdom"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("reasonCode")}</Label>
              <Input
                value={absenceReasonCode}
                onChange={(e) => setAbsenceReasonCode(e.target.value)}
                placeholder="e.g. SICK"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbsenceReasonDialogOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              onClick={handleSaveAbsenceReason}
              disabled={absenceReasonSaving || !absenceReasonName.trim()}
            >
              {absenceReasonSaving ? tc("saving") : tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Employee Assignment Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("manageEmployees")}: {assigningReason?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              {t("selectEmployeesForReason")}
            </p>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {teamMembers.map((member) => {
                const isSelected = selectedUserIds.includes(member.id);
                const displayName = member.firstName && member.lastName
                  ? `${member.firstName} ${member.lastName}`
                  : member.email;
                return (
                  <label
                    key={member.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                      isSelected
                        ? "border-brand-500 bg-brand-50 dark:bg-brand-950"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUserIds([...selectedUserIds, member.id]);
                        } else {
                          setSelectedUserIds(selectedUserIds.filter(id => id !== member.id));
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <div>
                      <div className="font-medium">{displayName}</div>
                      {member.firstName && (
                        <div className="text-xs text-muted-foreground">{member.email}</div>
                      )}
                    </div>
                  </label>
                );
              })}
              {teamMembers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t("noTeamMembers")}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={handleSaveUserAssignments} disabled={assignSaving}>
              {assignSaving ? tc("saving") : tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                <Label htmlFor="eco-currency" className="flex items-center">{tc("currency")}</Label>
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
                  // Get used hours from allocations data
                  const allocData = allocProject.allocations.find(a => a.userId === emp.id);
                  const usedHours = allocData?.hoursUsed || 0;
                  const unusedHours = empHours - usedHours;
                  const belowUsed = empHours > 0 && empHours < usedHours;
                  return (
                    <div key={emp.id} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm truncate block">{emp.name}</span>
                        <div className="flex items-center gap-2">
                          {usedHours > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {t("usedHours")}: {usedHours}h
                            </span>
                          )}
                          {isEmployeeRates && (
                            <span className="text-xs text-muted-foreground">
                              {empRate} {masterCurrency}{t("perHour")}
                              {empHours > 0 && ` = ${convertAndFormat(empHours * empRate, masterCurrency, displayCurrency)}`}
                            </span>
                          )}
                        </div>
                      </div>
                      <Input
                        type="number"
                        className={cn("w-24", belowUsed && "border-red-500")}
                        placeholder="0"
                        min={usedHours}
                        value={allocInputs[emp.id] || ""}
                        onChange={(e) => setAllocInputs(prev => ({ ...prev, [emp.id]: e.target.value }))}
                      />
                      <div className="text-xs text-muted-foreground w-16 text-right">
                        {empHours > 0 && unusedHours > 0 && (
                          <span className="text-emerald-600">+{unusedHours}h</span>
                        )}
                        {belowUsed && (
                          <span className="text-red-600">min {usedHours}h</span>
                        )}
                        {empHours === 0 && "h"}
                      </div>
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

      {/* Phase Migration Dialog */}
      <PhaseMigrationDialog
        open={migrationDialogOpen}
        onOpenChange={setMigrationDialogOpen}
        phases={phases.filter(p => p.active)}
        projects={migrationProjects}
        onComplete={async () => {
          const pRes = await fetch("/api/admin/phases");
          if (pRes.ok) setPhases(await pRes.json());
        }}
      />
    </div>
  );
}
