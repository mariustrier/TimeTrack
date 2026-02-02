"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  format,
  eachDayOfInterval,
  isToday,
  differenceInBusinessDays,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Target,
  DollarSign,
  Palmtree,
  Clock,
  TrendingUp,
  CalendarDays,
  Plus,
  MessageSquare,
  Send,
  Check,
  Lock,
  AlertCircle,
  X,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { convertAndFormatBudget } from "@/lib/currency";
import { useTranslations, useDateLocale } from "@/lib/i18n";

interface Project {
  id: string;
  name: string;
  color: string;
  billable: boolean;
  budgetHours: number | null;
  budgetTotalHours: number | null;
  hoursUsed: number;
  myAllocation: number | null;
  myHoursUsed: number;
  pricingType: string;
  fixedPrice: number | null;
  moneyUsed: number;
}

interface TimeEntry {
  id: string;
  hours: number;
  date: string;
  comment: string | null;
  projectId: string;
  project: Project;
  approvalStatus: "draft" | "submitted" | "approved" | "locked";
  billingStatus: "billable" | "included" | "non_billable" | "internal" | "presales";
  nonBillableReason: string | null;
}

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
}

function StatCard({ title, value, icon: Icon, color, subtitle }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
            {subtitle && (
              <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", color)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const dateLocale = useDateLocale();

  const BILLING_LABELS: Record<string, string> = {
    billable: tc("billable"),
    included: tc("included"),
    non_billable: tc("nonBillable"),
    internal: tc("internal"),
    presales: tc("preSales"),
  };

  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [hours, setHours] = useState("");
  const [comment, setComment] = useState("");
  const [billingStatus, setBillingStatus] = useState("billable");
  const [nonBillableReason, setNonBillableReason] = useState("");
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [vacationDaysUsed, setVacationDaysUsed] = useState(0);
  const [vacationDaysTotal, setVacationDaysTotal] = useState(25);
  const [weeklyTarget, setWeeklyTarget] = useState(40);
  const [weekNote, setWeekNote] = useState<{ action: string; reason: string | null; createdAt: string } | null>(null);
  const [weekNoteDismissed, setWeekNoteDismissed] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [masterCurrency, setMasterCurrency] = useState("USD");

  const weekStart = useMemo(() => startOfWeek(currentWeek, { weekStartsOn: 1 }), [currentWeek]);
  const weekEnd = useMemo(() => endOfWeek(currentWeek, { weekStartsOn: 1 }), [currentWeek]);
  const weekDays = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd]);

  // Compute week approval status
  const weekStatus = useMemo(() => {
    if (entries.length === 0) return "empty";
    const statuses = new Set(entries.map((e) => e.approvalStatus));
    if (statuses.has("locked")) return "locked";
    if (statuses.has("approved")) return "approved";
    if (statuses.has("submitted")) return "submitted";
    return "draft";
  }, [entries]);

  const isWeekEditable = weekStatus === "draft" || weekStatus === "empty";

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const start = format(weekStart, "yyyy-MM-dd");
      const end = format(weekEnd, "yyyy-MM-dd");

      const [entriesRes, projectsRes, vacationsRes] = await Promise.all([
        fetch(`/api/time-entries?startDate=${start}&endDate=${end}`),
        fetch("/api/projects"),
        fetch("/api/vacations"),
      ]);

      if (entriesRes.ok) {
        const data = await entriesRes.json();
        setEntries(data.entries);
        if (data.meta?.weeklyTarget !== undefined) {
          setWeeklyTarget(data.meta.weeklyTarget);
        }
      }
      if (projectsRes.ok) {
        const data = await projectsRes.json();
        setProjects(data.filter((p: Project & { active?: boolean }) => p.active !== false));
      }
      if (vacationsRes.ok) {
        const vacations = await vacationsRes.json();
        const approved = vacations.filter((v: { status: string }) => v.status === "approved");
        const usedDays = approved.reduce((sum: number, v: { startDate: string; endDate: string }) => {
          const days = differenceInBusinessDays(new Date(v.endDate), new Date(v.startDate)) + 1;
          return sum + Math.max(days, 1);
        }, 0);
        setVacationDaysUsed(usedDays);
      }
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }, [weekStart, weekEnd]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh: 30s polling + refetch on window focus
  useEffect(() => {
    const onFocus = () => fetchData(true);
    window.addEventListener("focus", onFocus);
    const interval = setInterval(() => fetchData(true), 30000);
    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(interval);
    };
  }, [fetchData]);

  // Fetch company currency
  useEffect(() => {
    fetch("/api/admin/economic")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.currency) setMasterCurrency(data.currency || "USD");
      })
      .catch(() => {});
  }, []);

  // Fetch rejection/reopen notes for current week
  useEffect(() => {
    setWeekNote(null);
    setWeekNoteDismissed(false);
    const start = format(weekStart, "yyyy-MM-dd");
    fetch(`/api/time-entries/week-notes?weekStart=${start}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.note) setWeekNote(data.note);
      })
      .catch(() => {});
  }, [weekStart]);

  function getEntryForCell(projectId: string, date: Date): TimeEntry | undefined {
    const dateStr = format(date, "yyyy-MM-dd");
    return entries.find(
      (e) => e.projectId === projectId && e.date.split("T")[0] === dateStr
    );
  }

  function getRowTotal(projectId: string): number {
    return entries
      .filter((e) => e.projectId === projectId)
      .reduce((sum, e) => sum + e.hours, 0);
  }

  function getColumnTotal(date: Date): number {
    const dateStr = format(date, "yyyy-MM-dd");
    return entries
      .filter((e) => e.date.split("T")[0] === dateStr)
      .reduce((sum, e) => sum + e.hours, 0);
  }

  const grandTotal = entries.reduce((sum, e) => sum + e.hours, 0);
  const billableTotal = entries
    .filter((e) => e.billingStatus === "billable")
    .reduce((sum, e) => sum + e.hours, 0);
  const timeBalance = grandTotal - weeklyTarget;

  function openModal(date: Date, projectId?: string, entry?: TimeEntry) {
    setSelectedDate(format(date, "yyyy-MM-dd"));
    setSelectedProjectId(projectId || "");
    if (entry) {
      setEditingEntry(entry);
      setHours(entry.hours.toString());
      setComment(entry.comment || "");
      setBillingStatus(entry.billingStatus);
      setNonBillableReason(entry.nonBillableReason || "");
    } else {
      setEditingEntry(null);
      setHours("");
      setComment("");
      // Default billing status from project
      const proj = projects.find((p) => p.id === projectId);
      setBillingStatus(proj?.billable !== false ? "billable" : "non_billable");
      setNonBillableReason("");
    }
    setModalOpen(true);
  }

  async function handleSave() {
    if (!hours || !selectedDate || !selectedProjectId || !comment.trim()) return;
    setSaving(true);

    try {
      if (editingEntry) {
        await fetch(`/api/time-entries/${editingEntry.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hours,
            comment,
            billingStatus,
            nonBillableReason: billingStatus !== "billable" ? nonBillableReason : null,
          }),
        });
      } else {
        await fetch("/api/time-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hours,
            date: selectedDate,
            projectId: selectedProjectId,
            comment,
            billingStatus,
          }),
        });
      }
      setModalOpen(false);
      fetchData();
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editingEntry) return;
    setSaving(true);
    try {
      await fetch(`/api/time-entries/${editingEntry.id}`, { method: "DELETE" });
      setModalOpen(false);
      fetchData();
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitWeek() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/time-entries/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: format(weekStart, "yyyy-MM-dd") }),
      });
      if (res.ok) {
        setSubmitDialogOpen(false);
        setWeekNoteDismissed(true);
        toast.success(t("weekSubmitted"));
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || t("failedToSubmit"));
      }
    } catch (error) {
      console.error("Failed to submit week:", error);
      toast.error(t("failedToSubmit"));
    } finally {
      setSubmitting(false);
    }
  }

  // Check if entry is read-only
  const isEntryReadOnly = (entry: TimeEntry) => entry.approvalStatus !== "draft";

  // Cell style based on approval status
  function getCellStyle(entry: TimeEntry) {
    switch (entry.approvalStatus) {
      case "submitted":
        return "border-amber-300 bg-amber-50 font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700";
      case "approved":
        return "border-emerald-300 bg-emerald-50 font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700";
      case "locked":
        return "border-gray-300 bg-gray-100 font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600";
      default:
        return "border-brand-200 bg-brand-50 font-medium text-brand-700 hover:bg-brand-100";
    }
  }

  // Status icon for cell
  function getCellIcon(entry: TimeEntry) {
    switch (entry.approvalStatus) {
      case "submitted":
        return <Clock className="absolute -right-1 -top-1 h-3 w-3 text-amber-500" />;
      case "approved":
        return <Check className="absolute -right-1 -top-1 h-3 w-3 text-emerald-500" />;
      case "locked":
        return <Lock className="absolute -right-1 -top-1 h-3 w-3 text-gray-400" />;
      default:
        return entry.comment ? <MessageSquare className="absolute -right-1 -top-1 h-3 w-3 text-brand-400" /> : null;
    }
  }

  const formatOpts = dateLocale ? { locale: dateLocale } : undefined;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        <div className="flex items-center gap-2">
          {weekStatus === "draft" && entries.length > 0 && (
            <Button onClick={() => setSubmitDialogOpen(true)}>
              <Send className="mr-2 h-4 w-4" />
              {t("submitWeek")}
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setCurrentWeek(new Date())}>
            {tc("today")}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-sm text-muted-foreground">
            {format(weekStart, "MMM d", formatOpts)} - {format(weekEnd, "MMM d, yyyy", formatOpts)}
          </span>
          <Button variant="ghost" size="icon" onClick={() => fetchData(true)} className="ml-1">
            <RefreshCw className="h-4 w-4" />
          </Button>
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              {tc("lastUpdated").replace("{time}", format(lastUpdated, "HH:mm:ss"))}
            </span>
          )}
        </div>
      </div>

      {/* Week Status Banner */}
      {weekStatus === "submitted" && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <Clock className="h-4 w-4" />
          {t("submittedBanner")}
        </div>
      )}
      {weekStatus === "approved" && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          <Check className="h-4 w-4" />
          {t("approvedBanner")}
        </div>
      )}
      {weekStatus === "locked" && (
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-100 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
          <Lock className="h-4 w-4" />
          {t("lockedBanner")}
        </div>
      )}

      {/* Rejection/Reopen Note Banner */}
      {weekStatus === "draft" && weekNote && !weekNoteDismissed && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div className="flex-1">
            <span className="font-medium">
              {weekNote.action === "REJECT" ? t("weekReturnedByAdmin") : t("weekReopenedByAdmin")}
            </span>
            {weekNote.reason && (
              <span>: &quot;{weekNote.reason}&quot;</span>
            )}
          </div>
          <button
            onClick={() => setWeekNoteDismissed(true)}
            className="ml-2 flex-shrink-0 rounded p-0.5 hover:bg-red-100 dark:hover:bg-red-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Stat Cards */}
      <div data-tour="stat-cards" className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title={t("target")}
          value={`${weeklyTarget}h`}
          icon={Target}
          color="bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
        />
        <StatCard
          title={t("billableHours")}
          value={`${billableTotal.toFixed(1)}h`}
          icon={DollarSign}
          color="bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
        />
        <StatCard
          title={t("vacation")}
          value={`${vacationDaysUsed}d`}
          icon={Palmtree}
          color="bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
          subtitle={t("daysUsed")}
        />
        <StatCard
          title={t("totalHours")}
          value={`${grandTotal.toFixed(1)}h`}
          icon={Clock}
          color="bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400"
        />
        <StatCard
          title={t("timeBalance")}
          value={`${timeBalance >= 0 ? "+" : ""}${timeBalance.toFixed(1)}h`}
          icon={TrendingUp}
          color={timeBalance >= 0
            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
            : "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400"
          }
        />
        <StatCard
          title={t("vacationDays")}
          value={`${vacationDaysTotal - vacationDaysUsed}`}
          icon={CalendarDays}
          color="bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400"
          subtitle={t("remaining")}
        />
      </div>

      {/* Timesheet Grid */}
      <Card data-tour="timesheet">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t("weeklyTimesheet")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Clock className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">{t("noProjectsTitle")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("noProjectsDescription")}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground w-48">
                      {tc("project")}
                    </th>
                    {weekDays.map((day) => (
                      <th
                        key={day.toISOString()}
                        className={cn(
                          "px-2 py-3 text-center font-medium w-20",
                          isToday(day) ? "text-brand-600 bg-brand-50/50" : "text-muted-foreground"
                        )}
                      >
                        <div>{format(day, "EEE", formatOpts)}</div>
                        <div className="text-xs">{format(day, "MMM d", formatOpts)}</div>
                      </th>
                    ))}
                    {projects.some((p) => p.myAllocation != null || p.budgetTotalHours != null) && (
                      <th className="px-2 py-3 text-center font-medium text-muted-foreground w-24">
                        {t("budget")}
                      </th>
                    )}
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground w-20">
                      {t("total")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => (
                    <tr key={project.id} className="border-b hover:bg-muted/30">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: project.color }}
                          />
                          <span className="font-medium text-foreground truncate">
                            {project.name}
                          </span>
                        </div>
                      </td>
                      {weekDays.map((day) => {
                        const entry = getEntryForCell(project.id, day);
                        return (
                          <td
                            key={day.toISOString()}
                            className={cn(
                              "px-1 py-1 text-center",
                              isToday(day) && "bg-brand-50/30"
                            )}
                          >
                            {entry ? (
                              <button
                                onClick={() => openModal(day, project.id, entry)}
                                className={cn(
                                  "relative mx-auto flex h-10 w-16 items-center justify-center rounded-md border text-sm transition-colors",
                                  getCellStyle(entry)
                                )}
                              >
                                {entry.hours}
                                {getCellIcon(entry)}
                              </button>
                            ) : (
                              <button
                                onClick={() => isWeekEditable && openModal(day, project.id)}
                                disabled={!isWeekEditable}
                                className={cn(
                                  "relative mx-auto flex h-10 w-16 items-center justify-center rounded-md border text-sm transition-colors",
                                  isWeekEditable
                                    ? "border-dashed border-border text-muted-foreground hover:border-muted-foreground hover:bg-muted/50"
                                    : "border-dashed border-border/50 text-muted-foreground/30 cursor-not-allowed"
                                )}
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            )}
                          </td>
                        );
                      })}
                      {projects.some((p) => p.myAllocation != null || p.budgetTotalHours != null) && (
                        <td className="px-2 py-1">
                          {(() => {
                            // Use budgetTotalHours for all project types (hours for hourly, converted hours for fixed-price)
                            const budget = project.myAllocation ?? project.budgetTotalHours;
                            if (budget == null) return <div className="text-center text-muted-foreground">—</div>;
                            const used = project.myAllocation != null ? project.myHoursUsed : project.hoursUsed;
                            const remaining = budget - used;
                            const percentUsed = (used / budget) * 100;
                            const percentRemaining = 100 - percentUsed;
                            let barColor = "bg-emerald-500";
                            let textColor = "text-emerald-600 dark:text-emerald-400";
                            if (percentRemaining < 20) {
                              barColor = "bg-red-500";
                              textColor = "text-red-600 dark:text-red-400";
                            } else if (percentRemaining < 50) {
                              barColor = "bg-orange-500";
                              textColor = "text-orange-600 dark:text-orange-400";
                            }
                            return (
                              <div className="w-20 mx-auto">
                                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                  <div
                                    className={cn("h-full rounded-full transition-all", barColor)}
                                    style={{ width: `${Math.min(percentUsed, 100)}%` }}
                                  />
                                </div>
                                <div className={cn("text-xs mt-0.5 text-center whitespace-nowrap", textColor)}>
                                  {remaining >= 0
                                    ? t("hoursLeft").replace("{remaining}", remaining.toFixed(0))
                                    : t("hoursOver").replace("{hours}", Math.abs(remaining).toFixed(0))}
                                </div>
                              </div>
                            );
                          })()}
                        </td>
                      )}
                      <td className="px-4 py-2 text-center font-semibold text-foreground">
                        {getRowTotal(project.id).toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50">
                    <td className="px-4 py-3 font-semibold text-foreground">{t("dailyTotal")}</td>
                    {weekDays.map((day) => (
                      <td
                        key={day.toISOString()}
                        className={cn(
                          "px-2 py-3 text-center font-semibold text-foreground",
                          isToday(day) && "bg-brand-50/50"
                        )}
                      >
                        {getColumnTotal(day).toFixed(1)}
                      </td>
                    ))}
                    {projects.some((p) => p.myAllocation != null || p.budgetTotalHours != null) && (
                      <td className="px-2 py-3" />
                    )}
                    <td className="px-4 py-3 text-center font-bold text-brand-600">
                      {grandTotal.toFixed(1)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Time Entry Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingEntry
                ? isEntryReadOnly(editingEntry)
                  ? t("viewEntry")
                  : t("editEntry")
                : t("logTime")
              }
            </DialogTitle>
          </DialogHeader>

          {/* Read-only notice */}
          {editingEntry && isEntryReadOnly(editingEntry) && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {t("entryReadOnly", { status: editingEntry.approvalStatus })}
            </div>
          )}

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{tc("project")}</Label>
              <Select
                value={selectedProjectId}
                onValueChange={setSelectedProjectId}
                disabled={!!editingEntry}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectProject")} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: p.color }}
                        />
                        {p.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{tc("date")}</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                disabled={!!(editingEntry && isEntryReadOnly(editingEntry))}
              />
            </div>
            <div className="space-y-2">
              <Label>{tc("hours")}</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                max="24"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder={t("hoursPlaceholder")}
                disabled={!!(editingEntry && isEntryReadOnly(editingEntry))}
              />
            </div>
            <div className="space-y-2">
              <Label>{tc("comment")}</Label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t("commentPlaceholder")}
                rows={3}
                disabled={!!(editingEntry && isEntryReadOnly(editingEntry))}
              />
            </div>

            {/* Billing Status */}
            <div className="space-y-2">
              <Label>{t("billing")}</Label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setBillingStatus(billingStatus === "billable" ? "non_billable" : "billable")}
                  disabled={!!(editingEntry && isEntryReadOnly(editingEntry))}
                  className={cn(
                    "relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors",
                    billingStatus === "billable" ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600",
                    editingEntry && isEntryReadOnly(editingEntry) ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform",
                      billingStatus === "billable" ? "translate-x-5" : "translate-x-0"
                    )}
                  />
                </button>
                <span className="text-sm text-muted-foreground">
                  {billingStatus === "billable" ? tc("billable") : t("notBillable")}
                </span>
              </div>
            </div>

            {/* Category selector when not billable */}
            {billingStatus !== "billable" && (
              <div className="space-y-2">
                <Label>{t("category")}</Label>
                <Select
                  value={billingStatus}
                  onValueChange={setBillingStatus}
                  disabled={!!(editingEntry && isEntryReadOnly(editingEntry))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="included">{t("includedContract")}</SelectItem>
                    <SelectItem value="non_billable">{tc("nonBillable")}</SelectItem>
                    <SelectItem value="internal">{tc("internal")}</SelectItem>
                    <SelectItem value="presales">{tc("preSales")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Billing status badge for existing entries */}
            {editingEntry && editingEntry.billingStatus !== "billable" && (
              <div className="flex items-center gap-2">
                <Badge variant="outline">{BILLING_LABELS[editingEntry.billingStatus]}</Badge>
                {editingEntry.nonBillableReason && (
                  <span className="text-xs text-muted-foreground">{editingEntry.nonBillableReason}</span>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            {editingEntry && !isEntryReadOnly(editingEntry) && (
              <Button variant="destructive" onClick={handleDelete} disabled={saving}>
                {tc("delete")}
              </Button>
            )}
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              {editingEntry && isEntryReadOnly(editingEntry) ? tc("close") : tc("cancel")}
            </Button>
            {!(editingEntry && isEntryReadOnly(editingEntry)) && (
              <Button onClick={handleSave} disabled={saving || !hours || !selectedProjectId || !comment.trim()}>
                {saving ? tc("saving") : editingEntry ? tc("update") : t("logTime")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit Week Confirmation */}
      <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("submitWeekTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("submitWeekDescription", {
              dates: `${format(weekStart, "MMM d", formatOpts)} - ${format(weekEnd, "MMM d, yyyy", formatOpts)}`,
            })}
          </p>
          <p className="text-sm font-medium">
            {t("submitWeekSummary", { count: entries.length.toString(), hours: grandTotal.toFixed(1) })}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitDialogOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={handleSubmitWeek} disabled={submitting}>
              <Send className="mr-2 h-4 w-4" />
              {submitting ? t("submitting") : t("submitWeek")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
