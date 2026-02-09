"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations } from "@/lib/i18n";
import { toast } from "sonner";

interface Phase {
  id: string;
  name: string;
  sortOrder: number;
}

interface Project {
  id: string;
  name: string;
  color: string;
  systemManaged?: boolean;
  phasesEnabled: boolean;
  currentPhase: { id: string; name: string } | null;
}

interface PhaseMigrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phases: Phase[];
  projects: Project[];
  onComplete: () => void;
}

export function PhaseMigrationDialog({
  open,
  onOpenChange,
  phases,
  projects,
  onComplete,
}: PhaseMigrationDialogProps) {
  const tp = useTranslations("phases");
  const tc = useTranslations("common");

  // Filter to only non-system-managed projects that don't already have a phase
  const eligibleProjects = projects.filter(
    (p) => !p.systemManaged && !p.currentPhase
  );

  const [assignments, setAssignments] = useState<Record<string, string | null>>(
    () => {
      const initial: Record<string, string | null> = {};
      for (const p of eligibleProjects) {
        initial[p.id] = phases[0]?.id || null;
      }
      return initial;
    }
  );
  const [saving, setSaving] = useState(false);

  function assignAll(phaseId: string | null) {
    const updated: Record<string, string | null> = {};
    for (const p of eligibleProjects) {
      updated[p.id] = phaseId;
    }
    setAssignments(updated);
  }

  async function handleApply() {
    setSaving(true);
    try {
      const payload = {
        assignments: Object.entries(assignments).map(([projectId, phaseId]) => ({
          projectId,
          phaseId,
        })),
      };
      const res = await fetch("/api/admin/phases/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success(tp("migrationApplied"));
        onComplete();
        onOpenChange(false);
      }
    } catch {
      console.error("Failed to apply migration");
    } finally {
      setSaving(false);
    }
  }

  if (eligibleProjects.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tp("migration")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{tp("migrationDesc")}</p>

        <div className="flex gap-2 my-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => assignAll(phases[0]?.id || null)}
          >
            {tp("assignAll")} → {phases[0]?.name}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => assignAll(null)}
          >
            {tp("setNoPhases")}
          </Button>
        </div>

        <div className="space-y-3">
          {eligibleProjects.map((project) => (
            <div key={project.id} className="flex items-center gap-3">
              <div className="flex items-center gap-2 min-w-[140px]">
                <div
                  className="h-3 w-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: project.color }}
                />
                <span className="text-sm font-medium truncate">
                  {project.name}
                </span>
              </div>
              <Select
                value={assignments[project.id] ?? "__none__"}
                onValueChange={(val) =>
                  setAssignments((prev) => ({
                    ...prev,
                    [project.id]: val === "__none__" ? null : val,
                  }))
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{tp("noPhases")}</SelectItem>
                  {phases.map((phase) => (
                    <SelectItem key={phase.id} value={phase.id}>
                      {phase.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button onClick={handleApply} disabled={saving}>
            {saving ? tc("saving") : tc("apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
