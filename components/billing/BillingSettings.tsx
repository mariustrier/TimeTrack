"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Save, Plug, TestTube, Trash2, Plus } from "lucide-react";
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

export function BillingSettings() {
  const t = useTranslations("billing");
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

  // Customer mappings
  const [mappings, setMappings] = useState<CustomerMapping[]>([]);
  const [externalCustomers, setExternalCustomers] = useState<ExternalCustomer[]>([]);
  const [newClientName, setNewClientName] = useState("");
  const [newExternalId, setNewExternalId] = useState("");

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

  useEffect(() => {
    fetchSettings();
    fetchMappings();
  }, [fetchSettings, fetchMappings]);

  useEffect(() => {
    if (accountingSystem && accountingSystem !== "none") {
      fetchExternalCustomers();
    }
  }, [accountingSystem, fetchExternalCustomers]);

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

      // Include accounting credentials if system is set and has credentials
      if (accountingSystem !== "none" && Object.keys(credFields).length > 0) {
        body.accountingCredentials = { system: accountingSystem, ...credFields };
        body.accountingSystem = accountingSystem;
      } else if (accountingSystem === "none") {
        body.accountingSystem = null;
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

  async function handleTestConnection() {
    if (accountingSystem === "none") return;
    setTesting(true);
    try {
      const res = await fetch("/api/accounting/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: accountingSystem, ...credFields }),
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
          <CardTitle className="text-lg">{t("accountingSystem")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t("selectSystem")}</Label>
            <Select value={accountingSystem} onValueChange={setAccountingSystem}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("noSystem")}</SelectItem>
                <SelectItem value="e-conomic">e-conomic</SelectItem>
                <SelectItem value="billy">Billy</SelectItem>
                <SelectItem value="dinero">Dinero</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {accountingSystem === "e-conomic" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>App Secret Token</Label>
                <Input type="password" value={credFields.appSecretToken || ""} onChange={(e) => setCredFields({ ...credFields, appSecretToken: e.target.value })} />
              </div>
              <div>
                <Label>Agreement Grant Token</Label>
                <Input type="password" value={credFields.agreementGrantToken || ""} onChange={(e) => setCredFields({ ...credFields, agreementGrantToken: e.target.value })} />
              </div>
            </div>
          )}

          {accountingSystem === "billy" && (
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
          )}

          {accountingSystem === "dinero" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Client ID</Label>
                <Input value={credFields.clientId || ""} onChange={(e) => setCredFields({ ...credFields, clientId: e.target.value })} />
              </div>
              <div>
                <Label>Client Secret</Label>
                <Input type="password" value={credFields.clientSecret || ""} onChange={(e) => setCredFields({ ...credFields, clientSecret: e.target.value })} />
              </div>
              <div>
                <Label>Organization ID</Label>
                <Input value={credFields.organizationId || ""} onChange={(e) => setCredFields({ ...credFields, organizationId: e.target.value })} />
              </div>
            </div>
          )}

          {accountingSystem !== "none" && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleTestConnection} disabled={testing}>
                <TestTube className="mr-2 h-4 w-4" />
                {testing ? t("testing") : t("testConnection")}
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <Plug className="mr-2 h-4 w-4" />
                {t("connectSystem")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Mapping */}
      {accountingSystem !== "none" && (
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
    </div>
  );
}
