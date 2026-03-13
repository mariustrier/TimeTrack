"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowRight,
  ArrowLeft,
  Upload,
  FileUp,
  Loader2,
  Trash2,
  Plus,
  Check,
  GripVertical,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "@/lib/i18n";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TilbudDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmed?: () => void;
}

interface ExtractedTask {
  id: string;
  name: string;
  hours: number;
  isTimeloen: boolean;
  timeloenEstimate: string;
  sortOrder: number;
}

interface ExtractedPhase {
  id: string;
  name: string;
  faseNumber: number;
  tasks: ExtractedTask[];
}

interface ExtractionResult {
  phases: ExtractedPhase[];
  hourlyRate: number;
  confidence: number;
  currency: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _idCounter = 0;
function tempId(): string {
  _idCounter += 1;
  return `tmp_${Date.now()}_${_idCounter}`;
}

function calcPhaseSubtotal(phase: ExtractedPhase): number {
  return phase.tasks.reduce((sum, t) => sum + (t.isTimeloen ? 0 : t.hours), 0);
}

function calcGrandTotalHours(phases: ExtractedPhase[]): number {
  return phases.reduce(
    (sum, p) => sum + p.tasks.reduce((s, t) => s + (t.isTimeloen ? 0 : t.hours), 0),
    0,
  );
}

function formatDKK(amount: number): string {
  return amount.toLocaleString("da-DK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TilbudDialog({
  projectId,
  open,
  onOpenChange,
  onConfirmed,
}: TilbudDialogProps) {
  const t = useTranslations("tilbud");

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1 — Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confidence, setConfidence] = useState<number | null>(null);

  // Step 2 — Review & Edit
  const [tilbudId, setTilbudId] = useState<string | null>(null);
  const [phases, setPhases] = useState<ExtractedPhase[]>([]);
  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const [currency, setCurrency] = useState("DKK");

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep(1);
      setSelectedFile(null);
      setDragActive(false);
      setUploading(false);
      setConfidence(null);
      setTilbudId(null);
      setPhases([]);
      setHourlyRate(0);
      setCurrency("DKK");
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open]);

  // ---- Step 1: Upload & Extract ----

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const valid = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    if (!valid.includes(file.type) && !file.name.match(/\.(pdf|xlsx|xls)$/i)) {
      toast.error(t("invalidFileType"));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t("fileTooLarge"));
      return;
    }
    setSelectedFile(file);
  }, [t]);

  const handleFileSelect = useCallback(() => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t("fileTooLarge"));
      return;
    }
    setSelectedFile(file);
  }, [t]);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch(`/api/projects/${projectId}/tilbud`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t("uploadFailed"));
        return;
      }

      const data = await res.json();
      const extraction = data.extraction;
      if (!extraction || !extraction.phases) {
        toast.error(t("uploadFailed"));
        return;
      }
      setTilbudId(data.tilbud?.id ?? null);
      // Transform extraction format to component format
      const mappedPhases: ExtractedPhase[] = extraction.phases.map(
        (p: { faseNumber: number; name: string; tasks?: { name: string; quotedHours?: number; isTimeloen?: boolean; timeloenEstimate?: string }[] }, pIdx: number) => ({
          id: tempId(),
          name: p.name || "",
          faseNumber: p.faseNumber ?? pIdx + 1,
          tasks: (p.tasks || []).map(
            (tk: { name: string; quotedHours?: number; isTimeloen?: boolean; timeloenEstimate?: string }, tIdx: number) => ({
              id: tempId(),
              name: tk.name || "",
              hours: tk.quotedHours ?? 0,
              isTimeloen: tk.isTimeloen ?? false,
              timeloenEstimate: tk.timeloenEstimate ?? "",
              sortOrder: tIdx + 1,
            })
          ),
        })
      );
      setPhases(mappedPhases);
      setHourlyRate(extraction.hourlyRate ?? 0);
      setCurrency("DKK");
      setConfidence(extraction.confidence ?? null);
      setStep(2);
    } catch {
      toast.error(t("uploadFailed"));
    } finally {
      setUploading(false);
    }
  }, [selectedFile, projectId, t]);

  // ---- Step 2: Review & Edit helpers ----

  const updateTaskField = useCallback(
    (phaseId: string, taskId: string, field: keyof ExtractedTask, value: string | number | boolean) => {
      setPhases((prev) =>
        prev.map((p) =>
          p.id !== phaseId
            ? p
            : {
                ...p,
                tasks: p.tasks.map((tk) =>
                  tk.id !== taskId ? tk : { ...tk, [field]: value },
                ),
              },
        ),
      );
    },
    [],
  );

  const removeTask = useCallback((phaseId: string, taskId: string) => {
    setPhases((prev) =>
      prev.map((p) =>
        p.id !== phaseId
          ? p
          : { ...p, tasks: p.tasks.filter((tk) => tk.id !== taskId) },
      ),
    );
  }, []);

  const addTask = useCallback((phaseId: string) => {
    setPhases((prev) =>
      prev.map((p) => {
        if (p.id !== phaseId) return p;
        const maxOrder = p.tasks.reduce((m, tk) => Math.max(m, tk.sortOrder), 0);
        return {
          ...p,
          tasks: [
            ...p.tasks,
            {
              id: tempId(),
              name: "",
              hours: 0,
              isTimeloen: false,
              timeloenEstimate: "",
              sortOrder: maxOrder + 1,
            },
          ],
        };
      }),
    );
  }, []);

  const addPhase = useCallback(() => {
    const maxNum = phases.reduce((m, p) => Math.max(m, p.faseNumber), 0);
    setPhases((prev) => [
      ...prev,
      {
        id: tempId(),
        name: "",
        faseNumber: maxNum + 1,
        tasks: [],
      },
    ]);
  }, [phases]);

  const removePhase = useCallback((phaseId: string) => {
    setPhases((prev) => prev.filter((p) => p.id !== phaseId));
  }, []);

  const moveTask = useCallback(
    (phaseId: string, taskId: string, direction: "up" | "down") => {
      setPhases((prev) =>
        prev.map((p) => {
          if (p.id !== phaseId) return p;
          const tasks = [...p.tasks].sort((a, b) => a.sortOrder - b.sortOrder);
          const idx = tasks.findIndex((tk) => tk.id === taskId);
          if (idx < 0) return p;
          const swapIdx = direction === "up" ? idx - 1 : idx + 1;
          if (swapIdx < 0 || swapIdx >= tasks.length) return p;
          const tmpOrder = tasks[idx].sortOrder;
          tasks[idx] = { ...tasks[idx], sortOrder: tasks[swapIdx].sortOrder };
          tasks[swapIdx] = { ...tasks[swapIdx], sortOrder: tmpOrder };
          return { ...p, tasks };
        }),
      );
    },
    [],
  );

  // ---- Step 3: Confirm ----

  const handleConfirm = useCallback(async () => {
    if (!tilbudId) {
      toast.error(t("confirmFailed"));
      return;
    }
    setLoading(true);
    try {
      // Transform component phases to API categories format
      const categories = phases.map((phase, pIdx) => ({
        faseNumber: phase.faseNumber,
        name: phase.name || `Phase ${phase.faseNumber}`,
        quotedHours: calcPhaseSubtotal(phase),
        isTimeloen: false,
        sortOrder: pIdx + 1,
        children: phase.tasks
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((task, tIdx) => ({
            name: task.name || t("unnamedTask"),
            quotedHours: task.isTimeloen ? undefined : task.hours,
            isTimeloen: task.isTimeloen,
            timeloenEstimate: task.timeloenEstimate || undefined,
            sortOrder: tIdx + 1,
          })),
      }));
      const res = await fetch(`/api/projects/${projectId}/tilbud`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tilbudId, hourlyRate, categories }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t("confirmFailed"));
        return;
      }

      toast.success(t("tilbudConfirmed"));
      onOpenChange(false);
      onConfirmed?.();
    } catch {
      toast.error(t("confirmFailed"));
    } finally {
      setLoading(false);
    }
  }, [projectId, tilbudId, phases, hourlyRate, t, onOpenChange, onConfirmed]);

  // ---- Computed totals ----

  const grandTotalHours = calcGrandTotalHours(phases);
  const grandTotalAmount = grandTotalHours * hourlyRate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("tilbudDialogTitle")}</DialogTitle>
        </DialogHeader>

        {/* Step Indicators */}
        <div className="flex items-center gap-2 text-sm">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  step >= s
                    ? "bg-brand-500 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s ? <Check className="h-3.5 w-3.5" /> : s}
              </div>
              <span
                className={
                  step >= s ? "text-foreground" : "text-muted-foreground"
                }
              >
                {s === 1
                  ? t("stepUpload")
                  : s === 2
                    ? t("stepReview")
                    : t("stepConfirm")}
              </span>
              {s < 3 && (
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Drop zone */}
            <div
              className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                dragActive
                  ? "border-brand-500 bg-brand-50"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm font-medium">
                {selectedFile ? selectedFile.name : t("dropFileHere")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("acceptedFormats")} &middot; {t("maxSize")}
              </p>
              <label
                htmlFor="tilbud-file-input"
                className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <FileUp className="h-4 w-4" />
                {t("selectFile")}
              </label>
              <input
                ref={fileInputRef}
                id="tilbud-file-input"
                type="file"
                accept=".pdf,.xlsx,.xls"
                className="sr-only"
                onChange={handleFileSelect}
              />
            </div>

            {/* Confidence badge (after extraction completes and goes to step 2, but shown if user navigates back) */}
            {confidence != null && (
              <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
                <span className="text-muted-foreground">{t("extractionConfidence")}:</span>
                <span
                  className={`font-semibold ${
                    confidence >= 0.8
                      ? "text-green-600"
                      : confidence >= 0.5
                        ? "text-amber-600"
                        : "text-red-600"
                  }`}
                >
                  {Math.round(confidence * 100)}%
                </span>
              </div>
            )}

            {/* Upload progress */}
            {uploading && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("extracting")}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Review & Edit */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Hourly rate */}
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <Label>{t("hourlyRate")}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(Number(e.target.value))}
                    className="w-32"
                    min={0}
                    step={1}
                  />
                  <span className="text-sm text-muted-foreground">
                    {currency}/{t("hourAbbrev")}
                  </span>
                </div>
              </div>
              {confidence != null && (
                <div className="text-xs text-muted-foreground">
                  {t("extractionConfidence")}: {Math.round(confidence * 100)}%
                </div>
              )}
            </div>

            {/* Phases and tasks */}
            {phases.map((phase) => (
              <div key={phase.id} className="rounded-lg border">
                {/* Phase header */}
                <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground">
                      Fase {phase.faseNumber}
                    </span>
                    <Input
                      value={phase.name}
                      onChange={(e) =>
                        setPhases((prev) =>
                          prev.map((p) =>
                            p.id === phase.id ? { ...p, name: e.target.value } : p,
                          ),
                        )
                      }
                      className="h-7 w-48 text-sm font-semibold"
                      placeholder={t("phaseName")}
                    />
                    <span className="text-xs text-muted-foreground">
                      {calcPhaseSubtotal(phase).toFixed(1)}t
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => addTask(phase.id)}
                      className="h-7 text-xs"
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      {t("addTask")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      onClick={() => removePhase(phase.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Task table */}
                {phase.tasks.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8" />
                        <TableHead className="w-[40%]">{t("taskName")}</TableHead>
                        <TableHead className="text-right w-24">{t("hours")}</TableHead>
                        <TableHead className="text-center w-24">{t("timeloen")}</TableHead>
                        <TableHead className="w-16" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...phase.tasks]
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                        .map((task) => (
                          <TableRow key={task.id}>
                            <TableCell className="px-1">
                              <div className="flex flex-col">
                                <button
                                  className="text-muted-foreground hover:text-foreground p-0.5"
                                  onClick={() => moveTask(phase.id, task.id, "up")}
                                >
                                  <ChevronUp className="h-3 w-3" />
                                </button>
                                <button
                                  className="text-muted-foreground hover:text-foreground p-0.5"
                                  onClick={() => moveTask(phase.id, task.id, "down")}
                                >
                                  <ChevronDown className="h-3 w-3" />
                                </button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Input
                                value={task.name}
                                onChange={(e) =>
                                  updateTaskField(phase.id, task.id, "name", e.target.value)
                                }
                                className="h-8"
                                placeholder={t("taskNamePlaceholder")}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                value={task.hours}
                                onChange={(e) =>
                                  updateTaskField(
                                    phase.id,
                                    task.id,
                                    "hours",
                                    Number(e.target.value),
                                  )
                                }
                                className="h-8 w-20 text-right ml-auto"
                                min={0}
                                step={0.5}
                                disabled={task.isTimeloen}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <label className="flex items-center justify-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={task.isTimeloen}
                                  onChange={(e) =>
                                    updateTaskField(
                                      phase.id,
                                      task.id,
                                      "isTimeloen",
                                      e.target.checked,
                                    )
                                  }
                                  className="h-4 w-4 rounded border-input accent-brand-500"
                                />
                              </label>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeTask(phase.id, task.id)}
                                className="h-7 w-7 p-0"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                )}

                {phase.tasks.length === 0 && (
                  <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                    {t("noTasks")}
                  </div>
                )}
              </div>
            ))}

            {/* Add phase button */}
            <Button variant="outline" size="sm" onClick={addPhase}>
              <Plus className="mr-1 h-4 w-4" />
              {t("addPhase")}
            </Button>

            {/* Running total */}
            <div className="border-t pt-3 text-sm">
              <div className="flex justify-between font-bold text-base">
                <span>{t("grandTotal")}</span>
                <span>
                  {grandTotalHours.toFixed(1)} {t("hoursAbbrev")} &middot;{" "}
                  {formatDKK(grandTotalAmount)} {currency} ex moms
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-lg border p-4 bg-muted/50">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                {t("tilbudSummary")}
              </p>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("hourlyRate")}</span>
                <span className="font-medium">
                  {hourlyRate.toLocaleString("da-DK")} {currency}/{t("hourAbbrev")}
                </span>
              </div>

              {phases.map((phase) => (
                <div key={phase.id} className="mt-3">
                  <div className="flex justify-between text-sm font-semibold">
                    <span>
                      Fase {phase.faseNumber} — {phase.name || t("unnamed")}
                    </span>
                    <span>{calcPhaseSubtotal(phase).toFixed(1)}t</span>
                  </div>
                  {phase.tasks
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((task) => (
                      <div
                        key={task.id}
                        className="flex justify-between text-xs text-muted-foreground ml-4 mt-0.5"
                      >
                        <span style={task.isTimeloen ? { fontStyle: "italic" } : undefined}>
                          {task.name || t("unnamedTask")}{" "}
                          {task.isTimeloen && (
                            <span className="text-indigo-500">({t("timeloen")})</span>
                          )}
                        </span>
                        <span>
                          {task.isTimeloen ? t("timeloen") : `${task.hours.toFixed(1)}t`}
                        </span>
                      </div>
                    ))}
                </div>
              ))}

              <div className="flex justify-between font-bold mt-4 pt-3 border-t text-base">
                <span>{t("grandTotal")}</span>
                <span>
                  {grandTotalHours.toFixed(1)} {t("hoursAbbrev")} &middot;{" "}
                  {formatDKK(grandTotalAmount)} {currency} ex moms
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Footer navigation */}
        <DialogFooter className="flex justify-between">
          <div>
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("back")}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            {step === 1 && (
              <Button
                onClick={handleUpload}
                disabled={uploading || !selectedFile}
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("extracting")}
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    {t("uploadAndExtract")}
                  </>
                )}
              </Button>
            )}
            {step === 2 && (
              <Button
                onClick={() => setStep(3)}
                disabled={phases.length === 0}
              >
                {t("next")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
            {step === 3 && (
              <Button onClick={handleConfirm} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("confirming")}
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    {t("confirmTilbud")}
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
