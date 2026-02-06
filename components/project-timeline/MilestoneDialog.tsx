"use client";

import { useState, useEffect } from "react";
import { format, addDays } from "date-fns";
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
import { useTranslations } from "@/lib/i18n";
import { Trash2 } from "lucide-react";

interface Project {
  id: string;
  name: string;
  color: string;
}

interface Milestone {
  id: string;
  projectId: string;
  title: string;
  dueDate: string;
  completed: boolean;
}

interface MilestoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
  milestone: Milestone | null;
  onSave: (data: {
    projectId: string;
    title: string;
    dueDate: string;
    completed?: boolean;
  }) => void;
  onDelete: (milestoneId: string, projectId: string) => void;
}

export function MilestoneDialog({
  open,
  onOpenChange,
  project,
  milestone,
  onSave,
  onDelete,
}: MilestoneDialogProps) {
  const t = useTranslations("timeline");

  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (milestone) {
        setTitle(milestone.title);
        setDueDate(format(new Date(milestone.dueDate), "yyyy-MM-dd"));
        setCompleted(milestone.completed);
      } else {
        setTitle("");
        setDueDate(format(addDays(new Date(), 7), "yyyy-MM-dd"));
        setCompleted(false);
      }
    }
  }, [open, milestone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;

    setLoading(true);
    try {
      await onSave({
        projectId: project.id,
        title,
        dueDate,
        completed: milestone ? completed : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!milestone || !project) return;
    if (!confirm(t("confirmDelete") || "Are you sure you want to delete this milestone?")) return;

    setLoading(true);
    try {
      await onDelete(milestone.id, project.id);
    } finally {
      setLoading(false);
    }
  };

  const isEditing = !!milestone;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? t("editMilestone") || "Edit Milestone"
              : t("addMilestone") || "Add Milestone"}
          </DialogTitle>
        </DialogHeader>

        {project && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: project.color }}
            />
            {project.name}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label>{t("milestoneTitle") || "Title"}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("milestoneTitlePlaceholder") || "e.g., Phase 1 Complete"}
              required
            />
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label>{t("dueDate") || "Due Date"}</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </div>

          {/* Completed (only for editing) */}
          {isEditing && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="completed"
                checked={completed}
                onChange={(e) => setCompleted(e.target.checked)}
                className="h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500"
              />
              <Label htmlFor="completed" className="cursor-pointer">
                {t("markComplete") || "Mark as completed"}
              </Label>
            </div>
          )}

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
            <Button type="submit" disabled={loading || !title}>
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
