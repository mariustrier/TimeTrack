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
  ChevronDown,
  ChevronUp,
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

/** Per-project data parsed from a Projektkort file */
interface ProjectFileData {
  file: File;
  projektkortData: ProjektkortData;
  // Project config
  useExisting: boolean;
  selectedProjectId: string;
  projectName: string;
  projectNumber: string;
  clientName: string;
  // Per-project activity classifications
  activityClassifications: Record<string, ActivityClassification>;
  // Per-project invoice mappings
  invoiceMappings: Record<string, number | null>;
  // Suggested employee mappings from this file
  suggestedEmployeeMappings: { economicName: string; suggestedUserId: string | null }[];
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
  const [importProgress, setImportProgress] = useState(0);

  // Step 1: Upload — multiple files
  const [projektkortFiles, setProjektkortFiles] = useState<File[]>([]);
  const [omsaetningFile, setOmsaetningFile] = useState<File | null>(null);
  const [omsaetningData, setOmsaetningData] = useState<OmsaetningData | null>(null);

  // Parsed project data (one per file)
  const [projects, setProjects] = useState<ProjectFileData[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [existingProjects, setExistingProjects] = useState<ExistingProject[]>([]);

  // Step 3: Shared employee mappings
  const [employeeMappings, setEmployeeMappings] = useState<Record<string, string>>({});
  const [skippedEmployees, setSkippedEmployees] = useState<Set<string>>(new Set());

  // UI state
  const [expandedProject, setExpandedProject] = useState<number>(0);

  // Derived
  const hasOmsaetning = !!omsaetningData;
  const visibleSteps = STEPS.filter((s) => s.key !== "invoicing" || hasOmsaetning);
  const currentStepKey = visibleSteps[step]?.key || "upload";

  const resetWizard = () => {
    setStep(0);
    setProjektkortFiles([]);
    setOmsaetningFile(null);
    setOmsaetningData(null);
    setProjects([]);
    setTeam([]);
    setExistingProjects([]);
    setEmployeeMappings({});
    setSkippedEmployees(new Set());
    setExpandedProject(0);
    setImportProgress(0);
  };

  // --- Step 1: Upload & Parse ---
  const addFiles = useCallback((files: FileList | File[]) => {
    const newFiles = Array.from(files).filter(
      (f) => f.name.endsWith(".xlsx") || f.name.endsWith(".xls")
    );
    setProjektkortFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const removeFile = (index: number) => {
    setProjektkortFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleParse = async () => {
    if (projektkortFiles.length === 0) return;
    setLoading(true);

    try {
      const parsedProjects: ProjectFileData[] = [];
      const allEmployeeMappings: Record<string, string> = {};

      // Parse each file via the API
      for (const file of projektkortFiles) {
        const formData = new FormData();
        formData.append("projektkort", file);
        if (omsaetningFile) formData.append("omsaetning", omsaetningFile);
        if (initialProjectId) formData.append("projectId", initialProjectId);

        const res = await fetch("/api/projects/import/economic-sync", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error(`${file.name}: ${err.error || t("parseError")}`);
          continue;
        }

        const result = await res.json();
        const projektkortData = result.projektkortData as ProjektkortData;

        // Set omsaetning data from first successful parse
        if (result.omsaetningData && !omsaetningData) {
          setOmsaetningData(result.omsaetningData);
        }

        // Save team from first response
        if (result.team && team.length === 0) {
          setTeam(result.team);
        }

        // Build activity classifications from suggestions
        const classifications: Record<string, ActivityClassification> = {};
        projektkortData.activities.forEach((act: ProjektkortActivity) => {
          classifications[String(act.number)] = {
            billingStatus: act.suggestedBillingStatus,
          };
        });

        // Build invoice mappings from suggestions
        const iMappings: Record<string, number | null> = {};
        if (result.suggestedMappings?.invoiceCategories) {
          result.suggestedMappings.invoiceCategories.forEach(
            (m: { categoryNumber: number; suggestedActivityNumber: number | null }) => {
              iMappings[String(m.categoryNumber)] = m.suggestedActivityNumber;
            }
          );
        }

        // Collect employee mappings
        if (result.suggestedMappings?.employees) {
          result.suggestedMappings.employees.forEach(
            (m: { economicName: string; suggestedUserId: string | null }) => {
              if (m.suggestedUserId && !allEmployeeMappings[m.economicName]) {
                allEmployeeMappings[m.economicName] = m.suggestedUserId;
              }
            }
          );
        }

        parsedProjects.push({
          file,
          projektkortData,
          useExisting: !!initialProjectId,
          selectedProjectId: initialProjectId || "",
          projectName: projektkortData.projectName || "",
          projectNumber: projektkortData.projectNumber || "",
          clientName: "",
          activityClassifications: classifications,
          invoiceMappings: iMappings,
          suggestedEmployeeMappings: result.suggestedMappings?.employees || [],
        });
      }

      if (parsedProjects.length === 0) {
        toast.error(t("parseError"));
        setLoading(false);
        return;
      }

      setProjects(parsedProjects);
      setEmployeeMappings(allEmployeeMappings);

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
    if (projects.length === 0) return;
    setImporting(true);
    setImportProgress(0);

    let successCount = 0;
    let totalEntries = 0;

    try {
      for (let i = 0; i < projects.length; i++) {
        const proj = projects[i];
        setImportProgress(i + 1);

        // Build filtered employee mappings (exclude skipped)
        const filteredMappings: Record<string, string> = {};
        Object.entries(employeeMappings).forEach(([name, userId]) => {
          if (!skippedEmployees.has(name) && userId) {
            filteredMappings[name] = userId;
          }
        });

        const body: Record<string, unknown> = {
          employeeMappings: filteredMappings,
          activityClassifications: proj.activityClassifications,
          projektkortData: proj.projektkortData,
        };

        if (proj.useExisting && proj.selectedProjectId) {
          body.projectId = proj.selectedProjectId;
        } else {
          body.newProject = {
            name: proj.projectName,
            projectNumber: proj.projectNumber,
            clientName: proj.clientName,
          };
        }

        if (omsaetningData) {
          body.omsaetningData = omsaetningData;
          body.invoiceMappings = proj.invoiceMappings;
        }

        const res = await fetch("/api/projects/import/economic-sync", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const result = await res.json();
          successCount++;
          totalEntries += result.stats?.createdEntries || 0;
        } else {
          const err = await res.json().catch(() => ({}));
          toast.error(`${proj.projectName}: ${err.error || t("importError")}`);
        }
      }

      if (successCount > 0) {
        toast.success(
          t("importSuccessDesc")
            .replace("{entries}", String(totalEntries))
            .replace("{project}", successCount === 1
              ? projects[0].projectName
              : `${successCount} projekter`)
        );
      }

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
    if (currentStepKey === "upload") return projektkortFiles.length > 0;
    if (currentStepKey === "project") {
      return projects.every((p) =>
        p.useExisting ? !!p.selectedProjectId : !!p.projectName.trim()
      );
    }
    if (currentStepKey === "employees") {
      const names = getAllEconomicNames();
      return names.some(
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
  const getAllEconomicNames = (): string[] => {
    const names = new Set<string>();
    projects.forEach((proj) => {
      proj.projektkortData.activities.forEach((a) => {
        a.entries.forEach((e) => {
          if (e.employeeName) names.add(e.employeeName);
        });
      });
    });
    return Array.from(names);
  };

  const getEmployeeStats = (name: string): { entries: number; hours: number } => {
    let entries = 0, hours = 0;
    projects.forEach((proj) => {
      proj.projektkortData.activities.forEach((a) => {
        a.entries.forEach((e) => {
          if (e.employeeName === name) {
            entries++;
            hours += e.hours;
          }
        });
      });
    });
    return { entries, hours };
  };

  const getActivityEmployees = (activity: ProjektkortActivity): string[] => {
    return Array.from(new Set(activity.entries.map((e) => e.employeeName)));
  };

  const updateProject = (index: number, updates: Partial<ProjectFileData>) => {
    setProjects((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...updates } : p))
    );
  };

  // --- Totals ---
  const computeGrandTotals = () => {
    let total = 0, billable = 0, nonBillable = 0, entries = 0;
    projects.forEach((proj) => {
      proj.projektkortData.activities.forEach((act) => {
        const cls = proj.activityClassifications[String(act.number)];
        act.entries.forEach((entry) => {
          if (skippedEmployees.has(entry.employeeName) || !employeeMappings[entry.employeeName]) return;
          entries++;
          total += entry.hours;
          if (!cls || cls.billingStatus === "nonBillable") {
            nonBillable += entry.hours;
          } else if (cls.billingStatus === "billable") {
            billable += entry.hours;
          } else {
            if (entry.salgspris > 0) billable += entry.hours;
            else nonBillable += entry.hours;
          }
        });
      });
    });
    return { total, billable, nonBillable, entries };
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

      {/* Projektkort upload — multiple files */}
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
            projektkortFiles.length > 0
              ? "border-green-500 bg-green-50 dark:bg-green-950/20"
              : "border-muted-foreground/25 hover:border-primary/50"
          }`}
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".xlsx,.xls";
            input.multiple = true;
            input.onchange = (e) => {
              const files = (e.target as HTMLInputElement).files;
              if (files) addFiles(files);
            };
            input.click();
          }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            addFiles(e.dataTransfer.files);
          }}
        >
          {projektkortFiles.length > 0 ? (
            <div className="space-y-2">
              {projektkortFiles.map((file, idx) => (
                <div key={idx} className="flex items-center justify-center gap-2 text-green-600">
                  <FileSpreadsheet className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm font-medium truncate max-w-[300px]">{file.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(idx);
                    }}
                    className="p-1 rounded hover:bg-muted flex-shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground mt-2">
                {projektkortFiles.length} {projektkortFiles.length === 1 ? "fil" : "filer"} — klik eller træk for at tilføje flere
              </p>
            </div>
          ) : (
            <div>
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Træk og slip eller klik for at vælge (en eller flere filer)
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
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
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
              if (file) setOmsaetningFile(file);
            };
            input.click();
          }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const file = e.dataTransfer.files[0];
            if (file) setOmsaetningFile(file);
          }}
        >
          {omsaetningFile ? (
            <div className="flex items-center justify-center gap-2 text-green-600">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="text-sm font-medium">{omsaetningFile.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOmsaetningFile(null);
                }}
                className="p-1 rounded hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div>
              <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
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
      <p className="text-sm text-muted-foreground">
        {projects.length === 1
          ? t("projectSetup") || "Konfigurer projektet"
          : `${projects.length} projekter fundet — konfigurer hver`}
      </p>

      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {projects.map((proj, idx) => {
          const isExpanded = expandedProject === idx || projects.length === 1;
          return (
            <div key={idx} className="border rounded-lg overflow-hidden">
              {/* Header — click to expand if multiple */}
              <button
                onClick={() => setExpandedProject(isExpanded && projects.length > 1 ? -1 : idx)}
                className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className="flex-shrink-0">{proj.projectNumber || `#${idx + 1}`}</Badge>
                  <span className="font-medium text-sm truncate">
                    {proj.projectName || proj.file.name}
                  </span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {proj.projektkortData.totals.registeredHours.toFixed(1)}t
                  </span>
                </div>
                {projects.length > 1 && (
                  isExpanded ? <ChevronUp className="h-4 w-4 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 flex-shrink-0" />
                )}
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="p-3 space-y-3 border-t">
                  {/* Parsed info */}
                  <div className="text-xs text-muted-foreground">
                    {proj.projektkortData.companyName} &middot;{" "}
                    {proj.projektkortData.period.from} → {proj.projektkortData.period.to} &middot;{" "}
                    {proj.projektkortData.activities.length} aktiviteter
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant={!proj.useExisting ? "default" : "outline"}
                      size="sm"
                      onClick={() => updateProject(idx, { useExisting: false })}
                    >
                      {t("createNew")}
                    </Button>
                    <Button
                      variant={proj.useExisting ? "default" : "outline"}
                      size="sm"
                      onClick={() => updateProject(idx, { useExisting: true })}
                    >
                      {t("linkExisting")}
                    </Button>
                  </div>

                  {proj.useExisting ? (
                    <div className="space-y-2">
                      <Label>{tc("project")}</Label>
                      <Select
                        value={proj.selectedProjectId}
                        onValueChange={(val) => updateProject(idx, { selectedProjectId: val })}
                      >
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
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">{t("projectName")}</Label>
                          <Input
                            value={proj.projectName}
                            onChange={(e) => updateProject(idx, { projectName: e.target.value })}
                            placeholder="f.eks. Blidahpark 5"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{t("projectNumber")}</Label>
                          <Input
                            value={proj.projectNumber}
                            onChange={(e) => updateProject(idx, { projectNumber: e.target.value })}
                            placeholder="f.eks. 2025017"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t("clientName")}</Label>
                        <Input
                          value={proj.clientName}
                          onChange={(e) => updateProject(idx, { clientName: e.target.value })}
                          placeholder="f.eks. Jørgen Kolind Knudsen"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border p-3 text-sm bg-muted/20">
        <p className="text-muted-foreground">{t("reimportWarning")}</p>
      </div>
    </div>
  );

  const renderEmployeeStep = () => {
    const names = getAllEconomicNames();
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("employeeMapping")}</p>
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {names.map((name) => {
            const isSkipped = skippedEmployees.has(name);
            const isMatched = !!employeeMappings[name];
            const stats = getEmployeeStats(name);
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
                    {stats.entries} entries &middot; {stats.hours.toFixed(1)}t
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
    if (projects.length === 0) return null;

    // Single project — show flat list
    if (projects.length === 1) {
      return renderProjectActivities(projects[0], 0);
    }

    // Multiple projects — collapsible sections
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium">{t("classifyActivities")}</p>
          <p className="text-xs text-muted-foreground">{t("classifyDesc")}</p>
        </div>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {projects.map((proj, idx) => {
            const isExpanded = expandedProject === idx;
            return (
              <div key={idx} className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedProject(isExpanded ? -1 : idx)}
                  className="w-full flex items-center justify-between p-3 bg-muted/20 hover:bg-muted/30 text-left"
                >
                  <span className="font-medium text-sm">
                    {proj.projectName || proj.projectNumber}
                    <span className="text-muted-foreground font-normal ml-2">
                      ({proj.projektkortData.activities.length} aktiviteter)
                    </span>
                  </span>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {isExpanded && (
                  <div className="p-3 border-t">
                    {renderProjectActivities(proj, idx)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderProjectActivities = (proj: ProjectFileData, projIdx: number) => (
    <div className="space-y-4">
      {projects.length === 1 && (
        <div>
          <p className="text-sm font-medium">{t("classifyActivities")}</p>
          <p className="text-xs text-muted-foreground">{t("classifyDesc")}</p>
        </div>
      )}
      <div className={`space-y-3 ${projects.length === 1 ? "max-h-[400px] overflow-y-auto" : ""}`}>
        {proj.projektkortData.activities.map((activity) => {
          const cls = proj.activityClassifications[String(activity.number)] || {
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
                    onClick={() => {
                      const updated = { ...proj.activityClassifications };
                      updated[String(activity.number)] = {
                        ...updated[String(activity.number)],
                        billingStatus: status,
                      };
                      updateProject(projIdx, { activityClassifications: updated });
                    }}
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

  const renderInvoicingStep = () => {
    if (!omsaetningData || projects.length === 0) return null;
    // For invoicing, use first project's activities (or all combined)
    const allActivities = projects.flatMap((p) => p.projektkortData.activities);
    const proj = projects[0]; // Invoice mappings stored on first project for now

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
                  proj.invoiceMappings[String(cat.number)] != null
                    ? String(proj.invoiceMappings[String(cat.number)])
                    : ""
                }
                onValueChange={(val) => {
                  const updated = { ...proj.invoiceMappings };
                  updated[String(cat.number)] = val ? parseInt(val) : null;
                  updateProject(0, { invoiceMappings: updated });
                }}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder={t("noActivityMatch")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">
                    {t("noActivityMatch")}
                  </SelectItem>
                  {allActivities.map((act) => (
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
    const totals = computeGrandTotals();
    const mappedEmployeeCount = Object.values(employeeMappings).filter(Boolean).length - skippedEmployees.size;
    const totalActivities = projects.reduce((s, p) => s + p.projektkortData.activities.length, 0);

    return (
      <div className="space-y-4">
        <p className="text-sm font-medium">{t("confirmTitle")}</p>

        {/* Projects summary */}
        {projects.map((proj, idx) => (
          <div key={idx} className="rounded-lg border p-3 space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{proj.projectNumber || `#${idx + 1}`}</Badge>
              <p className="text-sm font-medium">
                {proj.useExisting
                  ? existingProjects.find((p) => p.id === proj.selectedProjectId)?.name || "—"
                  : proj.projectName}
              </p>
            </div>
            {!proj.useExisting && proj.clientName && (
              <p className="text-xs text-muted-foreground">{proj.clientName}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {proj.projektkortData.activities.length} aktiviteter &middot;{" "}
              {proj.projektkortData.totals.registeredHours.toFixed(1)}t
            </p>
          </div>
        ))}

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

        {/* Summary */}
        <div className="text-xs text-muted-foreground space-y-0.5">
          <p>{projects.length} {projects.length === 1 ? "projekt" : "projekter"}</p>
          <p>{mappedEmployeeCount} medarbejdere importeres</p>
          <p>{totalActivities} aktiviteter klassificeret</p>
        </div>

        {importing && (
          <div className="rounded-lg border p-3 bg-blue-50 dark:bg-blue-950/20">
            <p className="text-sm text-blue-600 font-medium">
              Importerer projekt {importProgress} af {projects.length}...
            </p>
          </div>
        )}
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
