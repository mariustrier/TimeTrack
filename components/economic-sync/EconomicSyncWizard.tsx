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
import { matchPhases } from "@/lib/economic-matching";

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
  entryOverrides?: Record<number, "billable" | "nonBillable">;
  phaseId?: string | null;
}

interface CompanyPhase {
  id: string;
  name: string;
  color: string;
  active: boolean;
}

/** Per-project data parsed from a Projektkort file */
interface ProjectFileData {
  file: File;
  projektkortData: ProjektkortData;
  omsaetningFile?: File;
  omsaetningData?: OmsaetningData | null;
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

  // Step 1: Upload — all files in one drop zone
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  // Parsed project data (one per Projektkort file)
  const [projects, setProjects] = useState<ProjectFileData[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [existingProjects, setExistingProjects] = useState<ExistingProject[]>([]);

  // Step 3: Shared employee mappings
  const [employeeMappings, setEmployeeMappings] = useState<Record<string, string>>({});
  const [skippedEmployees, setSkippedEmployees] = useState<Set<string>>(new Set());

  // UI state
  const [expandedProject, setExpandedProject] = useState<number>(0);
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());
  const [companyPhases, setCompanyPhases] = useState<CompanyPhase[]>([]);

  // Derived
  const hasOmsaetning = projects.some((p) => !!p.omsaetningData);
  const visibleSteps = STEPS.filter((s) => s.key !== "invoicing" || hasOmsaetning);
  const currentStepKey = visibleSteps[step]?.key || "upload";

  const resetWizard = () => {
    setStep(0);
    setUploadedFiles([]);
    setProjects([]);
    setTeam([]);
    setExistingProjects([]);
    setEmployeeMappings({});
    setSkippedEmployees(new Set());
    setExpandedProject(0);
    setExpandedActivities(new Set());
    setCompanyPhases([]);
    setImportProgress(0);
  };

  // --- Step 1: Upload & Parse ---
  const addFiles = useCallback((files: FileList | File[]) => {
    const newFiles = Array.from(files).filter(
      (f) => f.name.endsWith(".xlsx") || f.name.endsWith(".xls")
    );
    setUploadedFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleParse = async () => {
    if (uploadedFiles.length === 0) return;
    setLoading(true);

    try {
      // Classify files: Projektkort vs Omsætningsstatistik by filename
      const projektkortFiles: File[] = [];
      const omsaetningFiles: File[] = [];
      for (const file of uploadedFiles) {
        const lower = file.name.toLowerCase();
        if (lower.includes("omsætning") || lower.includes("omsaetning") || lower.includes("revenue")) {
          omsaetningFiles.push(file);
        } else {
          projektkortFiles.push(file);
        }
      }

      if (projektkortFiles.length === 0) {
        toast.error(t("parseError"));
        setLoading(false);
        return;
      }

      const parsedProjects: ProjectFileData[] = [];
      const allEmployeeMappings: Record<string, string> = {};

      // Parse each Projektkort via the API
      for (const file of projektkortFiles) {
        const formData = new FormData();
        formData.append("projektkort", file);
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
          clientName: projektkortData.companyName || "",
          activityClassifications: classifications,
          invoiceMappings: {},
          suggestedEmployeeMappings: result.suggestedMappings?.employees || [],
        });
      }

      if (parsedProjects.length === 0) {
        toast.error(t("parseError"));
        setLoading(false);
        return;
      }

      // Match Omsætningsstatistik files to projects by project number in filename
      for (const oFile of omsaetningFiles) {
        const formData = new FormData();
        // Send a dummy projektkort (we only need omsaetning parsing)
        // Actually, send it as omsaetning to the first projektkort
        formData.append("projektkort", projektkortFiles[0]);
        formData.append("omsaetning", oFile);

        const res = await fetch("/api/projects/import/economic-sync", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) continue;
        const result = await res.json();
        if (!result.omsaetningData) continue;

        const omsData = result.omsaetningData as OmsaetningData;

        // Match to project by project number in filename
        const numMatch = oFile.name.match(/(\d{4,})/);
        const fileProjectNum = numMatch?.[1] || "";

        let matched = false;
        if (fileProjectNum) {
          const proj = parsedProjects.find((p) => p.projectNumber === fileProjectNum);
          if (proj) {
            proj.omsaetningData = omsData;
            proj.omsaetningFile = oFile;
            // Build invoice mappings from suggestions
            if (result.suggestedMappings?.invoiceCategories) {
              const iMappings: Record<string, number | null> = {};
              result.suggestedMappings.invoiceCategories.forEach(
                (m: { categoryNumber: number; suggestedActivityNumber: number | null }) => {
                  iMappings[String(m.categoryNumber)] = m.suggestedActivityNumber;
                }
              );
              proj.invoiceMappings = iMappings;
            }
            matched = true;
          }
        }

        // If no match by number, assign to first project without omsaetning
        if (!matched) {
          const proj = parsedProjects.find((p) => !p.omsaetningData);
          if (proj) {
            proj.omsaetningData = omsData;
            proj.omsaetningFile = oFile;
          }
        }
      }

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

      // Fetch company phases for activity mapping
      const phaseRes = await fetch("/api/admin/phases");
      if (phaseRes.ok) {
        const phaseData = await phaseRes.json();
        const activePhases = phaseData.filter((p: CompanyPhase) => p.active);
        setCompanyPhases(activePhases);

        // Auto-suggest phase mappings for all projects
        if (activePhases.length > 0) {
          parsedProjects.forEach((proj) => {
            const actInfos = proj.projektkortData.activities.map((a) => ({
              number: a.number,
              name: a.name,
            }));
            const suggestions = matchPhases(actInfos, activePhases);
            Object.entries(suggestions).forEach(([numStr, phaseId]) => {
              if (proj.activityClassifications[numStr]) {
                proj.activityClassifications[numStr] = {
                  ...proj.activityClassifications[numStr],
                  phaseId,
                };
              }
            });
          });
        }
      }

      setProjects(parsedProjects);
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

        if (proj.omsaetningData) {
          body.omsaetningData = proj.omsaetningData;
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
    if (currentStepKey === "upload") return uploadedFiles.length > 0;
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

  // --- Entry-level billing helpers ---
  const getEntryBillingStatus = (
    proj: ProjectFileData,
    activityNumber: number,
    entryIdx: number,
    entry: { salgspris: number }
  ): "billable" | "nonBillable" => {
    const cls = proj.activityClassifications[String(activityNumber)];
    if (!cls) return "nonBillable";
    const override = cls.entryOverrides?.[entryIdx];
    if (override) return override;
    if (cls.billingStatus === "billable") return "billable";
    if (cls.billingStatus === "nonBillable") return "nonBillable";
    // mixed: use salgspris
    return entry.salgspris > 0 ? "billable" : "nonBillable";
  };

  const toggleEntryBillingStatus = (
    projIdx: number,
    activityNumber: number,
    entryIdx: number,
    entry: { salgspris: number },
    allEntries: { salgspris: number }[]
  ) => {
    const proj = projects[projIdx];
    const actKey = String(activityNumber);
    const cls = proj.activityClassifications[actKey];
    if (!cls) return;

    // Current effective status → flip it
    const current = getEntryBillingStatus(proj, activityNumber, entryIdx, entry);
    const newStatus: "billable" | "nonBillable" = current === "billable" ? "nonBillable" : "billable";

    // Default for this entry (what it would be without an override)
    let defaultStatus: "billable" | "nonBillable";
    if (cls.billingStatus === "billable") defaultStatus = "billable";
    else if (cls.billingStatus === "nonBillable") defaultStatus = "nonBillable";
    else defaultStatus = entry.salgspris > 0 ? "billable" : "nonBillable";

    // Build new overrides
    const newOverrides: Record<number, "billable" | "nonBillable"> = { ...(cls.entryOverrides || {}) };
    if (newStatus === defaultStatus) {
      delete newOverrides[entryIdx];
    } else {
      newOverrides[entryIdx] = newStatus;
    }

    // Check ALL entries' effective status with the new overrides
    let allBillable = true;
    let allNonBillable = true;
    allEntries.forEach((e, idx) => {
      const ov = newOverrides[idx];
      let effectiveStatus: "billable" | "nonBillable";
      if (ov) {
        effectiveStatus = ov;
      } else if (cls.billingStatus === "billable") {
        effectiveStatus = "billable";
      } else if (cls.billingStatus === "nonBillable") {
        effectiveStatus = "nonBillable";
      } else {
        effectiveStatus = e.salgspris > 0 ? "billable" : "nonBillable";
      }
      if (effectiveStatus !== "billable") allBillable = false;
      if (effectiveStatus !== "nonBillable") allNonBillable = false;
    });

    // Auto-switch classification if all entries are now uniform
    const updated = { ...proj.activityClassifications };
    if (allBillable) {
      updated[actKey] = { ...cls, billingStatus: "billable", entryOverrides: undefined };
    } else if (allNonBillable) {
      updated[actKey] = { ...cls, billingStatus: "nonBillable", entryOverrides: undefined };
    } else {
      updated[actKey] = { ...cls, billingStatus: "mixed", entryOverrides: newOverrides };
    }
    updateProject(projIdx, { activityClassifications: updated });
  };

  // --- Totals ---
  const computeGrandTotals = () => {
    let total = 0, billable = 0, nonBillable = 0, entries = 0;
    projects.forEach((proj) => {
      proj.projektkortData.activities.forEach((act) => {
        act.entries.forEach((entry, entryIdx) => {
          if (skippedEmployees.has(entry.employeeName) || !employeeMappings[entry.employeeName]) return;
          entries++;
          total += entry.hours;
          const status = getEntryBillingStatus(proj, act.number, entryIdx, entry);
          if (status === "billable") billable += entry.hours;
          else nonBillable += entry.hours;
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

  const renderUploadStep = () => {
    // Classify uploaded files by type for display
    const projektkortCount = uploadedFiles.filter((f) => {
      const l = f.name.toLowerCase();
      return !l.includes("omsætning") && !l.includes("omsaetning") && !l.includes("revenue");
    }).length;
    const omsaetningCount = uploadedFiles.length - projektkortCount;

    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("description")}</p>

        {/* Unified drop zone for all files */}
        <div className="space-y-2">
          <Label className="font-medium">
            Upload filer
          </Label>
          <p className="text-xs text-muted-foreground">
            Træk alle Projektkort- og Omsætningsstatistik-filer herind. Filerne matches automatisk efter projektnummer.
          </p>
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              uploadedFiles.length > 0
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
            {uploadedFiles.length > 0 ? (
              <div className="space-y-1.5">
                {uploadedFiles.map((file, idx) => {
                  const lower = file.name.toLowerCase();
                  const isOms = lower.includes("omsætning") || lower.includes("omsaetning") || lower.includes("revenue");
                  return (
                    <div key={idx} className="flex items-center justify-center gap-2">
                      <FileSpreadsheet className={`h-4 w-4 flex-shrink-0 ${isOms ? "text-blue-500" : "text-green-600"}`} />
                      <span className={`text-sm font-medium truncate max-w-[300px] ${isOms ? "text-blue-600" : "text-green-600"}`}>
                        {file.name}
                      </span>
                      <Badge variant="outline" className="text-xs flex-shrink-0">
                        {isOms ? "Omsætning" : "Projektkort"}
                      </Badge>
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
                  );
                })}
                <p className="text-xs text-muted-foreground mt-2">
                  {projektkortCount} projektkort{omsaetningCount > 0 ? `, ${omsaetningCount} omsætningsstatistik` : ""} — klik eller træk for at tilføje flere
                </p>
              </div>
            ) : (
              <div>
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Træk og slip Projektkort + Omsætningsstatistik filer her
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Flere projekter ad gangen — filerne matches automatisk
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderProjectStep = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {projects.length === 1
          ? t("projectSetup")
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
                        <SelectContent position="popper" className="max-h-[300px] overflow-y-auto">
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
                            placeholder={t("projectNamePlaceholder")}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{t("projectNumber")}</Label>
                          <Input
                            value={proj.projectNumber}
                            onChange={(e) => updateProject(idx, { projectNumber: e.target.value })}
                            placeholder={t("projectNumberPlaceholder")}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t("clientName")}</Label>
                        <Input
                          value={proj.clientName}
                          onChange={(e) => updateProject(idx, { clientName: e.target.value })}
                          placeholder={t("clientNamePlaceholder")}
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
                  <SelectContent position="popper" className="max-h-[300px] overflow-y-auto">
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

              {cls.billingStatus === "mixed" && (() => {
                let bH = 0, nbH = 0;
                activity.entries.forEach((e, idx) => {
                  const s = getEntryBillingStatus(proj, activity.number, idx, e);
                  if (s === "billable") bH += e.hours; else nbH += e.hours;
                });
                return (
                  <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-2 rounded">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                    {t("mixedSummary")
                      .replace("{billable}", bH.toFixed(1))
                      .replace("{nonBillable}", nbH.toFixed(1))}
                  </div>
                );
              })()}

              <div className="flex gap-2">
                {(["billable", "nonBillable", "mixed"] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      const updated = { ...proj.activityClassifications };
                      updated[String(activity.number)] = {
                        ...updated[String(activity.number)],
                        billingStatus: status,
                        // Clear overrides when switching to billable/nonBillable; preserve for mixed
                        entryOverrides: status === "mixed"
                          ? updated[String(activity.number)]?.entryOverrides
                          : undefined,
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

              {/* Phase mapping dropdown */}
              {companyPhases.length > 0 && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">{t("phase")}</Label>
                  <Select
                    value={cls.phaseId || "none"}
                    onValueChange={(val) => {
                      const updated = { ...proj.activityClassifications };
                      updated[String(activity.number)] = {
                        ...updated[String(activity.number)],
                        phaseId: val === "none" ? null : val,
                      };
                      updateProject(projIdx, { activityClassifications: updated });
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs w-[200px]">
                      <SelectValue placeholder={t("noPhase")} />
                    </SelectTrigger>
                    <SelectContent position="popper" className="max-h-[300px] overflow-y-auto">
                      <SelectItem value="none">{t("noPhase")}</SelectItem>
                      {companyPhases.map((phase) => (
                        <SelectItem key={phase.id} value={phase.id}>
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: phase.color }} />
                            {phase.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Expandable per-entry table */}
              {(() => {
                const actKey = `${projIdx}-${activity.number}`;
                const isExpanded = expandedActivities.has(actKey);
                return (
                  <>
                    <button
                      onClick={() => {
                        setExpandedActivities((prev) => {
                          const next = new Set(Array.from(prev));
                          if (next.has(actKey)) next.delete(actKey);
                          else next.add(actKey);
                          return next;
                        });
                      }}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                      {isExpanded
                        ? t("hideEntries")
                        : t("showEntries").replace("{count}", String(activity.entries.length))}
                    </button>
                    {isExpanded && (
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="py-1 pr-2 font-medium w-5"></th>
                            <th className="py-1 pr-2 font-medium">Dato</th>
                            <th className="py-1 pr-2 font-medium">{t("employee")}</th>
                            <th className="py-1 pr-2 font-medium text-right">{t("hours")}</th>
                            <th className="py-1 font-medium text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activity.entries.map((entry, entryIdx) => {
                            const entryStatus = getEntryBillingStatus(proj, activity.number, entryIdx, entry);
                            const isBillable = entryStatus === "billable";
                            return (
                              <tr key={entryIdx} className="border-b border-muted/50 last:border-0">
                                <td className="py-1.5 pr-2">
                                  <span
                                    className={`inline-block w-2 h-2 rounded-full ${
                                      isBillable ? "bg-green-500" : "bg-red-500"
                                    }`}
                                  />
                                </td>
                                <td className="py-1.5 pr-2 text-muted-foreground">{entry.date}</td>
                                <td className="py-1.5 pr-2 truncate max-w-[120px]">{entry.employeeName}</td>
                                <td className="py-1.5 pr-2 text-right tabular-nums">{entry.hours.toFixed(1)}</td>
                                <td className="py-1.5 text-right">
                                  <button
                                    onClick={() =>
                                      toggleEntryBillingStatus(
                                        projIdx,
                                        activity.number,
                                        entryIdx,
                                        entry,
                                        activity.entries
                                      )
                                    }
                                    title={t("clickToChange")}
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                                      isBillable
                                        ? "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/60"
                                        : "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60"
                                    }`}
                                  >
                                    {isBillable ? t("billable") : t("internal")}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderInvoicingStep = () => {
    const projectsWithOms = projects.filter((p) => !!p.omsaetningData);
    if (projectsWithOms.length === 0) return null;

    // Collect ALL activities from ALL Projektkort files, deduplicated by number
    const activityMap = new Map<number, { number: number; name: string }>();
    projects.forEach((p) => {
      p.projektkortData.activities.forEach((a) => {
        if (!activityMap.has(a.number)) {
          activityMap.set(a.number, { number: a.number, name: a.name });
        }
      });
    });
    const allActivities = Array.from(activityMap.values()).sort((a, b) => a.number - b.number);

    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium">{t("mapInvoiceCategories")}</p>
          <p className="text-xs text-muted-foreground">{t("mapInvoiceDesc")}</p>
        </div>
        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {projectsWithOms.map((proj) => {
            const projIdx = projects.indexOf(proj);
            const omsData = proj.omsaetningData!;
            return (
              <div key={projIdx} className="space-y-2">
                {projectsWithOms.length > 1 && (
                  <p className="text-sm font-medium text-muted-foreground border-b pb-1">
                    {proj.projectName || proj.projectNumber}
                  </p>
                )}
                {omsData.categories.map((cat) => (
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
                          : "none"
                      }
                      onValueChange={(val) => {
                        const updated = { ...proj.invoiceMappings };
                        updated[String(cat.number)] = val && val !== "none" ? parseInt(val) : null;
                        updateProject(projIdx, { invoiceMappings: updated });
                      }}
                    >
                      <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder={t("noActivityMatch")} />
                      </SelectTrigger>
                      <SelectContent position="popper" className="max-h-[300px] overflow-y-auto">
                        <SelectItem value="none">
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
                {omsData.totals && (
                  <div className="text-right text-xs font-medium text-muted-foreground">
                    Total: {omsData.totals.hours.toFixed(1)}t &middot;{" "}
                    {omsData.totals.revenue.toLocaleString("da-DK")} kr
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
                {tc("back")}
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
                    {tc("next")}
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
