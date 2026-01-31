"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  color: string;
  billable: boolean;
}

interface TimeEntry {
  id: string;
  hours: number;
  date: string;
  comment: string | null;
  projectId: string;
  project: Project;
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
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [hours, setHours] = useState("");
  const [comment, setComment] = useState("");
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [vacationDaysUsed, setVacationDaysUsed] = useState(0);
  const [vacationDaysTotal, setVacationDaysTotal] = useState(25);

  const weekStart = useMemo(() => startOfWeek(currentWeek, { weekStartsOn: 1 }), [currentWeek]);
  const weekEnd = useMemo(() => endOfWeek(currentWeek, { weekStartsOn: 1 }), [currentWeek]);
  const weekDays = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd]);

  const fetchData = useCallback(async () => {
    setLoading(true);
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
        setEntries(data);
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
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }, [weekStart, weekEnd]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
    .filter((e) => e.project.billable)
    .reduce((sum, e) => sum + e.hours, 0);
  const weeklyTarget = 40;
  const timeBalance = grandTotal - weeklyTarget;

  function openModal(date: Date, projectId?: string, entry?: TimeEntry) {
    setSelectedDate(format(date, "yyyy-MM-dd"));
    setSelectedProjectId(projectId || "");
    if (entry) {
      setEditingEntry(entry);
      setHours(entry.hours.toString());
      setComment(entry.comment || "");
    } else {
      setEditingEntry(null);
      setHours("");
      setComment("");
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
          body: JSON.stringify({ hours, comment }),
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
        <h1 className="text-2xl font-bold text-slate-900">Timesheet</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setCurrentWeek(new Date())}>
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-sm text-slate-600">
            {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
          </span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Target"
          value={`${weeklyTarget}h`}
          icon={Target}
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          title="Billable"
          value={`${billableTotal.toFixed(1)}h`}
          icon={DollarSign}
          color="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          title="Vacation"
          value={`${vacationDaysUsed}d`}
          icon={Palmtree}
          color="bg-amber-50 text-amber-600"
          subtitle="days used"
        />
        <StatCard
          title="Total"
          value={`${grandTotal.toFixed(1)}h`}
          icon={Clock}
          color="bg-purple-50 text-purple-600"
        />
        <StatCard
          title="Time Balance"
          value={`${timeBalance >= 0 ? "+" : ""}${timeBalance.toFixed(1)}h`}
          icon={TrendingUp}
          color={timeBalance >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}
        />
        <StatCard
          title="Vacation Days"
          value={`${vacationDaysTotal - vacationDaysUsed}`}
          icon={CalendarDays}
          color="bg-sky-50 text-sky-600"
          subtitle="remaining"
        />
      </div>

      {/* Timesheet Grid */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Weekly Timesheet</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Clock className="h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-semibold text-slate-900">No Projects Yet</h3>
              <p className="mt-1 text-sm text-slate-500">
                Ask your admin to create projects to start tracking time.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="px-4 py-3 text-left font-medium text-slate-600 w-48">
                      Project
                    </th>
                    {weekDays.map((day) => (
                      <th
                        key={day.toISOString()}
                        className={cn(
                          "px-2 py-3 text-center font-medium w-20",
                          isToday(day) ? "text-brand-600 bg-brand-50/50" : "text-slate-600"
                        )}
                      >
                        <div>{format(day, "EEE")}</div>
                        <div className="text-xs">{format(day, "MMM d")}</div>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center font-medium text-slate-600 w-20">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => (
                    <tr key={project.id} className="border-b hover:bg-slate-50/50">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: project.color }}
                          />
                          <span className="font-medium text-slate-900 truncate">
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
                            <button
                              onClick={() => openModal(day, project.id, entry)}
                              className={cn(
                                "relative mx-auto flex h-10 w-16 items-center justify-center rounded-md border text-sm transition-colors",
                                entry
                                  ? "border-brand-200 bg-brand-50 font-medium text-brand-700 hover:bg-brand-100"
                                  : "border-dashed border-slate-200 text-slate-400 hover:border-slate-300 hover:bg-slate-50"
                              )}
                            >
                              {entry ? (
                                <>
                                  {entry.hours}
                                  {entry.comment && (
                                    <MessageSquare className="absolute -right-1 -top-1 h-3 w-3 text-brand-400" />
                                  )}
                                </>
                              ) : (
                                <Plus className="h-3 w-3" />
                              )}
                            </button>
                          </td>
                        );
                      })}
                      <td className="px-4 py-2 text-center font-semibold text-slate-900">
                        {getRowTotal(project.id).toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">Daily Total</td>
                    {weekDays.map((day) => (
                      <td
                        key={day.toISOString()}
                        className={cn(
                          "px-2 py-3 text-center font-semibold text-slate-900",
                          isToday(day) && "bg-brand-50/50"
                        )}
                      >
                        {getColumnTotal(day).toFixed(1)}
                      </td>
                    ))}
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
              {editingEntry ? "Edit Time Entry" : "Log Time"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
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
              <Label>Date</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Hours</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                max="24"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="e.g. 8"
              />
            </div>
            <div className="space-y-2">
              <Label>Comment</Label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="What did you work on?"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            {editingEntry && (
              <Button variant="destructive" onClick={handleDelete} disabled={saving}>
                Delete
              </Button>
            )}
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !hours || !selectedProjectId || !comment.trim()}>
              {saving ? "Saving..." : editingEntry ? "Update" : "Log Time"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
