"use client";

import { useState, useCallback } from "react";
import {
  Upload,
  Check,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  FileSpreadsheet,
  Users,
  FolderKanban,
  BarChart3,
  Receipt,
  ClipboardCheck,
  X,
  Loader2,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations } from "@/lib/i18n";
import { toast } from "sonner";
import type { ProjektkortData, ProjektkortActivity } from "@/lib/economic-projektkort-parser";
import type { OmsaetningData } from "@/lib/economic-omsaetning-parser";

interface TeamMember {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

interface ExistingProject {
  id: string;
  name: string;
  client: string | null;
}

interface EconomicSyncWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  onComplete?: () => void;
}

type BillingClassification = "billable" | "nonBillable" | "mixed";

interface ActivityClassification {
  billingStatus: BillingClassification;
  tilbudCategoryId?: string | null;
}

const STEPS = [
  { key: "upload", icon: FileSpreadsheet },
  { key: "project", icon: FolderKanban },
  { key: "employees", icon: Users },
  { key: "activities", icon: BarChart3 },
  { key: "invoicing", icon: Receipt },
  { key: "confirm", icon: ClipboardCheck },
];

export const EconomicSyncWizard = ({
  open,
  onOpenChange,
  projectId: initialProjectId,
  onComplete,
}: EconomicSyncWizardProps) => {
  const t = useTranslations("economicSync");
  const tc = useTranslations("common");

  // Wizard state
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  // Step 1: Upload
  const [projektkortFile, setProjektkortFile] = useState<File | null>(null);
  const [omsaetningFile, setOmsaetningFile] = useState<File | null>(null);
  const [projektkortData, setProjektkortData] = useState<ProjektkortData | null>(null);
  const [omsaetningData, setOmsaetningData] = useState<OmsaetningData | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);

  // Step 2: Project
  const [useExisting, setUseExisting] = useState(!!initialProjectId);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId || "");
  const [projectName, setProjectName] = useState("");
  const [projectNumber, setProjectNumber] = useState("");
  const [clientName, setClientName] = useState("");
  const [existingProjects, setExistingProjects] = useState<ExistingProject[]>([]);

  // Step 3: Employees
  const [employeeMappings, setEmployeeMappings] = useState<Record<string, string>>({});
  const [skippedEmployees, setSkippedEmployees] = useState<Set<string>>(new Set());

  // Step 4: Activities
  const [activityClassifications, setActivityClassifications] = useState<
    Record<string, ActivityClassification>
  >({});

  // Step 5: Invoicing
  const [invoiceMappings, setInvoiceMappings] = useState<Record<string, number | null>>({});

  // Derived
  const hasOmsaetning = !!omsaetningData;
  const visibleSteps = STEPS.filter((s) => s.key !== "invoicing" || hasOmsaetning);
  const currentStepKey = visibleSteps[step]?.key || "upload";

  const resetWizard = () => {
    setStep(0);
    setProjektkortFile(null);
    setOmsaetningFile(null);
    setProjektkortData(null);
    setOmsaetningData(null);
    setTeam([]);
    setUseExisting(!!initialProjectId);
    setSelectedProjectId(initialProjectId || "");
    setProjectName("");
    setProjectNumber("");
    setClientName("");
    setEmployeeMappings({});
    setSkippedEmployees(new Set());
    setActivityClassifications({});
    setInvoiceMappings({});
  };

  // --- Step 1: Upload & Parse ---
  const handleFileUpload = useCallback(
    async (type: "projektkort" | "omsaetning", file: File) => {
      if (type === "projektkort") setProjektkortFile(file);
      else setOmsaetningFile(file);
    },
    []
  );

  const handleParse = async () => {
    if (!projektkortFile) return;
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("projektkort", projektkortFile);
      if (omsaetningFile) formData.append("omsaetning", omsaetningFile);
      if (initialProjectId) formData.append("projectId", initialProjectId);

      const res = await fetch("/api/projects/import/economic-sync", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Parse failed");
      }

      const result = await res.json();

      setProjektkortData(result.projektkortData);
      setOmsaetningData(result.omsaetningData || null);
      setTeam(result.team || []);

      // Pre-fill project info
      if (result.projektkortData) {
        setProjectName(result.projektkortData.projectName || "");
        setProjectNumber(result.projektkortData.projectNumber || "");
        if (result.omsaetningData?.categories?.[0]?.projectEntries?.[0]?.customerName) {
          setClientName(result.omsaetningData.categories[0].projectEntries[0].customerName);
        }
      }

      // Pre-fill employee mappings
      if (result.suggestedMappings?.employees) {
        const mappings: Record<string, string> = {};
        result.suggestedMappings.employees.forEach(
          (m: { economicName: string; suggestedUserId: string | null }) => {
            if (m.suggestedUserId) mappings[m.economicName] = m.suggestedUserId;
          }
        );
        setEmployeeMappings(mappings);
      }

      // Pre-fill activity classifications
      if (result.projektkortData?.activities) {
        const classifications: Record<string, ActivityClassification> = {};
        result.projektkortData.activities.forEach((act: ProjektkortActivity) => {
          classifications[String(act.number)] = {
            billingStatus: act.suggestedBillingStatus,
          };
        });
        setActivityClassifications(classifications);
      }

      // Pre-fill invoice mappings
      if (result.suggestedMappings?.invoiceCategories) {
        const iMappings: Record<string, number | null> = {};
        result.suggestedMappings.invoiceCategories.forEach(
          (m: { categoryNumber: number; suggestedActivityNumber: number | null }) => {
            iMappings[String(m.categoryNumber)] = m.suggestedActivityNumber;
          }
        );
        setInvoiceMappings(iMappings);
      }

      // Fetch existing projects for mapping
      const projRes = await fetch("/api/projects");
      if (projRes.ok) {
        const projs = await projRes.json();
        setExistingProjects(
          projs.map((p: { id: string; name: string; client: string | null }) => ({
            id: p.id,
            name: p.name,
            client: p.client,
          }))
        );
      }

      setStep(1);
    } catch (err) {
      toast.error(t("parseError"));
      console.error("Parse error:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- Step 6: Confirm Import ---
  const handleImport = async () => {
    if (!projektkortData) return;
    setImporting(true);

    try {
      // Build filtered employee mappings (exclude skipped)
      const filteredMappings: Record<string, string> = {};
      Object.entries(employeeMappings).forEach(([name, userId]) => {
        if (!skippedEmployees.has(name) && userId) {
          filteredMappings[name] = userId;
        }
      });

      const body: Record<string, unknown> = {
        employeeMappings: filteredMappings,
        activityClassifications,
        projektkortData,
      };

      if (useExisting && selectedProjectId) {
        body.projectId = selectedProjectId;
      } else {
        body.newProject = {
          name: projectName,
          projectNumber,
          clientName,
        };
      }

      if (omsaetningData) {
        body.omsaetningData = omsaetningData;
        body.invoiceMappings = invoiceMappings;
      }

      const res = await fetch("/api/projects/import/economic-sync", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Import failed");
      }

      const result = await res.json();
      toast.success(
        t("importSuccessDesc")
          .replace("{entries}", String(result.stats?.createdEntries || 0))
          .replace("{project}", projectName || "projekt")
      );

      onOpenChange(false);
      resetWizard();
      onComplete?.();
    } catch (err) {
      toast.error(t("importError"));
      console.error("Import error:", err);
    } finally {
      setImporting(false);
    }
  };

  // --- Navigation ---
  const canGoNext = (): boolean => {
    if (currentStepKey === "upload") return !!projektkortFile;
    if (currentStepKey === "project") {
      return useExisting ? !!selectedProjectId : !!projectName.trim();
    }
    if (currentStepKey === "employees") {
      const economicNames = getEconomicNames();
      return economicNames.some(
        (name) => !skippedEmployees.has(name) && employeeMappings[name]
      );
    }
    return true;
  };

  const handleNext = () => {
    if (currentStepKey === "upload") {
      handleParse();
      return;
    }
    if (step < visibleSteps.length - 1) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  // --- Helpers ---
  const getEconomicNames = (): string[] => {
    if (!projektkortData) return [];
    return Array.from(
      new Set(
        projektkortData.activities.flatMap((a) =>
          a.entries.map((e) => e.employeeName)
        )
      )
    ).filter(Boolean);
  };

  const getEmployeeEntryCount = (name: string): number => {
    if (!projektkortData) return 0;
    return projektkortData.activities.reduce(
      (sum, a) => sum + a.entries.filter((e) => e.employeeName === name).length,
      0
    );
  };

  const getEmployeeHours = (name: string): number => {
    if (!projektkortData) return 0;
    return projektkortData.activities.reduce(
      (sum, a) =>
        sum + a.entries.filter((e) => e.employeeName === name).reduce((s, e) => s + e.hours, 0),
      0
    );
  };

  const getActivityEmployees = (activity: ProjektkortActivity): string[] => {
    return Array.from(new Set(activity.entries.map((e) => e.employeeName)));
  };

  // --- Totals for confirm step ---
  const computeTotals = () => {
    if (!projektkortData) return { total: 0, billable: 0, nonBillable: 0, invoiced: 0, entries: 0 };

    let total = 0, billable = 0, nonBillable = 0, entries = 0;

    projektkortData.activities.forEach((act) => {
      const cls = activityClassifications[String(act.number)];
      act.entries.forEach((entry) => {
        if (skippedEmployees.has(entry.employeeName) || !employeeMappings[entry.employeeName]) return;
        entries++;
        total += entry.hours;
        if (!cls || cls.billingStatus === "nonBillable") {
          nonBillable += entry.hours;
        } else if (cls.billingStatus === "billable") {
          billable += entry.hours;
        } else {
          // Mixed
          if (entry.salgspris > 0) billable += entry.hours;
          else nonBillable += entry.hours;
        }
      });
    });

    // Calculate invoiced hours from invoice mappings
    let invoiced = 0;
    if (omsaetningData && invoiceMappings) {
      Object.entries(invoiceMappings).forEach(([catNumStr, actNum]) => {
        if (actNum == null) return;
        const catNum = parseInt(catNumStr);
        const cat = omsaetningData.categories.find((c) => c.number === catNum);
        if (cat) invoiced += cat.subtotal.hours;
      });
    }

    return { total, billable, nonBillable, invoiced, entries };
  };

  // --- Render Steps ---
  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-1 mb-6">
      {visibleSteps.map((s, i) => {
        const Icon = s.icon;
        const isComplete = i < step;
        const isCurrent = i === step;
        return (
          <div key={s.key} className="flex items-center">
            {i > 0 && (
              <div
                className={`h-0.5 w-6 mx-1 ${
                  isComplete ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
            <div
              className={`flex items-center justify-center h-8 w-8 rounded-full text-xs font-medium transition-colors ${
                isComplete
                  ? "bg-primary text-primary-foreground"
                  : isCurrent
                  ? "bg-primary/20 text-primary border-2 border-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {isComplete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderUploadStep = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("description")}</p>

      {/* Projektkort upload */}
      <div className="space-y-2">
        <Label className="font-medium">
          {t("uploadProjektkort")}{" "}
          <Badge variant="destructive" className="ml-1 text-xs">
            {t("uploadProjektkortRequired")}
          </Badge>
        </Label>
        <p className="text-xs text-muted-foreground">{t("uploadProjektkortDesc")}</p>
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            projektkortFile
              ? "border-green-500 bg-green-50 dark:bg-green-950/20"
              : "border-muted-foreground/25 hover:border-primary/50"
          }`}
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".xlsx,.xls";
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) handleFileUpload("projektkort", file);
            };
            input.click();
          }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const file = e.dataTransfer.files[0];
            if (file) handleFileUpload("projektkort", file);
          }}
        >
          {projektkortFile ? (
            <div className="flex items-center justify-center gap-2 text-green-600">
              <FileSpreadsheet className="h-5 w-5" />
              <span className="text-sm font-medium">{projektkortFile.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setProjektkortFile(null);
                }}
                className="ml-2 p-1 rounded hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div>
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Træk og slip eller klik for at vælge
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Omsaetning upload */}
      <div className="space-y-2">
        <Label className="font-medium">
          {t("uploadOmsaetning")}{" "}
          <Badge variant="secondary" className="ml-1 text-xs">
            {t("uploadOmsaetningOptional")}
          </Badge>
        </Label>
        <p className="text-xs text-muted-foreground">{t("uploadOmsaetningDesc")}</p>
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            omsaetningFile
              ? "border-green-500 bg-green-50 dark:bg-green-950/20"
              : "border-muted-foreground/25 hover:border-primary/50"
          }`}
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".xlsx,.xls";
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) handleFileUpload("omsaetning", file);
            };
            input.click();
          }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const file = e.dataTransfer.files[0];
            if (file) handleFileUpload("omsaetning", file);
          }}
        >
          {omsaetningFile ? (
            <div className="flex items-center justify-center gap-2 text-green-600">
              <FileSpreadsheet className="h-5 w-5" />
              <span className="text-sm font-medium">{omsaetningFile.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOmsaetningFile(null);
                }}
                className="ml-2 p-1 rounded hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div>
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Træk og slip eller klik for at vælge
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderProjectStep = () => (
    <div className="space-y-4">
      {projektkortData && (
        <div className="rounded-lg border p-3 bg-muted/30">
          <p className="text-sm font-medium">
            {projektkortData.projectName} ({projektkortData.projectNumber})
          </p>
          <p className="text-xs text-muted-foreground">
            {projektkortData.companyName} &middot;{" "}
            {projektkortData.period.from} → {projektkortData.period.to}
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant={!useExisting ? "default" : "outline"}
          size="sm"
          onClick={() => setUseExisting(false)}
        >
          {t("createNew")}
        </Button>
        <Button
          variant={useExisting ? "default" : "outline"}
          size="sm"
          onClick={() => setUseExisting(true)}
        >
          {t("linkExisting")}
        </Button>
      </div>

      {useExisting ? (
        <div className="space-y-2">
          <Label>{tc("project")}</Label>
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger>
              <SelectValue placeholder="Vælg projekt..." />
            </SelectTrigger>
            <SelectContent>
              {existingProjects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}{p.client ? ` (${p.client})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>{t("projectName")}</Label>
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="f.eks. Blidahpark 5"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("projectNumber")}</Label>
            <Input
              value={projectNumber}
              onChange={(e) => setProjectNumber(e.target.value)}
              placeholder="f.eks. 2025017"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("clientName")}</Label>
            <Input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="f.eks. Jørgen Kolind Knudsen"
            />
          </div>
        </div>
      )}

      {projektkortData && (
        <div className="rounded-lg border p-3 text-sm bg-muted/20">
          <p className="text-muted-foreground">
            {t("reimportWarning")}
          </p>
        </div>
      )}
    </div>
  );

  const renderEmployeeStep = () => {
    const names = getEconomicNames();
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("employeeMapping")}</p>
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {names.map((name) => {
            const isSkipped = skippedEmployees.has(name);
            const isMatched = !!employeeMappings[name];
            return (
              <div
                key={name}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  isSkipped
                    ? "opacity-50 bg-muted/30"
                    : isMatched
                    ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900"
                    : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{name}</p>
                  <p className="text-xs text-muted-foreground">
                    {getEmployeeEntryCount(name)} entries &middot; {getEmployeeHours(name).toFixed(1)}t
                  </p>
                </div>
                <Select
                  value={employeeMappings[name] || ""}
                  onValueChange={(val) => {
                    setEmployeeMappings((prev) => ({ ...prev, [name]: val }));
                    setSkippedEmployees((prev) => {
                      const next = new Set(prev);
                      next.delete(name);
                      return next;
                    });
                  }}
                  disabled={isSkipped}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder={t("noMatch")} />
                  </SelectTrigger>
                  <SelectContent>
                    {team.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.firstName} {m.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={isSkipped}
                    onChange={(e) => {
                      setSkippedEmployees((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(name);
                        else next.delete(name);
                        return next;
                      });
                    }}
                    className="h-3.5 w-3.5 rounded"
                  />
                  {t("skipEmployee")}
                </label>
                {isMatched && !isSkipped && (
                  <Badge variant="outline" className="text-green-600 border-green-300 text-xs">
                    {t("autoMatched")}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderActivityStep = () => {
    if (!projektkortData) return null;
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium">{t("classifyActivities")}</p>
          <p className="text-xs text-muted-foreground">{t("classifyDesc")}</p>
        </div>
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {projektkortData.activities.map((activity) => {
            const cls = activityClassifications[String(activity.number)] || {
              billingStatus: activity.suggestedBillingStatus,
            };
            const employees = getActivityEmployees(activity);
            const totalHours = activity.entries.reduce((s, e) => s + e.hours, 0);
            const totalSalgspris = activity.entries.reduce((s, e) => s + e.salgspris, 0);

            return (
              <div key={activity.number} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">
                      {activity.number} - {activity.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {totalHours.toFixed(1)}t &middot; {activity.entries.length} entries &middot;{" "}
                      {employees.join(", ")}
                    </p>
                  </div>
                  <Badge
                    variant={
                      totalSalgspris > 0
                        ? activity.suggestedBillingStatus === "mixed"
                          ? "secondary"
                          : "default"
                        : "outline"
                    }
                  >
                    {totalSalgspris > 0
                      ? `${t("salgspris")}: ${totalSalgspris.toLocaleString("da-DK")} kr`
                      : t("allSalgsprisZero")}
                  </Badge>
                </div>

                {activity.suggestedBillingStatus === "mixed" && (
                  <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-2 rounded">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                    {t("mixedWarning")
                      .replace(
                        "{billable}",
                        activity.entries
                          .filter((e) => e.salgspris > 0)
                          .reduce((s, e) => s + e.hours, 0)
                          .toFixed(1)
                      )
                      .replace(
                        "{nonBillable}",
                        activity.entries
                          .filter((e) => e.salgspris === 0)
                          .reduce((s, e) => s + e.hours, 0)
                          .toFixed(1)
                      )}
                  </div>
                )}

                <div className="flex gap-2">
                  {(["billable", "nonBillable", "mixed"] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() =>
                        setActivityClassifications((prev) => ({
                          ...prev,
                          [String(activity.number)]: {
                            ...prev[String(activity.number)],
                            billingStatus: status,
                          },
                        }))
                      }
                      className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium border transition-colors ${
                        cls.billingStatus === status
                          ? status === "billable"
                            ? "bg-green-100 border-green-300 text-green-800 dark:bg-green-900/40 dark:border-green-700 dark:text-green-300"
                            : status === "nonBillable"
                            ? "bg-red-100 border-red-300 text-red-800 dark:bg-red-900/40 dark:border-red-700 dark:text-red-300"
                            : "bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900/40 dark:border-amber-700 dark:text-amber-300"
                          : "bg-background border-muted hover:bg-muted/50"
                      }`}
                    >
                      {t(status)}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderInvoicingStep = () => {
    if (!omsaetningData || !projektkortData) return null;
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium">{t("mapInvoiceCategories")}</p>
          <p className="text-xs text-muted-foreground">{t("mapInvoiceDesc")}</p>
        </div>
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {omsaetningData.categories.map((cat) => (
            <div key={cat.number} className="flex items-center gap-3 p-3 border rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {cat.number} - {cat.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {cat.subtotal.hours.toFixed(1)}t &middot;{" "}
                  {cat.subtotal.revenue.toLocaleString("da-DK")} kr
                </p>
              </div>
              <Select
                value={
                  invoiceMappings[String(cat.number)] != null
                    ? String(invoiceMappings[String(cat.number)])
                    : ""
                }
                onValueChange={(val) =>
                  setInvoiceMappings((prev) => ({
                    ...prev,
                    [String(cat.number)]: val ? parseInt(val) : null,
                  }))
                }
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder={t("noActivityMatch")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">
                    {t("noActivityMatch")}
                  </SelectItem>
                  {projektkortData.activities.map((act) => (
                    <SelectItem key={act.number} value={String(act.number)}>
                      {act.number} - {act.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        {omsaetningData.totals && (
          <div className="text-right text-sm font-medium text-muted-foreground">
            Total: {omsaetningData.totals.hours.toFixed(1)}t &middot;{" "}
            {omsaetningData.totals.revenue.toLocaleString("da-DK")} kr
          </div>
        )}
      </div>
    );
  };

  const renderConfirmStep = () => {
    const totals = computeTotals();
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium">{t("confirmTitle")}</p>

        {/* Project info */}
        <div className="rounded-lg border p-3 space-y-1">
          <p className="text-sm font-medium">
            {useExisting
              ? existingProjects.find((p) => p.id === selectedProjectId)?.name || "—"
              : projectName}
          </p>
          {!useExisting && clientName && (
            <p className="text-xs text-muted-foreground">{clientName}</p>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold">{totals.entries}</p>
            <p className="text-xs text-muted-foreground">{t("totalEntries")}</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold">{totals.total.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">{t("hours")}</p>
          </div>
          <div className="rounded-lg border p-3 text-center bg-green-50 dark:bg-green-950/20">
            <p className="text-2xl font-bold text-green-600">{totals.billable.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">{t("billableHours")}</p>
          </div>
          <div className="rounded-lg border p-3 text-center bg-red-50 dark:bg-red-950/20">
            <p className="text-2xl font-bold text-red-600">{totals.nonBillable.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">{t("nonBillableHours")}</p>
          </div>
        </div>

        {totals.invoiced > 0 && (
          <div className="rounded-lg border p-3 text-center bg-blue-50 dark:bg-blue-950/20">
            <p className="text-lg font-bold text-blue-600">{totals.invoiced.toFixed(1)}t</p>
            <p className="text-xs text-muted-foreground">{t("invoicedHours")}</p>
          </div>
        )}

        {/* Employee summary */}
        <div className="text-xs text-muted-foreground">
          <p>
            {Object.values(employeeMappings).filter(Boolean).length - skippedEmployees.size}{" "}
            medarbejdere importeres
          </p>
          <p>
            {projektkortData?.activities.length || 0} aktiviteter klassificeret
          </p>
        </div>
      </div>
    );
  };

  const renderCurrentStep = () => {
    switch (currentStepKey) {
      case "upload":
        return renderUploadStep();
      case "project":
        return renderProjectStep();
      case "employees":
        return renderEmployeeStep();
      case "activities":
        return renderActivityStep();
      case "invoicing":
        return renderInvoicingStep();
      case "confirm":
        return renderConfirmStep();
      default:
        return null;
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) resetWizard();
        onOpenChange(val);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        {renderStepIndicator()}
        {renderCurrentStep()}

        <DialogFooter className="flex justify-between sm:justify-between">
          <div>
            {step > 0 && (
              <Button variant="outline" onClick={handleBack} disabled={loading || importing}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                {tc("back") || "Tilbage"}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {tc("cancel")}
            </Button>
            {currentStepKey === "confirm" ? (
              <Button onClick={handleImport} disabled={importing}>
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("importing")}
                  </>
                ) : (
                  t("importButton")
                )}
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={!canGoNext() || loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {tc("processing")}
                  </>
                ) : (
                  <>
                    {tc("next") || "Næste"}
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
