"use client";

import { useState } from "react";
import { Check, ChevronDown, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const nextPhase = currentIdx >= 0 && currentIdx < phases.length - 1 ? phases[currentIdx + 1] : null;

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

  // All phases complete
  if (phaseCompleted) {
    if (readOnly) {
      return (
        <Badge variant="default" className="bg-green-600 hover:bg-green-700">
          <Check className="mr-1 h-3 w-3" />
          {tp("allComplete")}
        </Badge>
      );
    }

    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center gap-1 rounded-full bg-green-600 px-2.5 py-0.5 text-xs font-medium text-white hover:bg-green-700 transition-colors">
              <Check className="h-3 w-3" />
              {tp("allComplete")}
              <ChevronDown className="h-3 w-3 ml-0.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {phases.map((p) => (
              <DropdownMenuItem
                key={p.id}
                disabled={saving}
                onClick={() => setJumpDialog(p)}
              >
                {p.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {jumpDialog && (
          <Dialog open={!!jumpDialog} onOpenChange={() => setJumpDialog(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{tp("jumpToPhase")}</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                {tp("jumpConfirm")
                  .replace("{from}", tp("allComplete"))
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
      </>
    );
  }

  // Current phase display
  const badgeLabel = currentPhase ? currentPhase.name : tp("unassigned");
  const badgeStyle = currentPhase?.color
    ? { backgroundColor: currentPhase.color, color: "#fff" }
    : undefined;
  const badgeClass = currentPhase
    ? currentPhase.color
      ? ""
      : "bg-primary text-primary-foreground"
    : "bg-muted text-muted-foreground";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={readOnly}>
          <button
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${badgeClass} ${!readOnly ? "cursor-pointer hover:opacity-80" : ""}`}
            style={badgeStyle}
          >
            <span className="max-w-[100px] truncate">{badgeLabel}</span>
            {!readOnly && <ChevronDown className="h-3 w-3 ml-0.5 shrink-0" />}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[180px]">
          {phases.map((phase, idx) => {
            const isCompleted = currentIdx >= 0 && idx < currentIdx;
            const isCurrent = phase.id === currentPhaseId;

            return (
              <DropdownMenuItem
                key={phase.id}
                disabled={saving || isCurrent}
                onClick={() => {
                  if (!isCurrent) setJumpDialog(phase);
                }}
                className="flex items-center gap-2"
              >
                {isCompleted ? (
                  <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
                ) : isCurrent ? (
                  <div
                    className={`h-2 w-2 rounded-full shrink-0 ml-0.5 mr-0.5 ${!phase.color ? "bg-primary" : ""}`}
                    style={phase.color ? { backgroundColor: phase.color } : undefined}
                  />
                ) : (
                  <div className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className={isCurrent ? "font-semibold" : ""}>{phase.name}</span>
              </DropdownMenuItem>
            );
          })}
          {currentPhase && !readOnly && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={saving}
                onClick={handleComplete}
                className="flex items-center gap-2"
              >
                <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {nextPhase
                    ? tp("advanceTo").replace("{name}", nextPhase.name)
                    : tp("completePhase")}
                </span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

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
    </>
  );
}
