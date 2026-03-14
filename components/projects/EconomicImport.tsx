"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Upload,
  FileSpreadsheet,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Check,
  Users,
  Layers,
  Settings,
  ClipboardList,
  Tag,
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
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useTranslations } from "@/lib/i18n";
import { parseEconomicFile, type EconomicImportData, type EconomicTimeEntry } from "@/lib/economic-import";

interface TeamMember {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

interface Phase {
  id: string;
  name: string;
  color?: string;
}

interface ExistingProject {
  id: string;
  name: string;
}

interface ActivityClassification {
  billingStatus: "billable" | "nonBillable" | "mixed";
  entryOverrides: Record<number, "billable" | "nonBillable">;
}

const COLORS = [
  "#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6",
  "#EC4899", "#06B6D4", "#F97316", "#6366F1", "#14B8A6",
];

interface EconomicImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EconomicImport({ open, onOpenChange, onSuccess }: EconomicImportProps) {
  const t = useTranslations("economicImport");
  const tc = useTranslations("common");

  const [step, setStep] = useState(1);
  const [importData, setImportData] = useState<EconomicImportData | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseError, setParseError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Employee mapping
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [employeeMappings, setEmployeeMappings] = useState<Record<string, string>>({});

  // Step 3: Category → Phase mapping
  const [phases, setPhases] = useState<Phase[]>([]);
  const [companyPhasesEnabled, setCompanyPhasesEnabled] = useState(false);
  const [categoryMappings, setCategoryMappings] = useState<Record<number, string>>({});

  // Step 4: Project settings
  const [projectName, setProjectName] = useState("");
  const [projectClient, setProjectClient] = useState("");
  const [projectColor, setProjectColor] = useState("#3B82F6");
  const [projectBudgetHours, setProjectBudgetHours] = useState("");
  const [existingProjectId, setExistingProjectId] = useState("");
  const [existingProjects, setExistingProjects] = useState<ExistingProject[]>([]);

  // Step 4 (new): Classify Activities
  const [activityClassifications, setActivityClassifications] = useState<Record<number, ActivityClassification>>({});
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [classificationsInitialized, setClassificationsInitialized] = useState(false);

  // Step 6 (was 5): Import
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    project: { id: string; name: string };
    stats: { entries: number; employees: number; hours: number };
  } | null>(null);

  // Fetch team members and phases when dialog opens
  useEffect(() => {
    if (!open) return;
    fetch("/api/team")
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setTeamMembers(data))
      .catch(() => {});

    fetch("/api/admin/economic")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.phasesEnabled) {
          setCompanyPhasesEnabled(true);
          fetch("/api/admin/phases")
            .then((res) => res.ok ? res.json() : [])
            .then((p) => setPhases(p.filter((ph: Phase & { active: boolean }) => ph.active)))
            .catch(() => {});
        }
      })
      .catch(() => {});

    fetch("/api/projects")
      .then((res) => res.ok ? res.json() : [])
      .then((data) =>
        setExistingProjects(
          data
            .filter((p: { systemManaged?: boolean }) => !p.systemManaged)
            .map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))
        )
      )
      .catch(() => {});
  }, [open]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setStep(1);
      setImportData(null);
      setSelectedFile(null);
      setParseError("");
      setEmployeeMappings({});
      setCategoryMappings({});
      setProjectName("");
      setProjectClient("");
      setProjectColor("#3B82F6");
      setProjectBudgetHours("");
      setExistingProjectId("");
      setImporting(false);
      setImportResult(null);
      setActivityClassifications({});
      setExpandedCategories(new Set());
      setClassificationsInitialized(false);
    }
  }, [open]);

  const handleFile = useCallback(
    async (file: File) => {
      setParseError("");
      if (!file.name.endsWith(".xlsx")) {
        setParseError(t("invalidFile"));
        return;
      }
      try {
        const buffer = await file.arrayBuffer();
        const data = parseEconomicFile(buffer);
        setSelectedFile(file);
        setImportData(data);
        setProjectName(`${data.projectNumber} - ${data.projectName}`);
        setProjectBudgetHours(data.totalHours.toFixed(1));

        // Auto-match employees
        const autoMap: Record<string, string> = {};
        for (const empName of data.uniqueEmployees) {
          const lower = empName.toLowerCase();
          const match = teamMembers.find((m) => {
            const fullName = `${m.firstName || ""} ${m.lastName || ""}`.toLowerCase().trim();
            return (
              fullName === lower ||
              fullName.includes(lower) ||
              lower.includes(fullName) ||
              (m.firstName && lower.includes(m.firstName.toLowerCase())) ||
              (m.lastName && lower.includes(m.lastName.toLowerCase()))
            );
          });
          if (match) autoMap[empName] = match.id;
        }
        setEmployeeMappings(autoMap);

        // Auto-match categories to phases
        if (phases.length > 0) {
          const autoCatMap: Record<number, string> = {};
          for (const cat of data.taskCategories) {
            const catLower = cat.name.toLowerCase();
            const match = phases.find(
              (p) =>
                p.name.toLowerCase() === catLower ||
                p.name.toLowerCase().includes(catLower) ||
                catLower.includes(p.name.toLowerCase())
            );
            if (match) autoCatMap[cat.number] = match.id;
          }
          setCategoryMappings(autoCatMap);
        }
      } catch (err) {
        setParseError(err instanceof Error ? err.message : t("invalidFile"));
      }
    },
    [teamMembers, phases, t]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const mappedCount = useMemo(
    () => Object.values(employeeMappings).filter(Boolean).length,
    [employeeMappings]
  );

  const unmappedCount = useMemo(
    () => (importData?.uniqueEmployees.length || 0) - mappedCount,
    [importData, mappedCount]
  );

  const entriesToImport = useMemo(() => {
    if (!importData) return 0;
    return importData.timeEntries.filter(
      (e) => !!employeeMappings[e.employeeName]
    ).length;
  }, [importData, employeeMappings]);

  const hoursToImport = useMemo(() => {
    if (!importData) return 0;
    return importData.timeEntries
      .filter((e) => !!employeeMappings[e.employeeName])
      .reduce((sum, e) => sum + e.hours, 0);
  }, [importData, employeeMappings]);

  // Entries per category, filtered by mapped employees
  const categoryEntriesMap = useMemo(() => {
    if (!importData) return new Map<number, EconomicTimeEntry[]>();
    const map = new Map<number, EconomicTimeEntry[]>();
    for (const cat of importData.taskCategories) {
      const entries = importData.timeEntries.filter(
        (e) => e.categoryNumber === cat.number && !!employeeMappings[e.employeeName]
      );
      map.set(cat.number, entries);
    }
    return map;
  }, [importData, employeeMappings]);

  const totalSteps = companyPhasesEnabled ? 6 : 5;

  const effectiveStep = useMemo(() => {
    // If phases disabled, skip step 3
    if (!companyPhasesEnabled && step >= 3) return step + 1;
    return step;
  }, [step, companyPhasesEnabled]);

  // Auto-classify activities when entering classify step
  useEffect(() => {
    if (effectiveStep !== 4 || !importData || classificationsInitialized) return;
    const classifications: Record<number, ActivityClassification> = {};
    for (const cat of importData.taskCategories) {
      const entries = categoryEntriesMap.get(cat.number) || [];
      const withSales = entries.filter((e) => e.salesPrice > 0).length;
      const total = entries.length;
      if (total === 0 || withSales === 0) {
        classifications[cat.number] = { billingStatus: "nonBillable", entryOverrides: {} };
      } else if (withSales === total) {
        classifications[cat.number] = { billingStatus: "billable", entryOverrides: {} };
      } else {
        const overrides: Record<number, "billable" | "nonBillable"> = {};
        entries.forEach((e, i) => {
          overrides[i] = e.salesPrice > 0 ? "billable" : "nonBillable";
        });
        classifications[cat.number] = { billingStatus: "mixed", entryOverrides: overrides };
      }
    }
    setActivityClassifications(classifications);
    setClassificationsInitialized(true);
  }, [effectiveStep, importData, categoryEntriesMap, classificationsInitialized]);

  function getEffectiveEntryStatus(
    classification: ActivityClassification | undefined,
    entryIndex: number,
    entry: EconomicTimeEntry
  ): "billable" | "nonBillable" {
    if (!classification) return entry.salesPrice > 0 ? "billable" : "nonBillable";
    if (classification.entryOverrides[entryIndex] !== undefined) {
      return classification.entryOverrides[entryIndex];
    }
    if (classification.billingStatus === "billable") return "billable";
    if (classification.billingStatus === "nonBillable") return "nonBillable";
    return entry.salesPrice > 0 ? "billable" : "nonBillable";
  }

  function handleSetBillingStatus(catNumber: number, status: "billable" | "nonBillable" | "mixed") {
    setActivityClassifications((prev) => {
      const entries = categoryEntriesMap.get(catNumber) || [];
      const newOverrides: Record<number, "billable" | "nonBillable"> = {};
      if (status === "mixed") {
        entries.forEach((e, i) => {
          newOverrides[i] = e.salesPrice > 0 ? "billable" : "nonBillable";
        });
      }
      return { ...prev, [catNumber]: { billingStatus: status, entryOverrides: newOverrides } };
    });
  }

  function handleToggleEntry(catNumber: number, entryIndex: number) {
    setActivityClassifications((prev) => {
      const cat = prev[catNumber];
      if (!cat) return prev;
      const entries = categoryEntriesMap.get(catNumber) || [];
      const entry = entries[entryIndex];
      if (!entry) return prev;

      const newOverrides = { ...cat.entryOverrides };

      // Determine current effective status
      let currentStatus: "billable" | "nonBillable";
      if (newOverrides[entryIndex] !== undefined) {
        currentStatus = newOverrides[entryIndex];
      } else if (cat.billingStatus === "billable") {
        currentStatus = "billable";
      } else if (cat.billingStatus === "nonBillable") {
        currentStatus = "nonBillable";
      } else {
        currentStatus = entry.salesPrice > 0 ? "billable" : "nonBillable";
      }

      // Toggle
      newOverrides[entryIndex] = currentStatus === "billable" ? "nonBillable" : "billable";

      // Ensure all entries have overrides
      entries.forEach((e, i) => {
        if (newOverrides[i] === undefined) {
          if (cat.billingStatus === "billable") newOverrides[i] = "billable";
          else if (cat.billingStatus === "nonBillable") newOverrides[i] = "nonBillable";
          else newOverrides[i] = e.salesPrice > 0 ? "billable" : "nonBillable";
        }
      });

      // Auto-detect if all same
      const allBillable = Object.values(newOverrides).every((v) => v === "billable");
      const allNonBillable = Object.values(newOverrides).every((v) => v === "nonBillable");
      let newStatus: "billable" | "nonBillable" | "mixed";
      if (allBillable) newStatus = "billable";
      else if (allNonBillable) newStatus = "nonBillable";
      else newStatus = "mixed";

      return {
        ...prev,
        [catNumber]: {
          billingStatus: newStatus,
          entryOverrides: newStatus === "billable" || newStatus === "nonBillable" ? {} : newOverrides,
        },
      };
    });
  }

  function handleToggleExpand(catNumber: number) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catNumber)) next.delete(catNumber);
      else next.add(catNumber);
      return next;
    });
  }

  async function handleImport() {
    if (!importData) return;
    setImporting(true);

    try {
      if (!selectedFile) {
        toast.error(t("noFile"));
        setImporting(false);
        return;
      }

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append(
        "mappings",
        JSON.stringify({
          employees: employeeMappings,
          categories: categoryMappings,
        })
      );
      formData.append(
        "projectSettings",
        JSON.stringify({
          name: projectName,
          client: projectClient || undefined,
          color: projectColor,
          budgetHours: projectBudgetHours
            ? parseFloat(projectBudgetHours)
            : undefined,
          existingProjectId: existingProjectId || undefined,
        })
      );
      formData.append(
        "activityClassifications",
        JSON.stringify(activityClassifications)
      );

      const res = await fetch("/api/projects/import", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || t("importFailed"));
        setImporting(false);
        return;
      }

      const result = await res.json();
      setImportResult(result);
      toast.success(
        t("successMessage")
          .replace("{entries}", String(result.stats.entries))
          .replace("{employees}", String(result.stats.employees))
      );
      onSuccess();
    } catch {
      toast.error(t("importFailed"));
    } finally {
      setImporting(false);
    }
  }

  function getTeamMemberName(member: TeamMember) {
    const name = `${member.firstName || ""} ${member.lastName || ""}`.trim();
    return name || member.email;
  }

  function getEmployeeStats(empName: string) {
    if (!importData) return { hours: 0, entries: 0 };
    const entries = importData.timeEntries.filter(
      (e) => e.employeeName === empName
    );
    return {
      hours: entries.reduce((s, e) => s + e.hours, 0),
      entries: entries.length,
    };
  }

  // Step navigation labels
  const stepLabels = [
    { icon: Upload, label: t("uploadStep") },
    { icon: Users, label: t("mapEmployees") },
    ...(companyPhasesEnabled
      ? [{ icon: Layers, label: t("mapCategories") }]
      : []),
    { icon: Tag, label: t("classifyStep") },
    { icon: Settings, label: t("projectSettings") },
    { icon: ClipboardList, label: t("review") },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {t("title")}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-4">
          {stepLabels.map((s, i) => (
            <div key={i} className="flex items-center gap-1">
              {i > 0 && <div className="w-4 h-px bg-border" />}
              <div
                className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                  i + 1 === step
                    ? "bg-primary text-primary-foreground"
                    : i + 1 < step
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1 < step ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <s.icon className="h-3 w-3" />
                )}
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sm:hidden">{i + 1}</span>
              </div>
            </div>
          ))}
        </div>

        {/* STEP 1: Upload */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("uploadDescription")}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t("dropzone")}</p>
            </div>

            {parseError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 p-3 rounded-md">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                {parseError}
              </div>
            )}

            {importData && (
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-green-600" />
                  <span className="font-medium">{t("fileAccepted")}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t("projectName")}: </span>
                    <span className="font-medium">{importData.projectName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("projectNumber")}: </span>
                    <span className="font-medium">{importData.projectNumber}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("totalHours")}: </span>
                    <span className="font-medium">{importData.totalHours.toFixed(1)}{tc("hourAbbrev")}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("totalEntries")}: </span>
                    <span className="font-medium">{importData.timeEntries.length}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("employees")}: </span>
                    <span className="font-medium">{importData.uniqueEmployees.length}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("categories")}: </span>
                    <span className="font-medium">{importData.taskCategories.length}</span>
                  </div>
                  {importData.totalInvoiced > 0 && (
                    <div>
                      <span className="text-muted-foreground">{t("invoiceTotal")}: </span>
                      <span className="font-medium">
                        {importData.totalInvoiced.toLocaleString()} DKK
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Map Employees */}
        {step === 2 && importData && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("mapEmployeesDesc")}
            </p>
            {unmappedCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 p-3 rounded-md">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                {t("unmappedWarning").replace("{count}", String(unmappedCount))}
              </div>
            )}
            <div className="space-y-3 max-h-[40vh] overflow-y-auto">
              {importData.uniqueEmployees.map((empName) => {
                const stats = getEmployeeStats(empName);
                return (
                  <div
                    key={empName}
                    className="flex items-center gap-3 border rounded-md p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{empName}</p>
                      <p className="text-xs text-muted-foreground">
                        {stats.hours.toFixed(1)}{tc("hourAbbrev")} &middot; {stats.entries} {t("entriesLabel")}
                      </p>
                    </div>
                    <Select
                      value={employeeMappings[empName] || "skip"}
                      onValueChange={(val) =>
                        setEmployeeMappings((prev) => ({
                          ...prev,
                          [empName]: val === "skip" ? "" : val,
                        }))
                      }
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="skip">{t("skipEmployee")}</SelectItem>
                        {teamMembers.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {getTeamMemberName(m)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: Map Categories to Phases (only if phases enabled) */}
        {effectiveStep === 3 && companyPhasesEnabled && importData && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("mapCategoriesDesc")}
            </p>
            <div className="space-y-3 max-h-[40vh] overflow-y-auto">
              {importData.taskCategories.map((cat) => (
                <div
                  key={cat.number}
                  className="flex items-center gap-3 border rounded-md p-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">
                      {cat.number} - {cat.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {cat.subtotalHours.toFixed(1)}{tc("hourAbbrev")}
                    </p>
                  </div>
                  <Select
                    value={categoryMappings[cat.number] || "skip"}
                    onValueChange={(val) =>
                      setCategoryMappings((prev) => ({
                        ...prev,
                        [cat.number]: val === "skip" ? "" : val,
                      }))
                    }
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip">{t("skipCategory")}</SelectItem>
                      {phases.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 4: Classify Activities */}
        {effectiveStep === 4 && importData && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("classifyDesc")}
            </p>
            <div className="space-y-3 max-h-[50vh] overflow-y-auto">
              {importData.taskCategories.map((cat) => {
                const entries = categoryEntriesMap.get(cat.number) || [];
                const withSales = entries.filter((e) => e.salesPrice > 0).length;
                const classification = activityClassifications[cat.number];
                const expanded = expandedCategories.has(cat.number);

                // Compute billable/non-billable hours
                let billableHours = 0;
                let nonBillableHours = 0;
                entries.forEach((entry, i) => {
                  const status = getEffectiveEntryStatus(classification, i, entry);
                  if (status === "billable") billableHours += entry.hours;
                  else nonBillableHours += entry.hours;
                });

                return (
                  <div key={cat.number} className="border rounded-lg p-4 space-y-3">
                    {/* Header */}
                    <div>
                      <p className="font-medium text-sm">{cat.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(entries.reduce((s, e) => s + e.hours, 0)).toFixed(1)}{tc("hourAbbrev")}
                        {" · "}
                        {withSales} af {entries.length} entries har salgspris &gt; 0
                      </p>
                    </div>

                    {/* Billing status selector */}
                    <div className="flex gap-1">
                      {(["billable", "nonBillable", "mixed"] as const).map((status) => {
                        const active = classification?.billingStatus === status;
                        const label = status === "billable"
                          ? t("classifyBillable")
                          : status === "nonBillable"
                          ? t("classifyNonBillable")
                          : t("classifyMixed");
                        return (
                          <button
                            key={status}
                            onClick={() => handleSetBillingStatus(cat.number, status)}
                            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                              active
                                ? status === "billable"
                                  ? "bg-green-100 border-green-300 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-400"
                                  : status === "nonBillable"
                                  ? "bg-red-100 border-red-300 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-400"
                                  : "bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-400"
                                : "bg-muted border-border text-muted-foreground hover:bg-accent"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Mixed warning banner */}
                    {classification?.billingStatus === "mixed" && (
                      <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 px-3 py-2 rounded-md">
                        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                        {t("classifyMixedBreakdown")
                          .replace("{billable}", billableHours.toFixed(1))
                          .replace("{nonBillable}", nonBillableHours.toFixed(1))}
                      </div>
                    )}

                    {/* Expandable entry list */}
                    {entries.length > 0 && (
                      <>
                        <button
                          onClick={() => handleToggleExpand(cat.number)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          {expanded
                            ? t("classifyHideEntries")
                            : t("classifyShowEntries").replace("{count}", String(entries.length))}
                        </button>

                        {expanded && (
                          <div className="border rounded-md divide-y">
                            {entries.map((entry, i) => {
                              const entryStatus = getEffectiveEntryStatus(classification, i, entry);
                              return (
                                <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                                  <div
                                    className={`h-2 w-2 rounded-full flex-shrink-0 ${
                                      entryStatus === "billable" ? "bg-green-500" : "bg-red-500"
                                    }`}
                                  />
                                  <span className="text-muted-foreground w-[72px]">{entry.date}</span>
                                  <span className="flex-1 truncate">{entry.employeeName}</span>
                                  <span className="text-muted-foreground w-[40px] text-right">
                                    {entry.hours.toFixed(1)}{tc("hourAbbrev")}
                                  </span>
                                  <button
                                    onClick={() => handleToggleEntry(cat.number, i)}
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
                                      entryStatus === "billable"
                                        ? "bg-green-100 border-green-300 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:border-green-700 dark:text-green-400"
                                        : "bg-red-100 border-red-300 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:border-red-700 dark:text-red-400"
                                    }`}
                                  >
                                    {entryStatus === "billable" ? t("classifyBillable") : t("classifyInternal")}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 5: Project Settings */}
        {effectiveStep === 5 && importData && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("existingProject")}</Label>
              <Select
                value={existingProjectId || "new"}
                onValueChange={(val) =>
                  setExistingProjectId(val === "new" ? "" : val)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">{t("createNew")}</SelectItem>
                  {existingProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!existingProjectId && (
              <>
                <div className="space-y-2">
                  <Label>{t("projectName")}</Label>
                  <Input
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("clientName")}</Label>
                  <Input
                    value={projectClient}
                    onChange={(e) => setProjectClient(e.target.value)}
                    placeholder={t("clientPlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("color")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setProjectColor(c)}
                        className={`h-8 w-8 rounded-full border-2 transition-all ${
                          projectColor === c
                            ? "border-foreground scale-110"
                            : "border-transparent"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("budgetHoursLabel")}</Label>
                  <Input
                    type="number"
                    value={projectBudgetHours}
                    onChange={(e) => setProjectBudgetHours(e.target.value)}
                  />
                </div>
              </>
            )}

            <Separator />
            <div className="text-sm text-muted-foreground">
              {t("importSummary")
                .replace("{entries}", String(entriesToImport))
                .replace("{employees}", String(mappedCount))
                .replace("{categories}", String(importData.taskCategories.length))
                .replace("{hours}", hoursToImport.toFixed(1))}
            </div>
          </div>
        )}

        {/* STEP 6: Review & Confirm */}
        {effectiveStep === 6 && importData && !importResult && (
          <div className="space-y-4">
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-medium">{t("reviewSummary")}</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">{t("projectName")}: </span>
                  <span className="font-medium">
                    {existingProjectId
                      ? existingProjects.find((p) => p.id === existingProjectId)?.name
                      : projectName}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("totalEntries")}: </span>
                  <span className="font-medium">{entriesToImport}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("employees")}: </span>
                  <span className="font-medium">{mappedCount}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("totalHours")}: </span>
                  <span className="font-medium">{hoursToImport.toFixed(1)}{tc("hourAbbrev")}</span>
                </div>
              </div>

              <Separator />
              <h4 className="text-sm font-medium">{t("employeeMappingsSummary")}</h4>
              <div className="space-y-1">
                {importData.uniqueEmployees.map((emp) => {
                  const userId = employeeMappings[emp];
                  const member = teamMembers.find((m) => m.id === userId);
                  return (
                    <div key={emp} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{emp}</span>
                      <span>
                        {member ? (
                          <Badge variant="outline" className="text-xs">
                            {getTeamMemberName(member)}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            {t("skipped")}
                          </Badge>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Success state */}
        {importResult && (
          <div className="flex flex-col items-center py-8 space-y-4">
            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="font-semibold text-lg">{t("success")}</h3>
            <p className="text-sm text-muted-foreground text-center">
              {t("successMessage")
                .replace("{entries}", String(importResult.stats.entries))
                .replace("{employees}", String(importResult.stats.employees))}
            </p>
            <Button onClick={() => onOpenChange(false)}>{tc("close")}</Button>
          </div>
        )}

        {/* Footer navigation */}
        {!importResult && (
          <DialogFooter className="flex justify-between sm:justify-between">
            <div>
              {step > 1 && (
                <Button
                  variant="outline"
                  onClick={() => setStep((s) => s - 1)}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  {t("back")}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {tc("cancel")}
              </Button>
              {step < totalSteps ? (
                <Button
                  onClick={() => setStep((s) => s + 1)}
                  disabled={step === 1 && !importData}
                >
                  {t("next")}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={handleImport}
                  disabled={importing || entriesToImport === 0}
                >
                  {importing
                    ? t("importing")
                    : t("importButton").replace("{count}", String(entriesToImport))}
                </Button>
              )}
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
