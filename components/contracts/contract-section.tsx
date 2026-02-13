"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Upload,
  FileText,
  Trash2,
  Sparkles,
  Loader2,
  FileUp,
  Clock,
  DollarSign,
  CalendarDays,
  BookOpen,
  Tag,
  ShieldX,
  AlertTriangle,
  Save,
  PenLine,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useTranslations } from "@/lib/i18n";
import { toast } from "sonner";

interface ContractSectionProps {
  projectId: string;
  userRole: string;
}

interface Contract {
  id: string;
  projectId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  extractedTerms: Record<string, unknown> | null;
  extractedAt: string | null;
  maxHours: number | null;
  maxBudget: number | null;
  budgetCurrency: string | null;
  deadline: string | null;
  scopeDescription: string | null;
  scopeKeywords: string[];
  exclusions: string[];
  scopeAdditions: string | null;
  uploadedById: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  uploadedBy: {
    firstName: string;
    lastName: string;
  };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

export function ContractSection({ projectId, userRole }: ContractSectionProps) {
  const t = useTranslations("contracts");
  const tc = useTranslations("common");

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scanned PDF dialog state
  const [scannedDialogOpen, setScannedDialogOpen] = useState(false);
  const [scannedContractId, setScannedContractId] = useState<string | null>(null);

  // Manual entry state
  const [manualEntryId, setManualEntryId] = useState<string | null>(null);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualForm, setManualForm] = useState({
    maxHours: "",
    maxBudget: "",
    budgetCurrency: "DKK",
    deadline: "",
    scopeDescription: "",
    scopeKeywords: "",
    exclusions: "",
  });

  // Scope additions state
  const [editingAdditionsId, setEditingAdditionsId] = useState<string | null>(null);
  const [scopeAdditionsText, setScopeAdditionsText] = useState("");
  const [savingAdditions, setSavingAdditions] = useState(false);

  const fetchContracts = useCallback(async () => {
    try {
      const res = await fetch(`/api/contracts/${projectId}`);
      if (!res.ok) return;
      const data = await res.json();
      setContracts(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId);
      if (notes.trim()) {
        formData.append("notes", notes.trim());
      }

      const res = await fetch("/api/contracts/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) return;

      const uploaded: Contract = await res.json();

      // Reset form
      setNotes("");
      setSelectedFileName(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // Refresh contracts list
      await fetchContracts();

      // Auto-trigger extraction
      handleExtract(uploaded.id);
    } finally {
      setUploading(false);
    }
  };

  const handleExtract = async (contractId: string, skipAnonymization = false) => {
    setExtractingId(contractId);
    try {
      const res = await fetch("/api/contracts/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId, skipAnonymization }),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        toast.error(`${t("extractFailed")} (${res.status})`);
        return;
      }

      if (!res.ok) {
        toast.error(data?.error || `${t("extractFailed")} (${res.status})`);
        return;
      }

      // Check if scanned PDF was detected
      if (data && data.scannedPdf) {
        setScannedContractId(contractId);
        setScannedDialogOpen(true);
        return;
      }

      if (!data) {
        toast.error(t("extractFailed"));
        return;
      }

      toast.success(t("extractSuccess"));
      await fetchContracts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("extractFailed"));
    } finally {
      setExtractingId(null);
    }
  };

  const handleScannedProceed = async () => {
    setScannedDialogOpen(false);
    if (scannedContractId) {
      await handleExtract(scannedContractId, true);
    }
    setScannedContractId(null);
  };

  const handleScannedManual = () => {
    setScannedDialogOpen(false);
    if (scannedContractId) {
      setManualEntryId(scannedContractId);
      setManualForm({
        maxHours: "",
        maxBudget: "",
        budgetCurrency: "DKK",
        deadline: "",
        scopeDescription: "",
        scopeKeywords: "",
        exclusions: "",
      });
    }
    setScannedContractId(null);
  };

  const handleManualSave = async () => {
    if (!manualEntryId) return;
    setManualSaving(true);
    try {
      const res = await fetch(`/api/contracts/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId: manualEntryId,
          maxHours: manualForm.maxHours || null,
          maxBudget: manualForm.maxBudget || null,
          budgetCurrency: manualForm.budgetCurrency || null,
          deadline: manualForm.deadline || null,
          scopeDescription: manualForm.scopeDescription || null,
          scopeKeywords: manualForm.scopeKeywords
            ? manualForm.scopeKeywords.split(",").map((k) => k.trim()).filter(Boolean)
            : [],
          exclusions: manualForm.exclusions
            ? manualForm.exclusions.split(",").map((e) => e.trim()).filter(Boolean)
            : [],
        }),
      });

      if (res.ok) {
        toast.success(t("termsSaved"));
        setManualEntryId(null);
        await fetchContracts();
      }
    } finally {
      setManualSaving(false);
    }
  };

  const handleSaveAdditions = async (contractId: string) => {
    setSavingAdditions(true);
    try {
      const res = await fetch(`/api/contracts/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId,
          scopeAdditions: scopeAdditionsText || null,
        }),
      });

      if (res.ok) {
        toast.success(t("additionsSaved"));
        setEditingAdditionsId(null);
        await fetchContracts();
      }
    } finally {
      setSavingAdditions(false);
    }
  };

  const handleDelete = async (contractId: string) => {
    if (!window.confirm(t("deleteConfirm"))) return;

    try {
      const res = await fetch(
        `/api/contracts/${projectId}?contractId=${contractId}`,
        { method: "DELETE" }
      );

      if (!res.ok) return;

      setContracts((prev) => prev.filter((c) => c.id !== contractId));
    } catch {
      // silently fail
    }
  };

  const hasExtractedTerms = (contract: Contract) =>
    contract.extractedAt !== null;

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t("title")}</h3>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">{t("title")}</h3>

      {/* Upload Form */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="contract-file"
                className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <FileUp className="h-4 w-4" />
                {selectedFileName ?? t("upload")}
              </label>
              <input
                ref={fileInputRef}
                id="contract-file"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="sr-only"
                onChange={() => {
                  setSelectedFileName(fileInputRef.current?.files?.[0]?.name ?? null);
                }}
              />
              <p className="text-xs text-muted-foreground">{t("fileTypes")}</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="contract-notes" className="text-sm font-medium">
                {t("notes")}
              </label>
              <Textarea
                id="contract-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("notesPlaceholder")}
                rows={2}
              />
            </div>

            <Button
              onClick={handleUpload}
              disabled={uploading || !selectedFileName}
              size="sm"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("uploading")}
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  {t("upload")}
                </>
              )}
            </Button>
            {uploading && (
              <p className="text-xs text-muted-foreground animate-pulse">
                {t("encryptingMessage")}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Empty State */}
      {contracts.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            {t("noContracts")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            {t("noContractsDescription")}
          </p>
        </div>
      )}

      {/* Contract List */}
      {contracts.length > 0 && (
        <div className="space-y-4">
          {contracts.map((contract) => (
            <Card key={contract.id}>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {/* Contract Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <FileText className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {contract.fileName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(contract.fileSize)}
                          {" \u00b7 "}
                          {new Date(contract.createdAt).toLocaleDateString()}
                          {" \u00b7 "}
                          {contract.uploadedBy.firstName}{" "}
                          {contract.uploadedBy.lastName}
                        </p>
                        {contract.notes && (
                          <p className="mt-1 text-xs text-muted-foreground italic">
                            {contract.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExtract(contract.id)}
                        disabled={extractingId === contract.id}
                      >
                        {extractingId === contract.id ? (
                          <>
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            {t("extracting")}
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-3.5 w-3.5" />
                            {hasExtractedTerms(contract)
                              ? t("reExtract")
                              : t("extract")}
                          </>
                        )}
                      </Button>

                      {!hasExtractedTerms(contract) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setManualEntryId(contract.id);
                            setManualForm({
                              maxHours: "",
                              maxBudget: "",
                              budgetCurrency: "DKK",
                              deadline: "",
                              scopeDescription: "",
                              scopeKeywords: "",
                              exclusions: "",
                            });
                          }}
                        >
                          <PenLine className="mr-2 h-3.5 w-3.5" />
                          {t("enterManually")}
                        </Button>
                      )}

                      {userRole === "admin" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleDelete(contract.id)}
                          title={t("deleteContract")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Extracting message */}
                  {extractingId === contract.id && (
                    <p className="text-xs text-muted-foreground animate-pulse">
                      {t("encryptingMessage")}
                    </p>
                  )}

                  {/* Manual Entry Form */}
                  {manualEntryId === contract.id && (
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("manualEntry")}
                      </p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs">{t("maxHours")}</Label>
                          <Input
                            type="number"
                            value={manualForm.maxHours}
                            onChange={(e) => setManualForm((f) => ({ ...f, maxHours: e.target.value }))}
                            placeholder="e.g. 500"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{t("maxBudget")}</Label>
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              value={manualForm.maxBudget}
                              onChange={(e) => setManualForm((f) => ({ ...f, maxBudget: e.target.value }))}
                              placeholder="e.g. 50000"
                              className="flex-1"
                            />
                            <select
                              className="rounded-md border border-input bg-background px-2 text-sm"
                              value={manualForm.budgetCurrency}
                              onChange={(e) => setManualForm((f) => ({ ...f, budgetCurrency: e.target.value }))}
                            >
                              <option>DKK</option>
                              <option>USD</option>
                              <option>EUR</option>
                              <option>GBP</option>
                              <option>SEK</option>
                              <option>NOK</option>
                            </select>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{t("deadline")}</Label>
                          <Input
                            type="date"
                            value={manualForm.deadline}
                            onChange={(e) => setManualForm((f) => ({ ...f, deadline: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1 col-span-full">
                          <Label className="text-xs">{t("scope")}</Label>
                          <Textarea
                            value={manualForm.scopeDescription}
                            onChange={(e) => setManualForm((f) => ({ ...f, scopeDescription: e.target.value }))}
                            placeholder={t("scopePlaceholder")}
                            rows={2}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{t("keywords")}</Label>
                          <Input
                            value={manualForm.scopeKeywords}
                            onChange={(e) => setManualForm((f) => ({ ...f, scopeKeywords: e.target.value }))}
                            placeholder={t("keywordsPlaceholder")}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{t("exclusions")}</Label>
                          <Input
                            value={manualForm.exclusions}
                            onChange={(e) => setManualForm((f) => ({ ...f, exclusions: e.target.value }))}
                            placeholder={t("exclusionsPlaceholder")}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" onClick={handleManualSave} disabled={manualSaving}>
                          {manualSaving ? (
                            <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />{t("saving")}</>
                          ) : (
                            <><Save className="mr-2 h-3.5 w-3.5" />{t("save")}</>
                          )}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setManualEntryId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Extracted Terms */}
                  {hasExtractedTerms(contract) && (
                    <div className="rounded-lg border bg-muted/30 p-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("extractedTerms")}
                      </p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {contract.maxHours != null && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {t("maxHours")}:
                            </span>
                            <span className="text-sm font-medium">
                              {contract.maxHours}{tc("hourAbbrev")}
                            </span>
                          </div>
                        )}

                        {contract.maxBudget != null && (
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {t("maxBudget")}:
                            </span>
                            <span className="text-sm font-medium">
                              {contract.budgetCurrency
                                ? `${contract.maxBudget.toLocaleString()} ${contract.budgetCurrency}`
                                : contract.maxBudget.toLocaleString()}
                            </span>
                          </div>
                        )}

                        {contract.deadline && (
                          <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {t("deadline")}:
                            </span>
                            <span className="text-sm font-medium">
                              {new Date(
                                contract.deadline
                              ).toLocaleDateString()}
                            </span>
                          </div>
                        )}

                        {contract.scopeDescription && (
                          <div className="col-span-full flex items-start gap-2">
                            <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            <div>
                              <span className="text-xs text-muted-foreground">
                                {t("scope")}:
                              </span>
                              <p className="text-sm">
                                {contract.scopeDescription}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Scope Additions */}
                        <div className="col-span-full flex items-start gap-2">
                          <PenLine className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="flex-1">
                            <span className="text-xs text-muted-foreground">
                              {t("scopeAdditions")}:
                            </span>
                            {editingAdditionsId === contract.id ? (
                              <div className="mt-1 space-y-2">
                                <Textarea
                                  value={scopeAdditionsText}
                                  onChange={(e) => setScopeAdditionsText(e.target.value)}
                                  placeholder={t("scopeAdditionsPlaceholder")}
                                  rows={3}
                                  className="text-sm"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleSaveAdditions(contract.id)}
                                    disabled={savingAdditions}
                                  >
                                    {savingAdditions ? (
                                      <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />{t("saving")}</>
                                    ) : (
                                      <><Save className="mr-2 h-3.5 w-3.5" />{t("save")}</>
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setEditingAdditionsId(null)}
                                  >
                                    {t("cancel")}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-1">
                                {contract.scopeAdditions ? (
                                  <p className="text-sm">{contract.scopeAdditions}</p>
                                ) : (
                                  <p className="text-sm text-muted-foreground italic">{t("noAdditions")}</p>
                                )}
                                <Button
                                  size="sm"
                                  variant="link"
                                  className="h-auto p-0 text-xs"
                                  onClick={() => {
                                    setEditingAdditionsId(contract.id);
                                    setScopeAdditionsText(contract.scopeAdditions || "");
                                  }}
                                >
                                  {contract.scopeAdditions ? t("editAdditions") : t("addAdditions")}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>

                        {contract.scopeKeywords.length > 0 && (
                          <div className="col-span-full flex items-start gap-2">
                            <Tag className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            <div>
                              <span className="text-xs text-muted-foreground">
                                {t("keywords")}:
                              </span>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {contract.scopeKeywords.map((kw) => (
                                  <Badge
                                    key={kw}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {kw}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {contract.exclusions.length > 0 && (
                          <div className="col-span-full flex items-start gap-2">
                            <ShieldX className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            <div>
                              <span className="text-xs text-muted-foreground">
                                {t("exclusions")}:
                              </span>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {contract.exclusions.map((ex) => (
                                  <Badge
                                    key={ex}
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    {ex}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Scanned PDF Dialog */}
      <Dialog open={scannedDialogOpen} onOpenChange={setScannedDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {t("scannedPdfTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("scannedPdfMessage")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={handleScannedManual}>
              <PenLine className="mr-2 h-4 w-4" />
              {t("enterManually")}
            </Button>
            <Button onClick={handleScannedProceed}>
              {t("proceedWithoutAnonymization")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
