"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import { Save, Plug, TestTube, Trash2, Plus, Unplug, ExternalLink, CheckCircle2, Download, RefreshCw, ChevronDown, ChevronUp, Clock, AlertCircle, Check } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "@/lib/i18n";

interface BillingSettingsData {
  name: string;
  companyAddress: string | null;
  companyCvr: string | null;
  companyBankAccount: string | null;
  companyBankReg: string | null;
  defaultPaymentDays: number;
  invoiceFooterNote: string | null;
  invoicePrefix: string | null;
  accountingSystem: string | null;
  nextInvoiceNumber: number;
}

interface CustomerMapping {
  id: string;
  clientName: string;
  externalCustomerId: string;
  externalCustomerName: string;
}

interface ExternalCustomer {
  id: string;
  name: string;
  cvr?: string;
}

interface GenericMapping {
  id: string;
  [key: string]: unknown;
}

interface ExternalItem {
  id: string;
  name: string;
  number?: string;
}

interface SyncLogEntry {
  id: string;
  syncType: string;
  direction: string;
  system: string;
  status: string;
  itemCount: number;
  errorCount: number;
  errors?: string | null;
  startedAt: string;
  completedAt?: string | null;
}

interface SyncStatus {
  pendingTimeEntries: number;
  pendingExpenses: number;
  syncedTimeEntries: number;
  syncedExpenses: number;
  recentLogs: SyncLogEntry[];
}

export function BillingSettings() {
  const t = useTranslations("billing");
  const ta = useTranslations("admin");
  const searchParams = useSearchParams();
  const [settings, setSettings] = useState<BillingSettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyCvr, setCompanyCvr] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankReg, setBankReg] = useState("");
  const [paymentDays, setPaymentDays] = useState("8");
  const [footerNote, setFooterNote] = useState("");
  const [invoicePrefix, setInvoicePrefix] = useState("");

  // Accounting system
  const [accountingSystem, setAccountingSystem] = useState<string>("none");
  const [credFields, setCredFields] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // Customer mappings
  const [mappings, setMappings] = useState<CustomerMapping[]>([]);
  const [externalCustomers, setExternalCustomers] = useState<ExternalCustomer[]>([]);
  const [newClientName, setNewClientName] = useState("");
  const [newExternalId, setNewExternalId] = useState("");

  // Sync state
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncingTime, setSyncingTime] = useState(false);
  const [syncingExpenses, setSyncingExpenses] = useState(false);
  const [showSyncHistory, setShowSyncHistory] = useState(false);

  // Project mappings
  const [projectMappings, setProjectMappings] = useState<GenericMapping[]>([]);
  const [externalProjects, setExternalProjects] = useState<ExternalItem[]>([]);
  const [ctProjects, setCtProjects] = useState<{ id: string; name: string }[]>([]);
  const [newProjectId, setNewProjectId] = useState("");
  const [newExtProjectId, setNewExtProjectId] = useState("");

  // Employee mappings
  const [employeeMappings, setEmployeeMappings] = useState<GenericMapping[]>([]);
  const [externalEmployees, setExternalEmployees] = useState<ExternalItem[]>([]);
  const [ctEmployees, setCtEmployees] = useState<{ id: string; name: string }[]>([]);
  const [newEmployeeId, setNewEmployeeId] = useState("");
  const [newExtEmployeeId, setNewExtEmployeeId] = useState("");

  // Expense category mappings
  const [categoryMappings, setCategoryMappings] = useState<GenericMapping[]>([]);
  const [externalAccounts, setExternalAccounts] = useState<ExternalItem[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [newExtAccountId, setNewExtAccountId] = useState("");

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setCompanyAddress(data.companyAddress || "");
        setCompanyCvr(data.companyCvr || "");
        setBankAccount(data.companyBankAccount || "");
        setBankReg(data.companyBankReg || "");
        setPaymentDays(String(data.defaultPaymentDays || 8));
        setFooterNote(data.invoiceFooterNote || "");
        setInvoicePrefix(data.invoicePrefix || "");
        setAccountingSystem(data.accountingSystem || "none");
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMappings = useCallback(async () => {
    try {
      const res = await fetch("/api/accounting/mappings");
      if (res.ok) setMappings(await res.json());
    } catch {}
  }, []);

  const fetchExternalCustomers = useCallback(async () => {
    try {
      const res = await fetch("/api/accounting/customers");
      if (res.ok) {
        const data = await res.json();
        setExternalCustomers(data.customers || []);
      }
    } catch {}
  }, []);

  const fetchSyncStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/accounting/sync/status");
      if (res.ok) setSyncStatus(await res.json());
    } catch {}
  }, []);

  const fetchProjectMappings = useCallback(async () => {
    try {
      const res = await fetch("/api/accounting/mappings/projects");
      if (res.ok) setProjectMappings(await res.json());
    } catch {}
  }, []);

  const fetchEmployeeMappings = useCallback(async () => {
    try {
      const res = await fetch("/api/accounting/mappings/employees");
      if (res.ok) setEmployeeMappings(await res.json());
    } catch {}
  }, []);

  const fetchCategoryMappings = useCallback(async () => {
    try {
      const res = await fetch("/api/accounting/mappings/expense-categories");
      if (res.ok) setCategoryMappings(await res.json());
    } catch {}
  }, []);

  const fetchCtProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setCtProjects((data || []).map((p: Record<string, unknown>) => ({ id: String(p.id), name: String(p.name) })));
      }
    } catch {}
  }, []);

  const fetchCtEmployees = useCallback(async () => {
    try {
      const res = await fetch("/api/team");
      if (res.ok) {
        const data = await res.json();
        setCtEmployees((data || []).map((u: Record<string, unknown>) => ({
          id: String(u.id),
          name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || String(u.email),
        })));
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchMappings();
  }, [fetchSettings, fetchMappings]);

  // Show toast for OAuth callback results
  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected) {
      toast.success(t("oauthSuccess", { system: connected }));
      // Clean URL without reload
      window.history.replaceState({}, "", "/billing?tab=settings");
    }
    if (error) {
      const messages: Record<string, string> = {
        oauth: t("oauthError"),
        denied: t("oauthDenied"),
        connection: t("connectionFailed", { error: "Connection test failed" }),
        token: t("oauthError"),
        organization: t("oauthOrgError"),
      };
      toast.error(messages[error] || t("oauthError"));
      window.history.replaceState({}, "", "/billing?tab=settings");
    }
  }, [searchParams, t]);

  useEffect(() => {
    if (accountingSystem && accountingSystem !== "none") {
      fetchExternalCustomers();
      fetchSyncStatus();
      fetchProjectMappings();
      fetchEmployeeMappings();
      fetchCategoryMappings();
      fetchCtProjects();
      fetchCtEmployees();
    }
  }, [accountingSystem, fetchExternalCustomers, fetchSyncStatus, fetchProjectMappings, fetchEmployeeMappings, fetchCategoryMappings, fetchCtProjects, fetchCtEmployees]);

  const isConnected = settings?.accountingSystem && settings.accountingSystem !== "none";

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        companyAddress: companyAddress || null,
        companyCvr: companyCvr || null,
        companyBankAccount: bankAccount || null,
        companyBankReg: bankReg || null,
        defaultPaymentDays: parseInt(paymentDays) || 8,
        invoiceFooterNote: footerNote || null,
        invoicePrefix: invoicePrefix || null,
      };

      // Include accounting credentials for Billy (manual entry only)
      if (accountingSystem === "billy" && Object.keys(credFields).length > 0) {
        body.accountingCredentials = { system: accountingSystem, ...credFields };
        body.accountingSystem = accountingSystem;
      }

      const res = await fetch("/api/billing/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success(t("settingsSaved"));
        fetchSettings();
      } else {
        toast.error(t("saveFailed"));
      }
    } catch {
      toast.error(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleOAuthConnect(system: "e-conomic" | "dinero") {
    setConnecting(true);
    try {
      const endpoint = system === "e-conomic"
        ? "/api/accounting/economic/authorize"
        : "/api/accounting/dinero/authorize";

      const res = await fetch(endpoint);
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || t("oauthError"));
        return;
      }

      const { url } = await res.json();
      window.location.href = url;
    } catch {
      toast.error(t("oauthError"));
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm(t("disconnectConfirm"))) return;
    setSaving(true);
    try {
      const res = await fetch("/api/billing/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountingSystem: null }),
      });
      if (res.ok) {
        toast.success(t("disconnected"));
        setAccountingSystem("none");
        setCredFields({});
        fetchSettings();
      }
    } catch {
      toast.error(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    if (accountingSystem === "none") return;
    setTesting(true);
    try {
      // For Billy: test with provided credentials
      // For e-conomic/Dinero: test with saved credentials (from OAuth)
      const body = accountingSystem === "billy"
        ? { system: accountingSystem, ...credFields }
        : { system: accountingSystem };

      const res = await fetch("/api/accounting/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(t("connectionSuccess"));
        fetchExternalCustomers();
      } else {
        toast.error(t("connectionFailed", { error: data.error || "Unknown error" }));
      }
    } catch {
      toast.error(t("connectionFailed", { error: "Network error" }));
    } finally {
      setTesting(false);
    }
  }

  async function handleAddMapping() {
    if (!newClientName || !newExternalId) return;
    const ext = externalCustomers.find((c) => c.id === newExternalId);
    try {
      const res = await fetch("/api/accounting/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: newClientName,
          externalCustomerId: newExternalId,
          externalCustomerName: ext?.name || newExternalId,
        }),
      });
      if (res.ok) {
        toast.success(t("mappingAdded"));
        setNewClientName("");
        setNewExternalId("");
        fetchMappings();
      }
    } catch {
      toast.error(t("saveFailed"));
    }
  }

  async function handleDeleteMapping(id: string) {
    try {
      await fetch(`/api/accounting/mappings/${id}`, { method: "DELETE" });
      fetchMappings();
    } catch {}
  }

  // ─── Sync Handlers ───

  async function handleSyncTimeEntries() {
    if (!confirm(ta("syncConfirm", { count: String(syncStatus?.pendingTimeEntries || 0), system: accountingSystem }))) return;
    setSyncingTime(true);
    try {
      const res = await fetch("/api/accounting/sync/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.errors?.length > 0) {
          toast.warning(ta("syncPartial"));
        } else {
          toast.success(ta("syncSuccess"));
        }
      } else {
        toast.error(data.error || ta("syncError"));
      }
      fetchSyncStatus();
    } catch {
      toast.error(ta("syncError"));
    } finally {
      setSyncingTime(false);
    }
  }

  async function handleSyncExpenses() {
    if (!confirm(ta("syncConfirm", { count: String(syncStatus?.pendingExpenses || 0), system: accountingSystem }))) return;
    setSyncingExpenses(true);
    try {
      const res = await fetch("/api/accounting/sync/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.errors?.length > 0) {
          toast.warning(ta("syncPartial"));
        } else {
          toast.success(ta("syncSuccess"));
        }
      } else {
        toast.error(data.error || ta("syncError"));
      }
      fetchSyncStatus();
    } catch {
      toast.error(ta("syncError"));
    } finally {
      setSyncingExpenses(false);
    }
  }

  async function handleExportCsv(type: "time-entries" | "expenses") {
    try {
      const res = await fetch(`/api/accounting/export/${type}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      fetchSyncStatus();
    } catch {
      toast.error(ta("syncError"));
    }
  }

  async function handleLoadExternalProjects() {
    try {
      const res = await fetch("/api/accounting/projects");
      if (res.ok) {
        const data = await res.json();
        setExternalProjects(data.projects || []);
      }
    } catch {
      toast.error(ta("mappingError"));
    }
  }

  async function handleLoadExternalEmployees() {
    try {
      const res = await fetch("/api/accounting/employees");
      if (res.ok) {
        const data = await res.json();
        setExternalEmployees(data.employees || []);
      }
    } catch {
      toast.error(ta("mappingError"));
    }
  }

  async function handleLoadExternalAccounts() {
    try {
      const res = await fetch("/api/accounting/accounts");
      if (res.ok) {
        const data = await res.json();
        setExternalAccounts(data.accounts || []);
      }
    } catch {
      toast.error(ta("mappingError"));
    }
  }

  async function handleAddProjectMapping() {
    if (!newProjectId || !newExtProjectId) return;
    const ext = externalProjects.find((p) => p.id === newExtProjectId);
    try {
      const res = await fetch("/api/accounting/mappings/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: newProjectId,
          externalProjectId: newExtProjectId,
          externalProjectName: ext?.name || newExtProjectId,
        }),
      });
      if (res.ok) {
        toast.success(ta("mappingSaved"));
        setNewProjectId("");
        setNewExtProjectId("");
        fetchProjectMappings();
      }
    } catch {
      toast.error(ta("mappingError"));
    }
  }

  async function handleAddEmployeeMapping() {
    if (!newEmployeeId || !newExtEmployeeId) return;
    const ext = externalEmployees.find((e) => e.id === newExtEmployeeId);
    try {
      const res = await fetch("/api/accounting/mappings/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: newEmployeeId,
          externalEmployeeId: newExtEmployeeId,
          externalEmployeeName: ext?.name || newExtEmployeeId,
        }),
      });
      if (res.ok) {
        toast.success(ta("mappingSaved"));
        setNewEmployeeId("");
        setNewExtEmployeeId("");
        fetchEmployeeMappings();
      }
    } catch {
      toast.error(ta("mappingError"));
    }
  }

  async function handleAddCategoryMapping() {
    if (!newCategory || !newExtAccountId) return;
    const ext = externalAccounts.find((a) => a.id === newExtAccountId);
    try {
      const res = await fetch("/api/accounting/mappings/expense-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: newCategory,
          externalAccountId: newExtAccountId,
          externalAccountName: ext?.name || newExtAccountId,
        }),
      });
      if (res.ok) {
        toast.success(ta("mappingSaved"));
        setNewCategory("");
        setNewExtAccountId("");
        fetchCategoryMappings();
      }
    } catch {
      toast.error(ta("mappingError"));
    }
  }

  async function handleDeleteGenericMapping(type: string, id: string) {
    try {
      await fetch(`/api/accounting/mappings/${type}/${id}`, { method: "DELETE" });
      toast.success(ta("mappingDeleted"));
      if (type === "projects") fetchProjectMappings();
      else if (type === "employees") fetchEmployeeMappings();
      else if (type === "expense-categories") fetchCategoryMappings();
    } catch {}
  }

  // Determine capabilities based on system
  const supportsTimePush = accountingSystem === "e-conomic"; // stubbed but shows UI for mapping
  const supportsExpensePush = accountingSystem === "dinero" || accountingSystem === "billy";

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-64" /><Skeleton className="h-48" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Company Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("companyDetails")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>{t("companyAddress")}</Label>
              <Input value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} placeholder="Eksempelvej 1, 2100 København" />
            </div>
            <div>
              <Label>{t("companyCvr")}</Label>
              <Input value={companyCvr} onChange={(e) => setCompanyCvr(e.target.value)} placeholder="12345678" />
            </div>
            <div>
              <Label>{t("bankAccount")}</Label>
              <Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} placeholder="1234567890" />
            </div>
            <div>
              <Label>{t("bankReg")}</Label>
              <Input value={bankReg} onChange={(e) => setBankReg(e.target.value)} placeholder="0001" />
            </div>
            <div>
              <Label>{t("paymentTerms")}</Label>
              <Input type="number" value={paymentDays} onChange={(e) => setPaymentDays(e.target.value)} min={1} max={365} />
            </div>
            <div>
              <Label>{t("invoicePrefix")}</Label>
              <Input value={invoicePrefix} onChange={(e) => setInvoicePrefix(e.target.value)} placeholder="CT-" />
            </div>
          </div>
          <div>
            <Label>{t("footerNote")}</Label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={footerNote}
              onChange={(e) => setFooterNote(e.target.value)}
              placeholder={t("footerNotePlaceholder")}
            />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? t("saving") : t("saveSettings")}
          </Button>
        </CardContent>
      </Card>

      {/* Accounting System */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{t("accountingSystem")}</CardTitle>
            {isConnected && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700">
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                {t("connected")} — {settings.accountingSystem}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Connected state */}
          {isConnected ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("connectedTo", { system: settings.accountingSystem || "" })}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleTestConnection} disabled={testing}>
                  <TestTube className="mr-2 h-4 w-4" />
                  {testing ? t("testing") : t("testConnection")}
                </Button>
                <Button variant="outline" onClick={handleDisconnect} disabled={saving} className="text-red-600 hover:text-red-700">
                  <Unplug className="mr-2 h-4 w-4" />
                  {t("disconnect")}
                </Button>
              </div>
            </div>
          ) : (
            /* Not connected — show connection options */
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">{t("chooseSystem")}</p>

              {/* e-conomic OAuth */}
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">e-conomic</h4>
                    <p className="text-sm text-muted-foreground">{t("economicDescription")}</p>
                  </div>
                  <Button onClick={() => handleOAuthConnect("e-conomic")} disabled={connecting}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {connecting ? t("redirecting") : t("connectEconomic")}
                  </Button>
                </div>
              </div>

              {/* Dinero OAuth */}
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Dinero</h4>
                    <p className="text-sm text-muted-foreground">{t("dineroDescription")}</p>
                  </div>
                  <Button onClick={() => handleOAuthConnect("dinero")} disabled={connecting}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {connecting ? t("redirecting") : t("connectDinero")}
                  </Button>
                </div>
              </div>

              {/* Billy manual entry */}
              <div className="rounded-lg border p-4 space-y-4">
                <div>
                  <h4 className="font-medium">Billy</h4>
                  <p className="text-sm text-muted-foreground">{t("billyDescription")}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Access Token</Label>
                    <Input type="password" value={credFields.accessToken || ""} onChange={(e) => setCredFields({ ...credFields, accessToken: e.target.value })} />
                  </div>
                  <div>
                    <Label>Organization ID</Label>
                    <Input value={credFields.organizationId || ""} onChange={(e) => setCredFields({ ...credFields, organizationId: e.target.value })} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setAccountingSystem("billy"); handleTestConnection(); }} disabled={testing || !credFields.accessToken}>
                    <TestTube className="mr-2 h-4 w-4" />
                    {testing ? t("testing") : t("testConnection")}
                  </Button>
                  <Button onClick={() => { setAccountingSystem("billy"); handleSave(); }} disabled={saving || !credFields.accessToken}>
                    <Plug className="mr-2 h-4 w-4" />
                    {t("connectBilly")}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Mapping */}
      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("customerMapping")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("clientNameLabel")}</TableHead>
                  <TableHead>{t("externalCustomer")}</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.clientName}</TableCell>
                    <TableCell>
                      {m.externalCustomerName}
                      <span className="ml-2 text-xs text-muted-foreground">({m.externalCustomerId})</span>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteMapping(m.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label>{t("clientNameLabel")}</Label>
                <Input
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder={t("clientNamePlaceholder")}
                />
              </div>
              <div className="flex-1">
                <Label>{t("externalCustomer")}</Label>
                <Select value={newExternalId} onValueChange={setNewExternalId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectCustomer")} />
                  </SelectTrigger>
                  <SelectContent>
                    {externalCustomers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.cvr ? `(${c.cvr})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddMapping} disabled={!newClientName || !newExternalId}>
                <Plus className="mr-1 h-4 w-4" />
                {t("addMapping")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Project Mapping — only for e-conomic (time entry push) */}
      {isConnected && supportsTimePush && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{ta("mappingProjects")}</CardTitle>
            <p className="text-sm text-muted-foreground">{ta("mappingProjectsDescription")}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{ta("mappingCtProject")}</TableHead>
                  <TableHead>{ta("mappingExtProject")}</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {projectMappings.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{(m as Record<string, unknown>).project ? String(((m as Record<string, unknown>).project as Record<string, string>).name) : String(m.projectId)}</TableCell>
                    <TableCell>
                      {String(m.externalProjectName)}
                      <span className="ml-2 text-xs text-muted-foreground">({String(m.externalProjectId)})</span>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteGenericMapping("projects", m.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label>{ta("mappingCtProject")}</Label>
                <Select value={newProjectId} onValueChange={setNewProjectId}>
                  <SelectTrigger><SelectValue placeholder={ta("mappingSelectProject")} /></SelectTrigger>
                  <SelectContent>
                    {ctProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label>{ta("mappingExtProject")}</Label>
                {externalProjects.length > 0 ? (
                  <Select value={newExtProjectId} onValueChange={setNewExtProjectId}>
                    <SelectTrigger><SelectValue placeholder={ta("mappingSelectProject")} /></SelectTrigger>
                    <SelectContent>
                      {externalProjects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name} {p.number ? `(${p.number})` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Button variant="outline" className="w-full" onClick={handleLoadExternalProjects}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {ta("mappingLoadProjects")}
                  </Button>
                )}
              </div>
              <Button onClick={handleAddProjectMapping} disabled={!newProjectId || !newExtProjectId}>
                <Plus className="mr-1 h-4 w-4" />
                {ta("mappingAdd")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Employee Mapping — only for e-conomic (time entry push) */}
      {isConnected && supportsTimePush && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{ta("mappingEmployees")}</CardTitle>
            <p className="text-sm text-muted-foreground">{ta("mappingEmployeesDescription")}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{ta("mappingCtEmployee")}</TableHead>
                  <TableHead>{ta("mappingExtEmployee")}</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {employeeMappings.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{(m as Record<string, unknown>).user ? `${((m as Record<string, unknown>).user as Record<string, string>).firstName || ""} ${((m as Record<string, unknown>).user as Record<string, string>).lastName || ""}`.trim() : String(m.userId)}</TableCell>
                    <TableCell>
                      {String(m.externalEmployeeName)}
                      <span className="ml-2 text-xs text-muted-foreground">({String(m.externalEmployeeId)})</span>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteGenericMapping("employees", m.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label>{ta("mappingCtEmployee")}</Label>
                <Select value={newEmployeeId} onValueChange={setNewEmployeeId}>
                  <SelectTrigger><SelectValue placeholder={ta("mappingSelectEmployee")} /></SelectTrigger>
                  <SelectContent>
                    {ctEmployees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label>{ta("mappingExtEmployee")}</Label>
                {externalEmployees.length > 0 ? (
                  <Select value={newExtEmployeeId} onValueChange={setNewExtEmployeeId}>
                    <SelectTrigger><SelectValue placeholder={ta("mappingSelectEmployee")} /></SelectTrigger>
                    <SelectContent>
                      {externalEmployees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.name} {e.number ? `(${e.number})` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Button variant="outline" className="w-full" onClick={handleLoadExternalEmployees}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {ta("mappingLoadEmployees")}
                  </Button>
                )}
              </div>
              <Button onClick={handleAddEmployeeMapping} disabled={!newEmployeeId || !newExtEmployeeId}>
                <Plus className="mr-1 h-4 w-4" />
                {ta("mappingAdd")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expense Category Mapping — for Dinero/Billy (expense push) */}
      {isConnected && supportsExpensePush && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{ta("mappingExpenseCategories")}</CardTitle>
            <p className="text-sm text-muted-foreground">{ta("mappingExpenseCategoriesDescription")}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{ta("mappingCtCategory")}</TableHead>
                  <TableHead>{ta("mappingExtAccount")}</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoryMappings.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{String(m.category)}</TableCell>
                    <TableCell>
                      {String(m.externalAccountName)}
                      <span className="ml-2 text-xs text-muted-foreground">({String(m.externalAccountId)})</span>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteGenericMapping("expense-categories", m.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label>{ta("mappingCtCategory")}</Label>
                <Input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="travel, office, ..."
                />
              </div>
              <div className="flex-1">
                <Label>{ta("mappingExtAccount")}</Label>
                {externalAccounts.length > 0 ? (
                  <Select value={newExtAccountId} onValueChange={setNewExtAccountId}>
                    <SelectTrigger><SelectValue placeholder={ta("mappingSelectAccount")} /></SelectTrigger>
                    <SelectContent>
                      {externalAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name} {a.number ? `(${a.number})` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Button variant="outline" className="w-full" onClick={handleLoadExternalAccounts}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {ta("mappingLoadAccounts")}
                  </Button>
                )}
              </div>
              <Button onClick={handleAddCategoryMapping} disabled={!newCategory || !newExtAccountId}>
                <Plus className="mr-1 h-4 w-4" />
                {ta("mappingAdd")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Time Entry Sync */}
      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{ta("syncTimeEntries")}</CardTitle>
            <p className="text-sm text-muted-foreground">{ta("syncTimeEntriesDescription")}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {supportsTimePush ? (
              <>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-amber-500" />
                    {ta("syncPending", { count: String(syncStatus?.pendingTimeEntries || 0) })}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-green-500" />
                    {ta("syncSynced", { count: String(syncStatus?.syncedTimeEntries || 0) })}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSyncTimeEntries} disabled={syncingTime || !syncStatus?.pendingTimeEntries}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${syncingTime ? "animate-spin" : ""}`} />
                    {syncingTime ? "..." : ta("syncNow")}
                  </Button>
                  <Button variant="outline" onClick={() => handleExportCsv("time-entries")}>
                    <Download className="mr-2 h-4 w-4" />
                    {ta("syncExportCsv")}
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {ta("syncUseExport", { system: accountingSystem })}
                </p>
                <Button variant="outline" onClick={() => handleExportCsv("time-entries")}>
                  <Download className="mr-2 h-4 w-4" />
                  {ta("syncExportCsv")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Expense Sync */}
      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{ta("syncExpenses")}</CardTitle>
            <p className="text-sm text-muted-foreground">{ta("syncExpensesDescription")}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {supportsExpensePush ? (
              <>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-amber-500" />
                    {ta("syncPending", { count: String(syncStatus?.pendingExpenses || 0) })}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-green-500" />
                    {ta("syncSynced", { count: String(syncStatus?.syncedExpenses || 0) })}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSyncExpenses} disabled={syncingExpenses || !syncStatus?.pendingExpenses}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${syncingExpenses ? "animate-spin" : ""}`} />
                    {syncingExpenses ? "..." : ta("syncNow")}
                  </Button>
                  <Button variant="outline" onClick={() => handleExportCsv("expenses")}>
                    <Download className="mr-2 h-4 w-4" />
                    {ta("syncExportCsv")}
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {ta("syncUseExport", { system: accountingSystem })}
                </p>
                <Button variant="outline" onClick={() => handleExportCsv("expenses")}>
                  <Download className="mr-2 h-4 w-4" />
                  {ta("syncExportCsv")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sync History */}
      {isConnected && syncStatus && syncStatus.recentLogs.length > 0 && (
        <Card>
          <CardHeader className="cursor-pointer" onClick={() => setShowSyncHistory(!showSyncHistory)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{ta("syncHistory")}</CardTitle>
              {showSyncHistory ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </div>
          </CardHeader>
          {showSyncHistory && (
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Items</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncStatus.recentLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs">
                        {new Date(log.startedAt).toLocaleDateString()} {new Date(log.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </TableCell>
                      <TableCell className="text-sm">{log.syncType === "time_entries" ? ta("syncTimeEntries") : ta("syncExpenses")}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {log.direction === "push" ? ta("syncLogPush") : ta("syncLogExport")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.status === "success" ? "default" : log.status === "partial" ? "secondary" : "destructive"} className="text-xs">
                          {log.status === "success" ? <Check className="mr-1 h-3 w-3" /> : log.status === "error" ? <AlertCircle className="mr-1 h-3 w-3" /> : null}
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {ta("syncLogItems", { count: String(log.itemCount) })}
                        {log.errorCount > 0 && (
                          <span className="ml-2 text-red-500 text-xs">({ta("syncErrors", { count: String(log.errorCount) })})</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
