"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  Pencil,
  Undo2,
  Redo2,
  ChevronUp,
  ChevronDown,
  Save,
  X,
} from "lucide-react";

interface TimelineEditFooterProps {
  changeCount: number;
  canUndo: boolean;
  canRedo: boolean;
  changes: Array<{ id: string; label: string; type: string }>;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => Promise<void>;
  onDiscard: () => void;
}

export function TimelineEditFooter({
  changeCount,
  canUndo,
  canRedo,
  changes,
  onUndo,
  onRedo,
  onSave,
  onDiscard,
}: TimelineEditFooterProps) {
  const t = useTranslations("timeline");

  const [reviewOpen, setReviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [discardConfirm, setDiscardConfirm] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  }, [onSave]);

  const handleDiscard = useCallback(() => {
    if (!discardConfirm) {
      setDiscardConfirm(true);
      return;
    }
    setDiscardConfirm(false);
    onDiscard();
  }, [discardConfirm, onDiscard]);

  const handleDiscardBlur = useCallback(() => {
    // Reset confirmation state when button loses focus
    setTimeout(() => setDiscardConfirm(false), 200);
  }, []);

  const hasChanges = changeCount > 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 transform translate-y-0">
      {/* Review Changes Panel */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300",
          reviewOpen && hasChanges ? "max-h-[200px]" : "max-h-0"
        )}
      >
        <div className="bg-white dark:bg-gray-900 border-t border-amber-200 dark:border-amber-800 max-h-[200px] overflow-y-auto">
          <div className="px-4 py-3">
            <ul className="space-y-1 text-sm text-foreground">
              {changes.map((change) => (
                <li key={change.id} className="flex items-start gap-2">
                  <span className="text-amber-500 mt-1 shrink-0">&#8226;</span>
                  <span>{change.label}</span>
                </li>
              ))}
              {changes.length === 0 && (
                <li className="text-muted-foreground italic">
                  {t("noChanges") || "No changes yet"}
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Footer Bar */}
      <div className="bg-amber-50 dark:bg-amber-950/80 border-t border-amber-200 dark:border-amber-800 backdrop-blur px-4 py-2">
        <div className="flex items-center justify-between gap-4">
          {/* Left side: change count */}
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <Pencil className="h-4 w-4" />
            <span className="text-sm font-medium">
              {t("nChanges", { count: changeCount }) ||
                `${changeCount} changes`}
            </span>
          </div>

          {/* Right side: action buttons */}
          <div className="flex items-center gap-1.5">
            {/* Undo / Redo */}
            <Button
              variant="ghost"
              size="icon"
              disabled={!canUndo}
              onClick={onUndo}
              title={t("undoAction") || "Undo"}
              className="h-9 w-9"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={!canRedo}
              onClick={onRedo}
              title={t("redoAction") || "Redo"}
              className="h-9 w-9"
            >
              <Redo2 className="h-4 w-4" />
            </Button>

            {/* Separator */}
            <div className="w-px h-6 bg-amber-200 dark:bg-amber-800 mx-1" />

            {/* Review Changes */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReviewOpen(!reviewOpen)}
              disabled={!hasChanges}
              className="gap-1.5"
            >
              {reviewOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
              {t("reviewChanges") || "Review Changes"}
            </Button>

            {/* Discard */}
            <Button
              variant="outline"
              size="sm"
              disabled={!hasChanges || saving}
              onClick={handleDiscard}
              onBlur={handleDiscardBlur}
              className={cn(
                "gap-1.5",
                discardConfirm &&
                  "border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-700 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900"
              )}
            >
              <X className="h-4 w-4" />
              {discardConfirm
                ? t("discardConfirm") || "Sure?"
                : t("discardChanges") || "Discard"}
            </Button>

            {/* Save */}
            <Button
              size="sm"
              disabled={!hasChanges || saving}
              onClick={handleSave}
              className="gap-1.5 bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500"
            >
              <Save className="h-4 w-4" />
              {saving
                ? t("saving") || "Saving..."
                : t("saveChanges") || "Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
