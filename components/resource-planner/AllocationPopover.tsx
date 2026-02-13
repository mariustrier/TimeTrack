"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { addDays, format, eachDayOfInterval, isWeekend } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations } from "@/lib/i18n";
import { Trash2 } from "lucide-react";

interface Project {
  id: string;
  name: string;
  color: string;
  client: string | null;
}

interface PopoverAllocation {
  id: string;
  projectId: string;
  hoursPerDay: number;
  status: "tentative" | "confirmed" | "completed";
  notes: string | null;
  isMultiDay: boolean;
}

interface AllocationPopoverProps {
  open: boolean;
  position: { top: number; left: number } | null;
  mode: "create" | "edit";
  employeeId: string;
  date: string;
  allocation: PopoverAllocation | null;
  projects: Project[];
  defaultHoursPerDay: number;
  onSave: (data: {
    projectId: string;
    hoursPerDay: number;
    status: string;
    notes: string | null;
    startDate?: string;
    endDate?: string;
    editDate?: string;
  }) => void;
  onDelete: (allocationId: string, date?: string, redistribute?: boolean) => void;
  onClose: () => void;
}

export function AllocationPopover({
  open,
  position,
  mode,
  date,
  allocation,
  projects,
  defaultHoursPerDay,
  onSave,
  onDelete,
  onClose,
}: AllocationPopoverProps) {
  const t = useTranslations("resourcePlanner");
  const ref = useRef<HTMLDivElement>(null);

  const [projectId, setProjectId] = useState("");
  const [hours, setHours] = useState("");
  const [status, setStatus] = useState<"tentative" | "confirmed">("tentative");
  const [notes, setNotes] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [redistribute, setRedistribute] = useState(false);

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

  // Reset form when popover opens
  useEffect(() => {
    if (open) {
      if (mode === "edit" && allocation) {
        setProjectId(allocation.projectId);
        setHours(allocation.hoursPerDay.toString());
        setStatus(allocation.status === "completed" ? "confirmed" : allocation.status);
        setNotes(allocation.notes || "");
        setStartDate("");
        setEndDate("");
        setRedistribute(false);
      } else {
        setProjectId("");
        setHours(defaultHoursPerDay.toString());
        setStatus("tentative");
        setNotes("");
        // Default: clicked day to +4 days (Mon-Fri)
        setStartDate(date);
        try {
          setEndDate(format(addDays(new Date(date), 4), "yyyy-MM-dd"));
        } catch {
          setEndDate(date);
        }
      }
    }
  }, [open, mode, allocation, defaultHoursPerDay, date]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open, onClose]);

  if (!open || !position) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !hours) return;
    setSaving(true);
    try {
      await onSave({
        projectId,
        hoursPerDay: parseFloat(hours),
        status,
        notes: notes || null,
        startDate: mode === "create" ? startDate : undefined,
        endDate: mode === "create" ? endDate : undefined,
        editDate: mode === "edit" && allocation?.isMultiDay ? date : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDay = () => {
    if (!allocation) return;
    onDelete(allocation.id, allocation.isMultiDay ? date : undefined, redistribute);
  };

  const handleDeleteAll = () => {
    if (!allocation) return;
    onDelete(allocation.id);
  };

  // Position: clamp to viewport
  const top = Math.min(position.top, window.innerHeight - 440);
  const left = Math.min(position.left, window.innerWidth - 340);

  return (
    <>
      <div className="fixed inset-0 z-40" />
      <div
        ref={ref}
        className="fixed z-50 w-[320px] bg-card border rounded-lg shadow-xl p-4 space-y-3"
        style={{ top, left }}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Project */}
          <div className="space-y-1">
            <Label className="text-xs">{t("project") || "Project"}</Label>
            <Select value={projectId} onValueChange={setProjectId} disabled={mode === "edit"}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder={t("selectProject") || "Select project"} />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="truncate">{p.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Range — only in create mode */}
          {mode === "create" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">{t("startDate") || "Start Date"}</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-8 text-sm"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("endDate") || "End Date"}</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  className="h-8 text-sm"
                  required
                />
              </div>
            </div>
          )}

          {/* Hours */}
          <div className="space-y-1">
            <Label className="text-xs">{t("hoursPerDay") || "Hours per Day"}</Label>
            <Input
              type="number"
              step="0.5"
              min="0.5"
              max="24"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="h-8 text-sm"
              required
            />
            {mode === "create" && workingDays > 0 && hours && (
              <p className="text-[11px] text-muted-foreground">
                = {(parseFloat(hours) * workingDays).toFixed(1)}h {t("totalOver") || "total over"}{" "}
                {workingDays} {t("workingDays") || "working days"}
              </p>
            )}
          </div>

          {/* Status */}
          <div className="space-y-1">
            <Label className="text-xs">{t("status") || "Status"}</Label>
            <div className="flex gap-1.5">
              <Button
                type="button"
                variant={status === "tentative" ? "default" : "outline"}
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={() => setStatus("tentative")}
              >
                {t("tentative") || "Tentative"}
              </Button>
              <Button
                type="button"
                variant={status === "confirmed" ? "default" : "outline"}
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={() => setStatus("confirmed")}
              >
                {t("confirmed") || "Confirmed"}
              </Button>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label className="text-xs">{t("notes") || "Notes"}</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("notesPlaceholder") || "Optional notes..."}
              className="h-8 text-sm"
              maxLength={500}
            />
          </div>

          {/* Delete options for multi-day allocations */}
          {mode === "edit" && allocation?.isMultiDay && (
            <div className="border-t border-border pt-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] text-destructive hover:text-destructive px-2"
                  onClick={handleDeleteDay}
                  disabled={saving}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  {t("deleteThisDay") || "Delete this day"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] text-destructive hover:text-destructive px-2"
                  onClick={handleDeleteAll}
                  disabled={saving}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  {t("deleteAllDays") || "Delete all days"}
                </Button>
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={redistribute}
                  onChange={(e) => setRedistribute(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border accent-primary"
                />
                <span className="text-[11px] text-muted-foreground">
                  {t("redistributeHours") || "Redistribute hours to remaining days"}
                </span>
              </label>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            {mode === "edit" && !allocation?.isMultiDay && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-destructive hover:text-destructive"
                onClick={handleDeleteDay}
                disabled={saving}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                {t("delete") || "Delete"}
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={onClose}
                disabled={saving}
              >
                {t("cancel") || "Cancel"}
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-7 text-xs"
                disabled={saving || !projectId}
              >
                {saving
                  ? t("saving") || "Saving..."
                  : mode === "edit"
                    ? t("update") || "Update"
                    : t("create") || "Create"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
