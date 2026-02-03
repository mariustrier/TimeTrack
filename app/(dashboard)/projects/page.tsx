"use client";

import { useState, useEffect } from "react";
import { FolderKanban, Plus, Pencil, Trash2, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslations } from "@/lib/i18n";
import { convertAndFormat, convertAndFormatBudget, SUPPORTED_CURRENCIES } from "@/lib/currency";
import { ContractSection } from "@/components/contracts/contract-section";
import { PageGuide } from "@/components/ui/page-guide";
import { InfoTooltip } from "@/components/ui/info-tooltip";

interface Project {
  id: string;
  name: string;
  client: string | null;
  color: string;
  budgetHours: number | null;
  budgetTotalHours: number | null;
  billable: boolean;
  active: boolean;
  currency: string | null;
  pricingType: string;
  fixedPrice: number | null;
  rateMode: string;
  projectRate: number | null;
  moneyUsed: number;
  _count: { timeEntries: number };
}

const COLORS = [
  "#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6",
  "#EC4899", "#06B6D4", "#F97316", "#6366F1", "#14B8A6",
];

export default function ProjectsPage() {
  const t = useTranslations("projects");
  const tc = useTranslations("common");
  const tContracts = useTranslations("contracts");

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [budgetHours, setBudgetHours] = useState("");
  const [billable, setBillable] = useState(true);
  const [currency, setCurrency] = useState("");
  const [masterCurrency, setMasterCurrency] = useState("USD");
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [pricingType, setPricingType] = useState("hourly");
  const [fixedPrice, setFixedPrice] = useState("");
  const [defaultHourlyRate, setDefaultHourlyRate] = useState<number | null>(null);
  const [rateMode, setRateMode] = useState("COMPANY_RATE");
  const [projectRate, setProjectRate] = useState("");
  const [userRole, setUserRole] = useState("employee");
  const [contractProjectId, setContractProjectId] = useState<string | null>(null);

  async function fetchProjects() {
    setLoading(true);
    try {
      const res = await fetch("/api/projects");
      if (res.ok) setProjects(await res.json());
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProjects();
    fetch("/api/admin/economic")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.currency) {
          setMasterCurrency(data.currency || "USD");
          setDisplayCurrency(data.currency || "USD");
        }
        if (data?.defaultHourlyRate) setDefaultHourlyRate(data.defaultHourlyRate);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.role) setUserRole(data.role); })
      .catch(() => {});
  }, []);

  function openCreateModal() {
    setEditingProject(null);
    setName("");
    setClient("");
    setColor("#3B82F6");
    setBudgetHours("");
    setBillable(true);
    setCurrency("");
    setPricingType("hourly");
    setFixedPrice("");
    setRateMode("COMPANY_RATE");
    setProjectRate("");
    setModalOpen(true);
  }

  function openEditModal(project: Project) {
    setEditingProject(project);
    setName(project.name);
    setClient(project.client || "");
    setColor(project.color);
    setBudgetHours(project.budgetHours?.toString() || "");
    setBillable(project.billable);
    setCurrency(project.currency || "");
    setPricingType(project.pricingType || "hourly");
    setFixedPrice(project.fixedPrice?.toString() || "");
    setRateMode(project.rateMode || "COMPANY_RATE");
    setProjectRate(project.projectRate?.toString() || "");
    setModalOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const body = {
        name,
        client,
        color,
        pricingType,
        budgetHours: pricingType === "hourly" ? budgetHours : null,
        fixedPrice: pricingType === "fixed_price" ? fixedPrice : null,
        rateMode: pricingType === "fixed_price" ? rateMode : "COMPANY_RATE",
        projectRate: pricingType === "fixed_price" && rateMode === "PROJECT_RATE" ? projectRate : null,
        billable,
        currency: (currency && currency !== "default") ? currency : null,
      };
      if (editingProject) {
        await fetch(`/api/projects/${editingProject.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      setModalOpen(false);
      fetchProjects();
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingProject) return;
    setSaving(true);
    try {
      await fetch(`/api/projects/${deletingProject.id}`, { method: "DELETE" });
      setDeleteModalOpen(false);
      setDeletingProject(null);
      fetchProjects();
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-36" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageGuide pageId="projects" titleKey="projectsTitle" descKey="projectsDesc" tips={["projectsTip1", "projectsTip2", "projectsTip3"]} />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        <div className="flex items-center gap-2">
          <Select value={displayCurrency} onValueChange={setDisplayCurrency}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {displayCurrency !== masterCurrency && (
            <span className="text-xs text-muted-foreground">
              ({masterCurrency})
            </span>
          )}
          <Button onClick={openCreateModal}>
            <Plus className="mr-2 h-4 w-4" />
            {t("newProject")}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t("allProjects")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <FolderKanban className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">{t("noProjectsTitle")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("noProjectsDescription")}</p>
              <Button className="mt-4" onClick={openCreateModal}>
                <Plus className="mr-2 h-4 w-4" />
                {t("newProject")}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tc("project")}</TableHead>
                  <TableHead>{t("client")}</TableHead>
                  <TableHead>{t("budget")}</TableHead>
                  <TableHead>{t("entries")}</TableHead>
                  <TableHead>{tc("status")}</TableHead>
                  <TableHead className="w-20">{tc("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div
                          className="h-3.5 w-3.5 rounded-full"
                          style={{ backgroundColor: project.color }}
                        />
                        <span className="font-medium">{project.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {project.client || "-"}
                    </TableCell>
                    <TableCell>
                      {project.budgetTotalHours != null ? `${project.budgetTotalHours}h` : "-"}
                    </TableCell>
                    <TableCell>{project._count.timeEntries}</TableCell>
                    <TableCell>
                      <div className="flex gap-1.5">
                        <Badge variant={project.active ? "default" : "secondary"}>
                          {project.active ? tc("active") : tc("inactive")}
                        </Badge>
                        {project.billable && (
                          <Badge variant="outline">{tc("billable")}</Badge>
                        )}
                        {project.pricingType === "fixed_price" && (
                          <Badge variant="outline">{t("fixedPrice")}</Badge>
                        )}
                        {project.currency && project.currency !== masterCurrency && (
                          <Badge variant="outline">{project.currency}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal(project)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDeletingProject(project);
                            setDeleteModalOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                        {(userRole === "admin" || userRole === "manager") && (
                          <button
                            onClick={() => setContractProjectId(project.id)}
                            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                            title={tContracts("title")}
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProject ? t("editProject") : t("newProject")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{tc("name")}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("projectName")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("client")}</Label>
              <Input
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder={t("clientName")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("color")}</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`h-8 w-8 rounded-full border-2 transition-all ${
                      color === c ? "border-foreground scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1">{t("pricingType")} <InfoTooltip textKey="pricingType" size={13} /></Label>
              <Select value={pricingType} onValueChange={(val) => {
                setPricingType(val);
                if (val === "fixed_price") setBudgetHours("");
                if (val === "hourly") setFixedPrice("");
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">{t("hourlyPricing")}</SelectItem>
                  <SelectItem value="fixed_price">{t("fixedPricePricing")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {pricingType === "hourly" && (
              <div className="space-y-2">
                <Label>{t("budgetHours")}</Label>
                <Input
                  type="number"
                  value={budgetHours}
                  onChange={(e) => setBudgetHours(e.target.value)}
                  placeholder={t("optional")}
                />
              </div>
            )}
            {pricingType === "fixed_price" && (
              <>
                <div className="space-y-2">
                  <Label>{t("fixedPriceAmount").replace("{currency}", masterCurrency)}</Label>
                  <Input
                    type="number"
                    value={fixedPrice}
                    onChange={(e) => setFixedPrice(e.target.value)}
                    placeholder={t("fixedPricePlaceholder")}
                  />
                  {fixedPrice && defaultHourlyRate && rateMode === "COMPANY_RATE" && (
                    <p className="text-xs text-muted-foreground">
                      {t("estimatedHours")
                        .replace("{hours}", (parseFloat(fixedPrice) / defaultHourlyRate).toFixed(1))
                        .replace("{rate}", convertAndFormatBudget(defaultHourlyRate, masterCurrency, masterCurrency))}
                    </p>
                  )}
                  {fixedPrice && rateMode === "PROJECT_RATE" && projectRate && (
                    <p className="text-xs text-muted-foreground">
                      {t("estimatedHours")
                        .replace("{hours}", (parseFloat(fixedPrice) / parseFloat(projectRate)).toFixed(1))
                        .replace("{rate}", convertAndFormatBudget(parseFloat(projectRate), masterCurrency, masterCurrency))}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>{t("rateMode")}</Label>
                  <Select value={rateMode} onValueChange={setRateMode}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COMPANY_RATE">
                        {t("companyRate")} — {t("companyRateDescription")}
                      </SelectItem>
                      <SelectItem value="EMPLOYEE_RATES">
                        {t("employeeRates")} — {t("employeeRatesDescription")}
                      </SelectItem>
                      <SelectItem value="PROJECT_RATE">
                        {t("projectRateOption")} — {t("projectRateDescription")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {rateMode === "COMPANY_RATE" && !defaultHourlyRate && (
                    <p className="text-xs text-amber-600">{t("noCompanyRate")}</p>
                  )}
                </div>
                {rateMode === "PROJECT_RATE" && (
                  <div className="space-y-2">
                    <Label>{t("projectRateInput").replace("{currency}", masterCurrency)}</Label>
                    <Input
                      type="number"
                      value={projectRate}
                      onChange={(e) => setProjectRate(e.target.value)}
                      placeholder="e.g. 800"
                    />
                  </div>
                )}
              </>
            )}
            <div className="space-y-2">
              <Label>{tc("currency")}</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue placeholder={t("companyDefault", { currency: masterCurrency })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">{t("companyDefault").replace("{currency}", masterCurrency)}</SelectItem>
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="billable"
                checked={billable}
                onChange={(e) => setBillable(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="billable">{t("billableProject")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? tc("saving") : editingProject ? tc("update") : tc("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteProject")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("deleteProjectConfirm", { name: deletingProject?.name || "" })}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? tc("deleting") : tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contract Dialog */}
      <Dialog open={!!contractProjectId} onOpenChange={(open) => !open && setContractProjectId(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tContracts("title")}</DialogTitle>
          </DialogHeader>
          {contractProjectId && (
            <ContractSection projectId={contractProjectId} userRole={userRole} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
