"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { format, addDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "@/lib/i18n";
import { Trash2, Flag, Handshake, Rocket, Eye, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEADLINE_ICONS } from "./types";
import type { TimelineMilestone, CompanyPhase, DeadlineIcon } from "./types";
import type { LucideIcon } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  flag: Flag,
  handshake: Handshake,
  rocket: Rocket,
  eye: Eye,
  calendar: CalendarDays,
};

interface DeadlinePopoverProps {
  open: boolean;
  position: { top: number; left: number } | null;
  milestone: TimelineMilestone | null;
  projectId: string;
  projectColor: string;
  companyPhases: CompanyPhase[];
  existingPhaseDeadlines: string[]; // phaseIds that already have deadlines
  teamMembers?: { id: string; name: string; imageUrl: string | null }[];
  defaultDate?: string;
  onSave: (data: {
    projectId: string;
    milestoneId?: string;
    title: string;
    dueDate: string;
    completed?: boolean;
    type: "phase" | "custom";
    phaseId?: string | null;
    description?: string | null;
    icon?: DeadlineIcon | null;
    color?: string | null;
  }) => void;
  onDelete: (milestoneId: string, projectId: string) => void;
  onClose: () => void;
}

export function DeadlinePopover({
  open,
  position,
  milestone,
  projectId,
  projectColor,
  companyPhases,
  existingPhaseDeadlines,
  defaultDate,
  onSave,
  onDelete,
  onClose,
}: DeadlinePopoverProps) {
  const t = useTranslations("timeline");
  const ref = useRef<HTMLDivElement>(null);

  const [tab, setTab] = useState<"phase" | "custom">("custom");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [completed, setCompleted] = useState(false);
  const [phaseId, setPhaseId] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<DeadlineIcon | "">("flag");
  const [color, setColor] = useState("");
  const [saving, setSaving] = useState(false);

  const isEditing = !!milestone;

  // Available phases (exclude those that already have deadlines, unless editing this one)
  const availablePhases = useMemo(() => {
    return companyPhases.filter((p) => {
      if (milestone?.phaseId === p.id) return true;
      return !existingPhaseDeadlines.includes(p.id);
    });
  }, [companyPhases, existingPhaseDeadlines, milestone]);

  const allPhasesUsed = companyPhases.length > 0 && availablePhases.length === 0;

  useEffect(() => {
    if (open) {
      if (milestone) {
        setTab(milestone.type === "phase" ? "phase" : "custom");
        setTitle(milestone.title);
        setDueDate(format(new Date(milestone.dueDate + "T00:00:00"), "yyyy-MM-dd"));
        setCompleted(milestone.completed);
        setPhaseId(milestone.phaseId || "");
        setDescription(milestone.description || "");
        setIcon((milestone.icon as DeadlineIcon) || "flag");
        setColor(milestone.color || "");
      } else {
        setTab(companyPhases.length > 0 && !allPhasesUsed ? "phase" : "custom");
        setTitle("");
        setDueDate(defaultDate || format(addDays(new Date(), 7), "yyyy-MM-dd"));
        setCompleted(false);
        setPhaseId(availablePhases[0]?.id || "");
        setDescription("");
        setIcon("flag");
        setColor("");
      }
    }
  }, [open, milestone, defaultDate, companyPhases, availablePhases, allPhasesUsed]);

  // Auto-title for phase tab
  useEffect(() => {
    if (tab === "phase" && phaseId && !isEditing) {
      const phase = companyPhases.find((p) => p.id === phaseId);
      if (phase) {
        setTitle(`${phase.name} ${t("phaseHandover") || "Handover"}`);
      }
    }
  }, [tab, phaseId, companyPhases, isEditing, t]);

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
    if (!title || !dueDate) return;
    setSaving(true);
    try {
      await onSave({
        projectId,
        milestoneId: milestone?.id,
        title,
        dueDate,
        completed: isEditing ? completed : undefined,
        type: tab,
        phaseId: tab === "phase" ? phaseId || null : null,
        description: tab === "custom" ? description || null : null,
        icon: tab === "custom" ? (icon as DeadlineIcon) || null : null,
        color: tab === "custom" ? color || null : null,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!milestone) return;
    if (!window.confirm(t("confirmDeleteDeadline") || "Delete this deadline?")) return;
    onDelete(milestone.id, projectId);
  };

  const top = Math.min(position.top, window.innerHeight - 480);
  const left = Math.min(position.left, window.innerWidth - 320);

  return (
    <>
      <div className="fixed inset-0 z-40" />
      <div
        ref={ref}
        className="fixed z-50 w-[300px] bg-card border rounded-lg shadow-xl p-4 space-y-3"
        style={{ top, left }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: projectColor }} />
          <span className="text-sm font-medium">
            {isEditing ? t("editDeadline") || "Edit Deadline" : t("addDeadline") || "Add Deadline"}
          </span>
        </div>

        {/* Tabs */}
        {companyPhases.length > 0 && (
          <div className="flex gap-1 bg-muted rounded-md p-0.5">
            <button
              className={cn(
                "flex-1 text-xs py-1 rounded transition-colors",
                tab === "phase" ? "bg-card shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setTab("phase")}
              type="button"
            >
              {t("phaseDeadline") || "Phase Deadline"}
            </button>
            <button
              className={cn(
                "flex-1 text-xs py-1 rounded transition-colors",
                tab === "custom" ? "bg-card shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setTab("custom")}
              type="button"
            >
              {t("customDeadline") || "Custom"}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Phase tab */}
          {tab === "phase" && (
            <div className="space-y-1">
              <Label className="text-xs">{t("selectPhase") || "Select phase"}</Label>
              {allPhasesUsed ? (
                <p className="text-[10px] text-muted-foreground italic">
                  {t("allPhasesHaveDeadlines") || "All phases already have deadlines"}
                </p>
              ) : (
                <select
                  value={phaseId}
                  onChange={(e) => setPhaseId(e.target.value)}
                  className="w-full h-8 text-sm rounded-md border border-input bg-background px-2"
                >
                  {availablePhases.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Title */}
          <div className="space-y-1">
            <Label className="text-xs">{t("deadlineTitle") || "Title"}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("deadlineTitlePlaceholder") || "e.g., Client Review"}
              className="h-8 text-sm"
              required
              autoFocus
            />
          </div>

          {/* Due date */}
          <div className="space-y-1">
            <Label className="text-xs">{t("deadlineDate") || "Deadline date"}</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-8 text-sm"
              required
            />
          </div>

          {/* Custom tab: description */}
          {tab === "custom" && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">{t("deadlineDescription") || "Description (optional)"}</Label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("notePlaceholder") || "Optional note..."}
                  className="w-full h-16 text-sm rounded-md border border-input bg-background px-3 py-1.5 resize-none"
                  maxLength={1000}
                />
              </div>

              {/* Icon picker */}
              <div className="space-y-1">
                <Label className="text-xs">{t("deadlineIcon") || "Icon"}</Label>
                <div className="flex gap-1.5">
                  {DEADLINE_ICONS.map((iconName) => {
                    const Icon = ICON_MAP[iconName];
                    return (
                      <button
                        key={iconName}
                        type="button"
                        className={cn(
                          "w-7 h-7 rounded-md flex items-center justify-center border transition-colors",
                          icon === iconName
                            ? "border-primary bg-primary/10"
                            : "border-transparent hover:bg-muted"
                        )}
                        onClick={() => setIcon(iconName)}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color picker (simple preset squares) */}
              <div className="space-y-1">
                <Label className="text-xs">{t("color") || "Color"}</Label>
                <div className="flex gap-1.5">
                  {["", "#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899"].map((c) => (
                    <button
                      key={c || "default"}
                      type="button"
                      className={cn(
                        "w-5 h-5 rounded-full border-2 transition-all",
                        color === c ? "border-primary scale-110" : "border-transparent"
                      )}
                      style={{ backgroundColor: c || projectColor }}
                      onClick={() => setColor(c)}
                      title={c || "Default"}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Completed checkbox (edit mode) */}
          {isEditing && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="dl-completed"
                checked={completed}
                onChange={(e) => setCompleted(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border"
              />
              <Label htmlFor="dl-completed" className="text-xs cursor-pointer">
                {t("markComplete") || "Mark as completed"}
              </Label>
            </div>
          )}

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
                disabled={saving || !title || (tab === "phase" && allPhasesUsed)}
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
