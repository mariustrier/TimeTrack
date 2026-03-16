"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Layers } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Phase {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
  color: string;
}

const PHASE_COLORS = [
  "#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6",
  "#EC4899", "#06B6D4", "#F97316", "#6366F1", "#14B8A6",
];

export function PhaseSettings() {
  const t = useTranslations("phases");
  const tc = useTranslations("common");

  const [loading, setLoading] = useState(true);
  const [phasesEnabled, setPhasesEnabled] = useState(false);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPhase, setEditingPhase] = useState<Phase | null>(null);
  const [phaseName, setPhaseName] = useState("");
  const [phaseColor, setPhaseColor] = useState("#3B82F6");
  const [applyGlobally, setApplyGlobally] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggleSaving, setToggleSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [ecoRes, phaseRes] = await Promise.all([
          fetch("/api/admin/economic"),
          fetch("/api/admin/phases"),
        ]);
        if (ecoRes.ok) {
          const data = await ecoRes.json();
          setPhasesEnabled(data.phasesEnabled || false);
        }
        if (phaseRes.ok) {
          setPhases(await phaseRes.json());
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  const handleToggle = async () => {
    const newVal = !phasesEnabled;
    setPhasesEnabled(newVal);
    setToggleSaving(true);
    try {
      await fetch("/api/admin/economic", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phasesEnabled: newVal }),
      });
      if (newVal) {
        const res = await fetch("/api/admin/phases");
        if (res.ok) setPhases(await res.json());
      }
    } catch {}
    setToggleSaving(false);
  };

  const handleReorder = async (idx: number, direction: -1 | 1) => {
    const activePhases = phases.filter((p) => p.active);
    const newOrder = [...activePhases];
    const swapIdx = idx + direction;
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    const orderedIds = newOrder.map((p) => p.id);
    const res = await fetch("/api/admin/phases/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds }),
    });
    if (res.ok) {
      setPhases(await res.json());
      toast.success(t("phasesReordered"));
    }
  };

  const handleSave = async () => {
    if (!phaseName.trim()) return;
    setSaving(true);
    try {
      if (editingPhase) {
        const res = await fetch(`/api/admin/phases/${editingPhase.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: phaseName.trim(),
            color: phaseColor,
            applyGlobally,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          toast.error(data.error || tc("failedToUpdate"));
          return;
        }
        toast.success(t("phaseSaved"));
      } else {
        const res = await fetch("/api/admin/phases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: phaseName.trim(), color: phaseColor }),
        });
        if (!res.ok) {
          const data = await res.json();
          toast.error(data.error || tc("failedToSave"));
          return;
        }
        toast.success(t("phaseSaved"));
      }
      setDialogOpen(false);
      const pRes = await fetch("/api/admin/phases");
      if (pRes.ok) setPhases(await pRes.json());
    } catch {
      toast.error(tc("failedToSave"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (phase: Phase) => {
    if (!confirm(t("deletePhaseConfirm").replace("{name}", phase.name))) return;
    const res = await fetch(`/api/admin/phases/${phase.id}`, { method: "DELETE" });
    if (res.ok) {
      const data = await res.json();
      if (data.softDeleted) {
        toast.info(t("phaseDeactivated"));
      } else {
        toast.success(t("phaseDeleted"));
      }
      const pRes = await fetch("/api/admin/phases");
      if (pRes.ok) setPhases(await pRes.json());
    }
  };

  if (loading) return <Skeleton className="h-40" />;

  const activePhases = phases.filter((p) => p.active);

  return (
    <>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <Layers className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <h3 className="text-base font-semibold text-foreground">{t("title")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleToggle}
              disabled={toggleSaving}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                phasesEnabled ? "bg-primary" : "bg-muted-foreground/30"
              )}
            >
              <span className={cn(
                "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                phasesEnabled ? "translate-x-6" : "translate-x-1"
              )} />
            </button>
            <Badge variant={phasesEnabled ? "default" : "secondary"}>
              {phasesEnabled ? t("enabled") : t("disabled")}
            </Badge>
          </div>

          {phasesEnabled && (
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-foreground">{t("title")}</h4>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingPhase(null);
                    setPhaseName("");
                    setPhaseColor("#3B82F6");
                    setApplyGlobally(false);
                    setDialogOpen(true);
                  }}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  {t("addPhase")}
                </Button>
              </div>
              <div className="rounded-lg border">
                {activePhases.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">{t("description")}</p>
                ) : (
                  activePhases.map((phase, idx, arr) => (
                    <div key={phase.id} className={cn("flex items-center justify-between px-4 py-2", idx < arr.length - 1 && "border-b")}>
                      <div className="flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: phase.color || "#3B82F6" }} />
                        <span className="text-xs font-mono text-muted-foreground w-5">{idx + 1}</span>
                        <span className="text-sm font-medium">{phase.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === 0} onClick={() => handleReorder(idx, -1)}>
                          <ChevronUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === arr.length - 1} onClick={() => handleReorder(idx, 1)}>
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                          setEditingPhase(phase);
                          setPhaseName(phase.name);
                          setPhaseColor(phase.color || "#3B82F6");
                          setApplyGlobally(false);
                          setDialogOpen(true);
                        }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(phase)}>
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPhase ? t("editPhase") : t("addPhase")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("phaseName")}</Label>
              <Input
                value={phaseName}
                onChange={(e) => setPhaseName(e.target.value)}
                placeholder={t("phaseNamePlaceholder")}
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("phaseColor")}</Label>
              <div className="flex flex-wrap gap-2">
                {PHASE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setPhaseColor(c)}
                    className={`h-7 w-7 rounded-full border-2 transition-all ${
                      phaseColor === c ? "border-foreground scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            {editingPhase && phaseName.trim() !== editingPhase.name && (
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="phaseApplyGlobally"
                  checked={applyGlobally}
                  onChange={(e) => setApplyGlobally(e.target.checked)}
                  className="mt-1"
                />
                <div>
                  <label htmlFor="phaseApplyGlobally" className="text-sm font-medium">{t("applyGlobally")}</label>
                  <p className="text-xs text-muted-foreground">{t("applyGloballyDesc")}</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{tc("cancel")}</Button>
            <Button disabled={saving || !phaseName.trim()} onClick={handleSave}>
              {saving ? tc("saving") : editingPhase ? tc("update") : tc("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
