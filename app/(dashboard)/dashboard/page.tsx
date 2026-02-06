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
  ChevronDown,
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
  Car,
  MapPin,
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
import { PageGuide } from "@/components/ui/page-guide";
import { useCompanyLogo } from "@/lib/company-context";

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
  systemType: string | null;
  systemManaged: boolean;
  locked: boolean;
  archived: boolean;
}

interface AbsenceReason {
  id: string;
  name: string;
  code: string | null;
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
  mileageKm: number | null;
  mileageStartAddress: string | null;
  mileageEndAddress: string | null;
  mileageStops: string[];
  mileageRoundTrip: boolean;
  mileageSource: "manual" | "calculated" | null;
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
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
            {subtitle && (
              <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className={cn("mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", color)}>
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
  const companyLogoUrl = useCompanyLogo();

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
  const [submittingDay, setSubmittingDay] = useState<string | null>(null);
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
  const [priorFlexBalance, setPriorFlexBalance] = useState(0);
  const [weekNote, setWeekNote] = useState<{ action: string; reason: string | null; createdAt: string } | null>(null);
  const [weekNoteDismissed, setWeekNoteDismissed] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [masterCurrency, setMasterCurrency] = useState("USD");
  // Mileage state
  const [mileageKm, setMileageKm] = useState("");
  const [mileageStartAddress, setMileageStartAddress] = useState("");
  const [mileageEndAddress, setMileageEndAddress] = useState("");
  const [mileageStops, setMileageStops] = useState<string[]>([]);
  const [mileageRoundTrip, setMileageRoundTrip] = useState(false);
  const [mileageSource, setMileageSource] = useState<"manual" | "calculated" | "">("");
  const [mileageSectionOpen, setMileageSectionOpen] = useState(false);
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  const [startAddressSuggestions, setStartAddressSuggestions] = useState<string[]>([]);
  const [endAddressSuggestions, setEndAddressSuggestions] = useState<string[]>([]);
  const [stopSuggestions, setStopSuggestions] = useState<string[]>([]);
  const [activeAddressField, setActiveAddressField] = useState<"start" | "end" | number | null>(null);
  // Absence state
  const [absenceReasons, setAbsenceReasons] = useState<AbsenceReason[]>([]);
  const [selectedAbsenceReasonId, setSelectedAbsenceReasonId] = useState("");

  const weekStart = useMemo(() => startOfWeek(currentWeek, { weekStartsOn: 1 }), [currentWeek]);
  const weekEnd = useMemo(() => endOfWeek(currentWeek, { weekStartsOn: 1 }), [currentWeek]);
  const weekDays = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd]);

  // Compute week approval status (for banners)
  // Must handle mixed states: e.g. Mon approved + Tue-Fri draft = "mixed" not "approved"
  const weekStatus = useMemo(() => {
    if (entries.length === 0) return "empty";
    const statuses = new Set(entries.map((e) => e.approvalStatus));
    if (statuses.size === 1) {
      return statuses.has("locked") ? "locked"
        : statuses.has("approved") ? "approved"
        : statuses.has("submitted") ? "submitted"
        : "draft";
    }
    // Mixed states: only show "locked"/"approved" banner when ALL entries have that status
    if (statuses.has("locked") && !statuses.has("draft") && !statuses.has("submitted")) return "locked";
    if (statuses.has("approved") && !statuses.has("draft") && !statuses.has("submitted")) return "approved";
    if (statuses.has("submitted") && !statuses.has("draft")) return "submitted";
    return "draft";
  }, [entries]);

  // Check if a specific day allows adding/editing entries
  // A day is editable if it has no entries, has draft entries, or can accept new entries
  // Only fully locked/approved days (no draft entries and all locked/approved) block new entries
  function isDayEditable(day: Date): boolean {
    const dateStr = format(day, "yyyy-MM-dd");
    const dayEntries = entries.filter((e) => e.date.split("T")[0] === dateStr);
    if (dayEntries.length === 0) return true;
    // Allow editing if there are any draft entries or if user can still add new ones
    // Only block if ALL entries are locked or approved (fully processed)
    const allLocked = dayEntries.every((e) => e.approvalStatus === "locked");
    const allApproved = dayEntries.every((e) => e.approvalStatus === "approved" || e.approvalStatus === "locked");
    return !allLocked && !allApproved;
  }

  // Check if there are any draft entries in the week (for Submit Week button)
  const hasDraftEntries = useMemo(() => {
    return entries.some((e) => e.approvalStatus === "draft");
  }, [entries]);

  // Legacy: keep for status banners
  const isWeekEditable = weekStatus === "draft" || weekStatus === "empty";

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const start = format(weekStart, "yyyy-MM-dd");
      const end = format(weekEnd, "yyyy-MM-dd");

      const [entriesRes, projectsRes, vacationsRes, absenceReasonsRes] = await Promise.all([
        fetch(`/api/time-entries?startDate=${start}&endDate=${end}`),
        fetch("/api/projects"),
        fetch("/api/vacations"),
        fetch("/api/absence-reasons"),
      ]);

      if (entriesRes.ok) {
        const data = await entriesRes.json();
        setEntries(data.entries);
        if (data.meta?.weeklyTarget !== undefined) {
          setWeeklyTarget(data.meta.weeklyTarget);
        }
        if (data.meta?.priorFlexBalance !== undefined) {
          setPriorFlexBalance(data.meta.priorFlexBalance);
        }
      }
      if (projectsRes.ok) {
        const data = await projectsRes.json();
        // Filter active projects and sort: regular projects first, then system projects (Absence)
        const activeProjects = data.filter((p: Project & { active?: boolean }) => p.active !== false);
        activeProjects.sort((a: Project, b: Project) => {
          if (a.systemType && !b.systemType) return 1;
          if (!a.systemType && b.systemType) return -1;
          return 0;
        });
        setProjects(activeProjects);
      }
      if (absenceReasonsRes.ok) {
        const data = await absenceReasonsRes.json();
        setAbsenceReasons(data);
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

  // Daily flex balance: running cumulative (target - worked) through the week
  // Mon-Thu get rounded target, Friday gets the remainder to match weekly total
  const monThuTarget = Math.round(weeklyTarget / 5 * 2) / 2; // round to nearest 0.5
  const fridayTarget = weeklyTarget - monThuTarget * 4;
  const flexBalances = useMemo(() => {
    let cumulative = priorFlexBalance;
    return weekDays.map((day) => {
      const dayOfWeek = day.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
      const dateStr = format(day, "yyyy-MM-dd");
      const worked = entries
        .filter((e) => e.date.split("T")[0] === dateStr)
        .reduce((sum, e) => sum + e.hours, 0);
      if (dayOfWeek >= 1 && dayOfWeek <= 4) {
        // Mon-Thu
        cumulative += worked - monThuTarget;
      } else if (dayOfWeek === 5) {
        // Friday
        cumulative += worked - fridayTarget;
      } else {
        // Weekend: overtime only (no target to subtract)
        cumulative += worked;
      }
      return cumulative;
    });
  }, [weekDays, entries, monThuTarget, fridayTarget, priorFlexBalance]);

  // Helper to check if a project is the Absence project
  const isAbsenceProject = (projectId: string) => {
    const proj = projects.find((p) => p.id === projectId);
    return proj?.systemType === "absence";
  };

  function openModal(date: Date, projectId?: string, entry?: TimeEntry) {
    setSelectedDate(format(date, "yyyy-MM-dd"));
    setSelectedProjectId(projectId || "");
    if (entry) {
      setEditingEntry(entry);
      setHours(entry.hours.toString());
      setComment(entry.comment || "");
      setBillingStatus(entry.billingStatus);
      setNonBillableReason(entry.nonBillableReason || "");
      // Mileage fields
      setMileageKm(entry.mileageKm?.toString() || "");
      setMileageStartAddress(entry.mileageStartAddress || "");
      setMileageEndAddress(entry.mileageEndAddress || "");
      setMileageStops(entry.mileageStops || []);
      setMileageRoundTrip(entry.mileageRoundTrip || false);
      setMileageSource(entry.mileageSource || "");
      setMileageSectionOpen(!!entry.mileageKm);
      // Absence reason
      setSelectedAbsenceReasonId((entry as TimeEntry & { absenceReasonId?: string }).absenceReasonId || "");
    } else {
      setEditingEntry(null);
      setHours("");
      setComment("");
      // Default billing status from project
      const proj = projects.find((p) => p.id === projectId);
      setBillingStatus(proj?.billable !== false ? "billable" : "non_billable");
      setNonBillableReason("");
      // Reset mileage fields
      setMileageKm("");
      setMileageStartAddress("");
      setMileageEndAddress("");
      setMileageStops([]);
      setMileageRoundTrip(false);
      setMileageSource("");
      setMileageSectionOpen(false);
      // Reset absence reason
      setSelectedAbsenceReasonId("");
    }
    setModalOpen(true);
  }

  async function handleSave() {
    if (!hours || !selectedDate || !selectedProjectId) return;
    if (!isAbsenceProject(selectedProjectId) && !comment.trim()) return;
    // Require absence reason for absence project
    if (isAbsenceProject(selectedProjectId) && !selectedAbsenceReasonId) {
      toast.error(t("absenceReasonRequired"));
      return;
    }
    setSaving(true);

    try {
      let res: Response;
      if (editingEntry) {
        res = await fetch(`/api/time-entries/${editingEntry.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hours,
            comment,
            billingStatus,
            nonBillableReason: billingStatus !== "billable" ? nonBillableReason : null,
            mileageKm: mileageKm ? parseFloat(mileageKm) : null,
            mileageStartAddress: mileageStartAddress || null,
            mileageEndAddress: mileageEndAddress || null,
            mileageStops: mileageStops.filter((s) => s.trim()),
            mileageRoundTrip,
            mileageSource: mileageSource || null,
            absenceReasonId: isAbsenceProject(selectedProjectId) ? selectedAbsenceReasonId : null,
          }),
        });
      } else {
        res = await fetch("/api/time-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hours,
            date: selectedDate,
            projectId: selectedProjectId,
            comment,
            billingStatus,
            mileageKm: mileageKm ? parseFloat(mileageKm) : null,
            mileageStartAddress: mileageStartAddress || null,
            mileageEndAddress: mileageEndAddress || null,
            mileageStops: mileageStops.filter((s) => s.trim()),
            mileageRoundTrip,
            mileageSource: mileageSource || null,
            absenceReasonId: isAbsenceProject(selectedProjectId) ? selectedAbsenceReasonId : null,
          }),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to save time entry");
        return;
      }

      setModalOpen(false);
      fetchData();
    } catch (error) {
      console.error("Failed to save:", error);
      toast.error("Failed to save time entry");
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

  // Get draft entries for a specific day
  function getDraftEntriesForDay(date: Date): TimeEntry[] {
    const dateStr = format(date, "yyyy-MM-dd");
    return entries.filter(
      (e) => e.date.split("T")[0] === dateStr && e.approvalStatus === "draft"
    );
  }

  // Check if day has any draft entries
  function dayHasDraftEntries(date: Date): boolean {
    return getDraftEntriesForDay(date).length > 0;
  }

  // Submit a single day
  async function handleSubmitDay(date: Date) {
    const dateStr = format(date, "yyyy-MM-dd");
    setSubmittingDay(dateStr);
    try {
      const res = await fetch("/api/time-entries/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateStr }),
      });
      if (res.ok) {
        toast.success(t("daySubmitted"));
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || t("failedToSubmit"));
      }
    } catch (error) {
      console.error("Failed to submit day:", error);
      toast.error(t("failedToSubmit"));
    } finally {
      setSubmittingDay(null);
    }
  }

  // Calculate distance from addresses
  async function handleCalculateDistance() {
    if (!mileageStartAddress || !mileageEndAddress) return;
    setCalculatingDistance(true);
    try {
      const res = await fetch("/api/mileage/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startAddress: mileageStartAddress,
          endAddress: mileageEndAddress,
          stops: mileageStops.filter((s) => s.trim()),
          roundTrip: mileageRoundTrip,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMileageKm(data.distanceKm.toString());
        setMileageSource("calculated");
        toast.success(t("distanceCalculated"));
      } else {
        const err = await res.json();
        toast.error(err.error || t("distanceCalculationFailed"));
      }
    } catch (error) {
      console.error("Failed to calculate distance:", error);
      toast.error(t("distanceCalculationFailed"));
    } finally {
      setCalculatingDistance(false);
    }
  }

  // Fetch address suggestions
  async function fetchAddressSuggestions(query: string, field: "start" | "end" | number) {
    if (query.length < 3) {
      if (field === "start") setStartAddressSuggestions([]);
      else if (field === "end") setEndAddressSuggestions([]);
      else setStopSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`/api/mileage/autocomplete?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        if (field === "start") setStartAddressSuggestions(data.suggestions || []);
        else if (field === "end") setEndAddressSuggestions(data.suggestions || []);
        else setStopSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error("Failed to fetch address suggestions:", error);
    }
  }

  // Add a new stop
  function addStop() {
    setMileageStops([...mileageStops, ""]);
  }

  // Remove a stop
  function removeStop(index: number) {
    setMileageStops(mileageStops.filter((_, i) => i !== index));
  }

  // Update a stop value
  function updateStop(index: number, value: string) {
    const newStops = [...mileageStops];
    newStops[index] = value;
    setMileageStops(newStops);
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
      <PageGuide pageId="dashboard" titleKey="dashboardTitle" descKey="dashboardDesc" tips={["dashboardTip1", "dashboardTip2", "dashboardTip3"]} />
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        <div className="flex items-center gap-2">
          {hasDraftEntries && (
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
                  {projects.filter(p => !p.archived).map((project) => (
                    <tr
                      key={project.id}
                      className={cn(
                        "border-b hover:bg-muted/30",
                        project.systemType === "absence" && "bg-muted/20 border-t-2 border-t-muted-foreground/20",
                        project.locked && "opacity-70"
                      )}
                    >
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: project.color }}
                          />
                          <span className={cn(
                            "font-medium truncate",
                            project.systemType === "absence" ? "text-muted-foreground" : "text-foreground"
                          )}>
                            {project.systemType === "absence" ? t("absenceProject") : project.name}
                          </span>
                          {project.locked && (
                            <span title={t("projectLocked")}>
                              <Lock className="h-3 w-3 text-muted-foreground" />
                            </span>
                          )}
                        </div>
                      </td>
                      {weekDays.map((day) => {
                        const entry = getEntryForCell(project.id, day);
                        const isLocked = project.locked;
                        const canEdit = isDayEditable(day) && !isLocked;
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
                                onClick={() => !isLocked && openModal(day, project.id, entry)}
                                disabled={isLocked}
                                className={cn(
                                  "relative mx-auto flex h-10 w-16 items-center justify-center rounded-md border text-sm transition-colors",
                                  getCellStyle(entry),
                                  isLocked && "cursor-not-allowed opacity-70"
                                )}
                                title={isLocked ? t("projectLockedDesc") : undefined}
                              >
                                {entry.hours}
                                {getCellIcon(entry)}
                              </button>
                            ) : (
                              <button
                                onClick={() => canEdit && openModal(day, project.id)}
                                disabled={!canEdit}
                                className={cn(
                                  "relative mx-auto flex h-10 w-16 items-center justify-center rounded-md border text-sm transition-colors",
                                  canEdit
                                    ? "border-dashed border-border text-muted-foreground hover:border-muted-foreground hover:bg-muted/50"
                                    : "border-dashed border-border/50 text-muted-foreground/30 cursor-not-allowed"
                                )}
                                title={isLocked ? t("projectLockedDesc") : undefined}
                              >
                                {isLocked ? <Lock className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
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
                  {/* Flex Balance row */}
                  <tr className="bg-muted/30 border-t border-dashed">
                    <td className="px-4 py-2 text-sm text-muted-foreground">{t("flexBalance")}</td>
                    {weekDays.map((day, i) => {
                      const balance = flexBalances[i];
                      return (
                        <td
                          key={`flex-${day.toISOString()}`}
                          className={cn(
                            "px-2 py-2 text-center text-xs font-medium",
                            isToday(day) && "bg-brand-50/30",
                            balance > 0 ? "text-emerald-600 dark:text-emerald-400" : balance < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                          )}
                        >
                          {balance >= 0 ? "+" : ""}{balance.toFixed(1)}
                        </td>
                      );
                    })}
                    {projects.some((p) => p.myAllocation != null || p.budgetTotalHours != null) && (
                      <td className="px-2 py-2" />
                    )}
                    <td className={cn(
                      "px-4 py-2 text-center text-xs font-bold",
                      timeBalance > 0 ? "text-emerald-600 dark:text-emerald-400" : timeBalance < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                    )}>
                      {timeBalance >= 0 ? "+" : ""}{timeBalance.toFixed(1)}
                    </td>
                  </tr>
                  {/* Daily Submit Buttons row */}
                  <tr className="bg-muted/30">
                    <td className="px-4 py-2 text-sm text-muted-foreground">{t("submitDay")}</td>
                    {weekDays.map((day) => {
                      const hasDrafts = dayHasDraftEntries(day);
                      const dateStr = format(day, "yyyy-MM-dd");
                      const isSubmitting = submittingDay === dateStr;

                      return (
                        <td
                          key={`submit-${day.toISOString()}`}
                          className={cn("px-1 py-2 text-center", isToday(day) && "bg-brand-50/30")}
                        >
                          {hasDrafts ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSubmitDay(day)}
                              disabled={isSubmitting}
                              className="h-7 px-2 text-xs"
                            >
                              {isSubmitting ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <Send className="h-3 w-3" />
                              )}
                            </Button>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </td>
                      );
                    })}
                    {projects.some((p) => p.myAllocation != null || p.budgetTotalHours != null) && (
                      <td className="px-2 py-2" />
                    )}
                    <td className="px-4 py-2" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Company Logo Footer */}
      {companyLogoUrl && (
        <div className="mt-8 flex justify-center pb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={companyLogoUrl}
            alt="Company logo"
            className="h-10 object-contain opacity-40"
          />
        </div>
      )}

      {/* Time Entry Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
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
                  {projects.filter(p => !p.archived && !p.locked).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: p.color }}
                        />
                        {p.systemType === "absence" ? t("absenceProject") : p.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Absence Reason Selector - only shown for Absence project */}
            {isAbsenceProject(selectedProjectId) && (
              <div className="space-y-2">
                <Label>{t("absenceReason")} *</Label>
                <Select
                  value={selectedAbsenceReasonId}
                  onValueChange={setSelectedAbsenceReasonId}
                  disabled={!!(editingEntry && isEntryReadOnly(editingEntry))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectAbsenceReason")} />
                  </SelectTrigger>
                  <SelectContent>
                    {absenceReasons.map((reason) => (
                      <SelectItem key={reason.id} value={reason.id}>
                        {reason.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder={t("hoursPlaceholder")}
                  disabled={!!(editingEntry && isEntryReadOnly(editingEntry))}
                  className="flex-1"
                />
                {isAbsenceProject(selectedProjectId) && !(editingEntry && isEntryReadOnly(editingEntry)) && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (!selectedDate) return;
                      const dow = new Date(selectedDate).getDay();
                      setHours(dow === 5 ? fridayTarget.toString() : monThuTarget.toString());
                    }}
                  >
                    {t("fullDay")}
                  </Button>
                )}
              </div>
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

            {/* Mileage Section */}
            <div className="rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setMileageSectionOpen(!mileageSectionOpen)}
                className="flex w-full items-center justify-between p-3 text-sm font-medium hover:bg-muted/50"
                disabled={!!(editingEntry && isEntryReadOnly(editingEntry))}
              >
                <span className="flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  {t("mileage")}
                  {mileageKm && (
                    <Badge variant="secondary" className="ml-1">
                      {mileageKm} km
                    </Badge>
                  )}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    mileageSectionOpen && "rotate-180"
                  )}
                />
              </button>

              {mileageSectionOpen && (
                <div className="space-y-3 border-t p-3">
                  <div className="space-y-2">
                    <Label>{t("kilometersDriven")}</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="9999"
                      value={mileageKm}
                      onChange={(e) => {
                        setMileageKm(e.target.value);
                        if (e.target.value && mileageSource !== "calculated") {
                          setMileageSource("manual");
                        }
                      }}
                      placeholder={t("mileagePlaceholder")}
                      disabled={!!(editingEntry && isEntryReadOnly(editingEntry))}
                    />
                  </div>

                  <div className="relative space-y-2">
                    <Label>{t("startAddress")}</Label>
                    <Input
                      value={mileageStartAddress}
                      onChange={(e) => {
                        setMileageStartAddress(e.target.value);
                        fetchAddressSuggestions(e.target.value, "start");
                        setActiveAddressField("start");
                      }}
                      onFocus={() => setActiveAddressField("start")}
                      onBlur={() => setTimeout(() => setActiveAddressField(null), 200)}
                      placeholder={t("startAddressPlaceholder")}
                      disabled={!!(editingEntry && isEntryReadOnly(editingEntry))}
                    />
                    {activeAddressField === "start" && startAddressSuggestions.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
                        {startAddressSuggestions.map((suggestion, i) => (
                          <button
                            key={i}
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                            onMouseDown={() => {
                              setMileageStartAddress(suggestion);
                              setStartAddressSuggestions([]);
                            }}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Stops */}
                  {mileageStops.map((stop, index) => (
                    <div key={index} className="relative space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>{t("stop")} {index + 1}</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeStop(index)}
                          disabled={!!(editingEntry && isEntryReadOnly(editingEntry))}
                          className="h-6 px-2 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <Input
                        value={stop}
                        onChange={(e) => {
                          updateStop(index, e.target.value);
                          fetchAddressSuggestions(e.target.value, index);
                          setActiveAddressField(index);
                        }}
                        onFocus={() => setActiveAddressField(index)}
                        onBlur={() => setTimeout(() => setActiveAddressField(null), 200)}
                        placeholder={t("stopPlaceholder")}
                        disabled={!!(editingEntry && isEntryReadOnly(editingEntry))}
                      />
                      {activeAddressField === index && stopSuggestions.length > 0 && (
                        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
                          {stopSuggestions.map((suggestion, i) => (
                            <button
                              key={i}
                              type="button"
                              className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                              onMouseDown={() => {
                                updateStop(index, suggestion);
                                setStopSuggestions([]);
                              }}
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add Stop Button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addStop}
                    disabled={!!(editingEntry && isEntryReadOnly(editingEntry))}
                    className="w-full"
                  >
                    <Plus className="mr-2 h-3 w-3" />
                    {t("addStop")}
                  </Button>

                  <div className="relative space-y-2">
                    <Label>{t("endAddress")}</Label>
                    <Input
                      value={mileageEndAddress}
                      onChange={(e) => {
                        setMileageEndAddress(e.target.value);
                        fetchAddressSuggestions(e.target.value, "end");
                        setActiveAddressField("end");
                      }}
                      onFocus={() => setActiveAddressField("end")}
                      onBlur={() => setTimeout(() => setActiveAddressField(null), 200)}
                      placeholder={t("endAddressPlaceholder")}
                      disabled={!!(editingEntry && isEntryReadOnly(editingEntry))}
                    />
                    {activeAddressField === "end" && endAddressSuggestions.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
                        {endAddressSuggestions.map((suggestion, i) => (
                          <button
                            key={i}
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                            onMouseDown={() => {
                              setMileageEndAddress(suggestion);
                              setEndAddressSuggestions([]);
                            }}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Round Trip Toggle */}
                  <div className="flex items-center justify-between py-2">
                    <Label className="cursor-pointer">{t("roundTrip")}</Label>
                    <button
                      type="button"
                      onClick={() => setMileageRoundTrip(!mileageRoundTrip)}
                      disabled={!!(editingEntry && isEntryReadOnly(editingEntry))}
                      className={cn(
                        "relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors",
                        mileageRoundTrip ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-600",
                        editingEntry && isEntryReadOnly(editingEntry) ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform",
                          mileageRoundTrip ? "translate-x-5" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>
                  {mileageRoundTrip && (
                    <p className="text-xs text-muted-foreground">
                      {t("roundTripDescription")}
                    </p>
                  )}

                  {mileageStartAddress && mileageEndAddress && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCalculateDistance}
                      disabled={calculatingDistance || !!(editingEntry && isEntryReadOnly(editingEntry))}
                    >
                      {calculatingDistance ? (
                        <>
                          <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                          {t("calculating")}
                        </>
                      ) : (
                        <>
                          <MapPin className="mr-2 h-3 w-3" />
                          {t("calculateDistance")}
                        </>
                      )}
                    </Button>
                  )}

                  {mileageSource && (
                    <p className="text-xs text-muted-foreground">
                      {mileageSource === "calculated"
                        ? t("distanceWasCalculated")
                        : t("distanceWasManual")}
                    </p>
                  )}
                </div>
              )}
            </div>
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
