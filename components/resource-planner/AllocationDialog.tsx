"use client";

import { useState, useEffect, useMemo } from "react";
import { format, addDays, differenceInDays, isWeekend, eachDayOfInterval } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { useTranslations } from "@/lib/i18n";
import { Trash2, Clock, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";

interface Employee {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  imageUrl: string | null;
  weeklyTarget: number;
}

interface Project {
  id: string;
  name: string;
  color: string;
  client: string | null;
}

interface ResourceAllocation {
  id: string;
  userId: string;
  projectId: string;
  startDate: string;
  endDate: string;
  hoursPerDay: number;
  totalHours: number | null;
  status: "tentative" | "confirmed" | "completed";
  notes: string | null;
  user: Employee;
  project: Project;
}

interface AllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allocation: ResourceAllocation | null;
  employee: Employee | null;
  date: Date | null;
  employees: Employee[];
  projects: Project[];
  onSave: (data: {
    userId: string;
    projectId: string;
    startDate: string;
    endDate: string;
    hoursPerDay?: number;
    totalHours?: number | null;
    status: string;
    notes: string | null;
  }) => void;
  onDelete: (id: string) => void;
}

export function AllocationDialog({
  open,
  onOpenChange,
  allocation,
  employee,
  date,
  employees,
  projects,
  onSave,
  onDelete,
}: AllocationDialogProps) {
  const t = useTranslations("resourcePlanner");

  const [userId, setUserId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [hoursMode, setHoursMode] = useState<"perDay" | "total">("perDay");
  const [hoursPerDay, setHoursPerDay] = useState("7.5");
  const [totalHours, setTotalHours] = useState("");
  const [status, setStatus] = useState<"tentative" | "confirmed" | "completed">("tentative");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  // Calculate working days in the date range
  const workingDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start > end) return 0;
      const days = eachDayOfInterval({ start, end });
      return days.filter((d) => !isWeekend(d)).length;
    } catch {
      return 0;
    }
  }, [startDate, endDate]);

  // Calculate the other value when one changes
  const calculatedHoursPerDay = useMemo(() => {
    if (hoursMode === "total" && totalHours && workingDays > 0) {
      return (parseFloat(totalHours) / workingDays).toFixed(1);
    }
    return hoursPerDay;
  }, [hoursMode, totalHours, workingDays, hoursPerDay]);

  const calculatedTotalHours = useMemo(() => {
    if (hoursMode === "perDay" && hoursPerDay && workingDays > 0) {
      return (parseFloat(hoursPerDay) * workingDays).toFixed(1);
    }
    return totalHours;
  }, [hoursMode, hoursPerDay, workingDays, totalHours]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (allocation) {
        // Editing existing
        setUserId(allocation.userId);
        setProjectId(allocation.projectId);
        setStartDate(format(new Date(allocation.startDate), "yyyy-MM-dd"));
        setEndDate(format(new Date(allocation.endDate), "yyyy-MM-dd"));
        // Determine mode based on whether totalHours is set
        if (allocation.totalHours) {
          setHoursMode("total");
          setTotalHours(allocation.totalHours.toString());
          setHoursPerDay(allocation.hoursPerDay.toString());
        } else {
          setHoursMode("perDay");
          setHoursPerDay(allocation.hoursPerDay.toString());
          setTotalHours("");
        }
        setStatus(allocation.status);
        setNotes(allocation.notes || "");
      } else {
        // Creating new
        setUserId(employee?.id || "");
        setProjectId("");
        setStartDate(date ? format(date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"));
        setEndDate(date ? format(addDays(date, 4), "yyyy-MM-dd") : format(addDays(new Date(), 4), "yyyy-MM-dd"));
        setHoursMode("perDay");
        setHoursPerDay("7.5");
        setTotalHours("");
        setStatus("tentative");
        setNotes("");
      }
    }
  }, [open, allocation, employee, date]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (hoursMode === "total") {
        // Total hours mode - let API calculate hoursPerDay
        await onSave({
          userId,
          projectId,
          startDate,
          endDate,
          totalHours: parseFloat(totalHours),
          status,
          notes: notes || null,
        });
      } else {
        // Per day mode
        await onSave({
          userId,
          projectId,
          startDate,
          endDate,
          hoursPerDay: parseFloat(hoursPerDay),
          totalHours: null, // Clear totalHours
          status,
          notes: notes || null,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!allocation) return;
    if (!confirm(t("confirmDelete") || "Are you sure you want to delete this allocation?")) return;

    setLoading(true);
    try {
      await onDelete(allocation.id);
    } finally {
      setLoading(false);
    }
  };

  const getEmployeeDisplayName = (emp: Employee) => {
    if (emp.firstName && emp.lastName) {
      return `${emp.firstName} ${emp.lastName}`;
    }
    return emp.email.split("@")[0];
  };

  const isEditing = !!allocation;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? t("editAllocation") || "Edit Allocation"
              : t("createAllocation") || "Create Allocation"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Employee Selection */}
          <div className="space-y-2">
            <Label>{t("employee") || "Employee"}</Label>
            <Select
              value={userId}
              onValueChange={setUserId}
              disabled={isEditing}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("selectEmployee") || "Select employee"} />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {getEmployeeDisplayName(emp)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Project Selection */}
          <div className="space-y-2">
            <Label>{t("project") || "Project"}</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder={t("selectProject") || "Select project"} />
              </SelectTrigger>
              <SelectContent>
                {projects.map((proj) => (
                  <SelectItem key={proj.id} value={proj.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: proj.color }}
                      />
                      {proj.name}
                      {proj.client && (
                        <span className="text-muted-foreground">({proj.client})</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("startDate") || "Start Date"}</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t("endDate") || "End Date"}</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                required
              />
            </div>
          </div>

          {/* Hours Mode Toggle */}
          <div className="space-y-3">
            <Label>{t("hoursInput") || "Hours"}</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={hoursMode === "perDay" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setHoursMode("perDay")}
              >
                <Clock className="h-4 w-4 mr-2" />
                {t("perDay") || "Per Day"}
              </Button>
              <Button
                type="button"
                variant={hoursMode === "total" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setHoursMode("total")}
              >
                <Calculator className="h-4 w-4 mr-2" />
                {t("totalHours") || "Total Hours"}
              </Button>
            </div>

            {hoursMode === "perDay" ? (
              <div className="space-y-2">
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="24"
                  value={hoursPerDay}
                  onChange={(e) => setHoursPerDay(e.target.value)}
                  required
                />
                {workingDays > 0 && (
                  <p className="text-xs text-muted-foreground">
                    = {calculatedTotalHours}h {t("totalOver") || "total over"} {workingDays} {t("workingDays") || "working days"}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={totalHours}
                  onChange={(e) => setTotalHours(e.target.value)}
                  placeholder={t("enterTotalHours") || "Enter total hours for period"}
                  required
                />
                {workingDays > 0 && totalHours && (
                  <p className="text-xs text-muted-foreground">
                    = {calculatedHoursPerDay}h/{t("day") || "day"} ({workingDays} {t("workingDays") || "working days"})
                  </p>
                )}
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {t("rolloverNote") || "Unlogged hours will roll over to remaining days"}
                </p>
              </div>
            )}
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>{t("status") || "Status"}</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tentative">
                  {t("tentative") || "Tentative"}
                </SelectItem>
                <SelectItem value="confirmed">
                  {t("confirmed") || "Confirmed"}
                </SelectItem>
                <SelectItem value="completed">
                  {t("completed") || "Completed"}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>{t("notes") || "Notes"}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("notesPlaceholder") || "Optional notes..."}
              rows={2}
            />
          </div>

          <DialogFooter className="gap-2">
            {isEditing && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={loading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t("delete") || "Delete"}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {t("cancel") || "Cancel"}
            </Button>
            <Button type="submit" disabled={loading || !userId || !projectId}>
              {loading
                ? t("saving") || "Saving..."
                : isEditing
                  ? t("update") || "Update"
                  : t("create") || "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
