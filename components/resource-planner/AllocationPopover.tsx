"use client";

import { useState, useEffect, useRef } from "react";
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
    editDate?: string;
  }) => void;
  onDelete: (allocationId: string, date?: string) => void;
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
  const [saving, setSaving] = useState(false);

  // Reset form when popover opens
  useEffect(() => {
    if (open) {
      if (mode === "edit" && allocation) {
        setProjectId(allocation.projectId);
        setHours(allocation.hoursPerDay.toString());
        setStatus(allocation.status === "completed" ? "confirmed" : allocation.status);
        setNotes(allocation.notes || "");
      } else {
        setProjectId("");
        setHours(defaultHoursPerDay.toString());
        setStatus("tentative");
        setNotes("");
      }
    }
  }, [open, mode, allocation, defaultHoursPerDay]);

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
    // Delay to avoid catching the same click that opened it
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
        editDate: mode === "edit" && allocation?.isMultiDay ? date : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!allocation) return;
    onDelete(allocation.id, allocation.isMultiDay ? date : undefined);
  };

  // Position: clamp to viewport
  const top = Math.min(position.top, window.innerHeight - 360);
  const left = Math.min(position.left, window.innerWidth - 340);

  return (
    <>
      <div className="fixed inset-0 z-40" />
      <div
        ref={ref}
        className="fixed z-50 w-[300px] bg-card border rounded-lg shadow-xl p-4 space-y-3"
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

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            {mode === "edit" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-destructive hover:text-destructive"
                onClick={handleDelete}
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
