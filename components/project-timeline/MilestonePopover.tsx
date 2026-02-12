"use client";

import { useState, useEffect, useRef } from "react";
import { format, addDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "@/lib/i18n";
import { Trash2 } from "lucide-react";
import type { TimelineMilestone } from "./types";

interface MilestonePopoverProps {
  open: boolean;
  position: { top: number; left: number } | null;
  milestone: TimelineMilestone | null;
  projectId: string;
  projectColor: string;
  defaultDate?: string;
  onSave: (data: {
    projectId: string;
    milestoneId?: string;
    title: string;
    dueDate: string;
    completed?: boolean;
  }) => void;
  onDelete: (milestoneId: string, projectId: string) => void;
  onClose: () => void;
}

export function MilestonePopover({
  open,
  position,
  milestone,
  projectId,
  projectColor,
  defaultDate,
  onSave,
  onDelete,
  onClose,
}: MilestonePopoverProps) {
  const t = useTranslations("timeline");
  const ref = useRef<HTMLDivElement>(null);

  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEditing = !!milestone;

  useEffect(() => {
    if (open) {
      if (milestone) {
        setTitle(milestone.title);
        setDueDate(format(new Date(milestone.dueDate), "yyyy-MM-dd"));
        setCompleted(milestone.completed);
      } else {
        setTitle("");
        setDueDate(defaultDate || format(addDays(new Date(), 7), "yyyy-MM-dd"));
        setCompleted(false);
      }
    }
  }, [open, milestone, defaultDate]);

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
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!milestone) return;
    onDelete(milestone.id, projectId);
  };

  const top = Math.min(position.top, window.innerHeight - 340);
  const left = Math.min(position.left, window.innerWidth - 300);

  return (
    <>
      <div className="fixed inset-0 z-40" />
      <div
        ref={ref}
        className="fixed z-50 w-[280px] bg-card border rounded-lg shadow-xl p-4 space-y-3"
        style={{ top, left }}
      >
        {/* Color indicator */}
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: projectColor }} />
          <span className="text-sm font-medium">
            {isEditing ? t("editMilestone") || "Edit Milestone" : t("addMilestone") || "Add Milestone"}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">{t("milestoneTitle") || "Title"}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("milestoneTitlePlaceholder") || "e.g., Phase 1 Complete"}
              className="h-8 text-sm"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">{t("dueDate") || "Due Date"}</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-8 text-sm"
              required
            />
          </div>

          {isEditing && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ms-completed"
                checked={completed}
                onChange={(e) => setCompleted(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border"
              />
              <Label htmlFor="ms-completed" className="text-xs cursor-pointer">
                {t("markComplete") || "Mark as completed"}
              </Label>
            </div>
          )}

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
                disabled={saving || !title}
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
