"use client";

import { useState, useEffect, useRef } from "react";
import { format, addDays } from "date-fns";
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
import type { TimelineActivity, CompanyPhase, ActivityStatus } from "./types";

interface ActivityPopoverProps {
  open: boolean;
  position: { top: number; left: number } | null;
  activity: TimelineActivity | null;
  projectId: string;
  projectColor: string;
  companyPhases: CompanyPhase[];
  phasesEnabled: boolean;
  teamMembers: { id: string; name: string; imageUrl: string | null }[];
  defaultDate?: string;
  onSave: (data: Record<string, unknown>) => void;
  onUpdate: (activityId: string, data: Record<string, unknown>) => void;
  onDelete: (activityId: string) => void;
  onClose: () => void;
}

const STATUS_OPTIONS: { value: ActivityStatus; label: string }[] = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "needs_review", label: "Needs Review" },
  { value: "complete", label: "Complete" },
];

export function ActivityPopover({
  open,
  position,
  activity,
  projectId,
  projectColor,
  companyPhases,
  phasesEnabled,
  teamMembers,
  defaultDate,
  onSave,
  onUpdate,
  onDelete,
  onClose,
}: ActivityPopoverProps) {
  const t = useTranslations("timeline");
  const ref = useRef<HTMLDivElement>(null);

  const [name, setName] = useState("");
  const [phaseId, setPhaseId] = useState<string>("");
  const [categoryName, setCategoryName] = useState("");
  const [assignedUserId, setAssignedUserId] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<ActivityStatus>("not_started");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const isEditing = !!activity;

  // Reset form when popover opens
  useEffect(() => {
    if (open) {
      if (activity) {
        setName(activity.name);
        setPhaseId(activity.phaseId || "");
        setCategoryName(activity.categoryName || "");
        setAssignedUserId(activity.assignedUserId || "");
        setStartDate(format(new Date(activity.startDate + "T00:00:00"), "yyyy-MM-dd"));
        setEndDate(format(new Date(activity.endDate + "T00:00:00"), "yyyy-MM-dd"));
        setStatus(activity.status);
        setNote(activity.note || "");
      } else {
        setName("");
        setPhaseId("");
        setCategoryName("");
        setAssignedUserId("");
        setStartDate(defaultDate || format(new Date(), "yyyy-MM-dd"));
        setEndDate(defaultDate || format(addDays(new Date(), 7), "yyyy-MM-dd"));
        setStatus("not_started");
        setNote("");
      }
    }
  }, [open, activity, defaultDate]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Close on outside click (ignore Radix Select portals)
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (ref.current && !ref.current.contains(target)) {
        // Don't close if clicking inside a Radix Select/Popover portal
        if (target.closest("[data-radix-popper-content-wrapper]")) return;
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
    if (!name || !startDate || !endDate) return;
    setSaving(true);

    const formData: Record<string, unknown> = {
      projectId,
      name,
      startDate,
      endDate,
      status,
      note: note || null,
      assignedUserId: assignedUserId || null,
      ...(phasesEnabled && companyPhases.length > 0
        ? { phaseId: phaseId || null }
        : { categoryName: categoryName || null }),
    };

    try {
      if (isEditing) {
        await onUpdate(activity.id, formData);
      } else {
        await onSave(formData);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!activity) return;
    if (!window.confirm(t("confirmDeleteActivity") || "Are you sure you want to delete this activity?")) return;
    onDelete(activity.id);
    onClose();
  };

  const top = Math.max(16, Math.min(position.top, window.innerHeight - 480));
  const left = Math.max(16, Math.min(position.left, window.innerWidth - 300));

  return (
    <>
      <div className="fixed inset-0 z-40" />
      <div
        ref={ref}
        className="fixed z-50 w-[280px] max-h-[calc(100vh-32px)] bg-card border rounded-lg shadow-xl p-4 overflow-y-auto"
        style={{ top, left }}
      >
        {/* Color indicator */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: projectColor }} />
          <span className="text-sm font-medium">
            {isEditing
              ? t("editActivity") || "Edit Activity"
              : t("addActivity") || "Add Activity"}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Name */}
          <div className="space-y-1">
            <Label className="text-xs">{t("activityName") || "Name"}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("activityNamePlaceholder") || "e.g., Design mockups"}
              className="h-8 text-sm"
              required
              autoFocus
            />
          </div>

          {/* Phase or Category */}
          {phasesEnabled && companyPhases.length > 0 ? (
            <div className="space-y-1">
              <Label className="text-xs">{t("phase") || "Phase"}</Label>
              <Select value={phaseId} onValueChange={setPhaseId}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder={t("selectPhase") || "Select phase"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("noPhase") || "No Phase"}</SelectItem>
                  {companyPhases.map((phase) => (
                    <SelectItem key={phase.id} value={phase.id}>
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: phase.color }}
                        />
                        <span>{phase.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-xs">{t("category") || "Category"}</Label>
              <Input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder={t("categoryPlaceholder") || "e.g., Design, Development"}
                className="h-8 text-sm"
              />
            </div>
          )}

          {/* Assigned */}
          <div className="space-y-1">
            <Label className="text-xs">{t("assigned") || "Assigned"}</Label>
            <Select value={assignedUserId} onValueChange={setAssignedUserId}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder={t("unassigned") || "Unassigned"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("unassigned") || "Unassigned"}</SelectItem>
                {teamMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Start Date */}
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

          {/* End Date */}
          <div className="space-y-1">
            <Label className="text-xs">{t("endDate") || "End Date"}</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 text-sm"
              required
              min={startDate}
            />
          </div>

          {/* Status */}
          <div className="space-y-1">
            <Label className="text-xs">{t("activityStatus") || "Status"}</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ActivityStatus)}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Note */}
          <div className="space-y-1">
            <Label className="text-xs">{t("note") || "Note"}</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("notePlaceholder") || "Optional note..."}
              className="h-8 text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            {isEditing && (
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
                disabled={saving || !name || !startDate || !endDate}
              >
                {saving
                  ? t("saving") || "Saving..."
                  : isEditing
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
