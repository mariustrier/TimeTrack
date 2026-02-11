"use client";

import { useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useTranslations } from "@/lib/i18n";
import { toast } from "sonner";

interface Phase {
  id: string;
  name: string;
  sortOrder: number;
  color?: string;
}

interface PhaseProgressProps {
  phases: Phase[];
  currentPhaseId: string | null;
  phaseCompleted: boolean;
  projectId: string;
  onPhaseChange: () => void;
  readOnly?: boolean;
}

export function PhaseProgress({
  phases,
  currentPhaseId,
  phaseCompleted,
  projectId,
  onPhaseChange,
  readOnly = false,
}: PhaseProgressProps) {
  const tp = useTranslations("phases");
  const tc = useTranslations("common");
  const [saving, setSaving] = useState(false);
  const [jumpDialog, setJumpDialog] = useState<Phase | null>(null);
  const [archiveDialog, setArchiveDialog] = useState(false);

  const currentIdx = phases.findIndex((p) => p.id === currentPhaseId);
  const currentPhase = currentIdx >= 0 ? phases[currentIdx] : null;

  async function handleComplete() {
    const isLast = currentIdx === phases.length - 1;
    if (isLast) {
      setArchiveDialog(true);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/phase`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });
      if (res.ok) {
        toast.success(tp("phaseCompleted"));
        onPhaseChange();
      }
    } catch {
      console.error("Failed to complete phase");
    } finally {
      setSaving(false);
    }
  }

  async function handleCompleteFinal(shouldArchive: boolean) {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/phase`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });
      if (res.ok) {
        toast.success(tp("projectCompleted"));
        if (shouldArchive) {
          const archiveRes = await fetch(`/api/projects/${projectId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ archived: true }),
          });
          if (archiveRes.ok) {
            toast.success(tp("projectArchivedOnComplete"));
          }
        }
        onPhaseChange();
      }
    } catch {
      console.error("Failed to complete final phase");
    } finally {
      setSaving(false);
      setArchiveDialog(false);
    }
  }

  async function handleJump(phase: Phase) {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/phase`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setPhase", phaseId: phase.id }),
      });
      if (res.ok) {
        toast.success(tp("phaseChanged"));
        onPhaseChange();
      }
    } catch {
      console.error("Failed to change phase");
    } finally {
      setSaving(false);
      setJumpDialog(null);
    }
  }

  if (phaseCompleted) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="default" className="bg-green-600 hover:bg-green-700">
          <Check className="mr-1 h-3 w-3" />
          {tp("allComplete")}
        </Badge>
        {!readOnly && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={() => setJumpDialog(phases[0])}
          >
            {tp("jumpToPhase")}
          </Button>
        )}

        {jumpDialog && (
          <Dialog open={!!jumpDialog} onOpenChange={() => setJumpDialog(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{tp("jumpToPhase")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 py-2">
                {phases.map((p) => (
                  <Button
                    key={p.id}
                    variant="outline"
                    className="w-full justify-start"
                    disabled={saving}
                    onClick={() => handleJump(p)}
                  >
                    {p.name}
                  </Button>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setJumpDialog(null)}>
                  {tc("cancel")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {phases.map((phase, idx) => {
        const isCompleted = currentIdx >= 0 && idx < currentIdx;
        const isCurrent = phase.id === currentPhaseId;
        const isFuture = currentIdx >= 0 && idx > currentIdx;

        return (
          <div key={phase.id} className="flex items-center">
            {idx > 0 && (
              <ChevronRight className="h-3 w-3 mx-0.5 text-muted-foreground/50" />
            )}
            <button
              disabled={readOnly || saving || isCurrent}
              onClick={() => {
                if (!readOnly && !isCurrent) setJumpDialog(phase);
              }}
              className={`
                inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors
                ${isFuture ? "bg-muted text-muted-foreground" : ""}
                ${!phase.color && isCompleted ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : ""}
                ${!phase.color && isCurrent ? "bg-primary text-primary-foreground" : ""}
                ${!readOnly && !isCurrent ? "cursor-pointer hover:opacity-80" : ""}
              `}
              style={phase.color && !isFuture ? {
                backgroundColor: isCompleted ? `${phase.color}20` : isCurrent ? phase.color : undefined,
                color: isCompleted ? phase.color : isCurrent ? "#fff" : undefined,
              } : undefined}
              title={phase.name}
            >
              {isCompleted && <Check className="h-3 w-3" />}
              <span className="max-w-[80px] truncate">{phase.name}</span>
            </button>
          </div>
        );
      })}

      {!readOnly && currentPhase && (
        <Button
          variant="ghost"
          size="sm"
          className="ml-1 h-6 px-2 text-xs"
          disabled={saving}
          onClick={handleComplete}
        >
          <Check className="mr-1 h-3 w-3" />
          {tp("completePhase")}
        </Button>
      )}

      {jumpDialog && (
        <Dialog open={!!jumpDialog} onOpenChange={() => setJumpDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{tp("jumpToPhase")}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {tp("jumpConfirm")
                .replace("{from}", currentPhase?.name || "")
                .replace("{to}", jumpDialog.name)}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setJumpDialog(null)}>
                {tc("cancel")}
              </Button>
              <Button disabled={saving} onClick={() => handleJump(jumpDialog)}>
                {tc("confirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {archiveDialog && (
        <Dialog open={archiveDialog} onOpenChange={setArchiveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{tp("finalPhaseTitle")}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {tp("finalPhaseDescription")}
            </p>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => handleCompleteFinal(false)}
              >
                {tp("completeOnly")}
              </Button>
              <Button
                disabled={saving}
                onClick={() => handleCompleteFinal(true)}
              >
                {tp("completeAndArchive")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
