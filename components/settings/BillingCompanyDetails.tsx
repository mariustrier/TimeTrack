"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Save, FileText } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "@/lib/i18n";

export function BillingCompanyDetails() {
  const t = useTranslations("billing");
  const tc = useTranslations("common");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyCvr, setCompanyCvr] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankReg, setBankReg] = useState("");
  const [paymentDays, setPaymentDays] = useState("8");
  const [invoicePrefix, setInvoicePrefix] = useState("");
  const [footerNote, setFooterNote] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/billing/settings");
        if (res.ok) {
          const data = await res.json();
          setCompanyAddress(data.companyAddress || "");
          setCompanyCvr(data.companyCvr || "");
          setBankAccount(data.companyBankAccount || "");
          setBankReg(data.companyBankReg || "");
          setPaymentDays(data.defaultPaymentDays?.toString() || "8");
          setInvoicePrefix(data.invoicePrefix || "");
          setFooterNote(data.invoiceFooterNote || "");
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/billing/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyAddress,
          companyCvr,
          companyBankAccount: bankAccount,
          companyBankReg: bankReg,
          defaultPaymentDays: parseInt(paymentDays) || 8,
          invoicePrefix,
          invoiceFooterNote: footerNote,
        }),
      });
      if (res.ok) {
        toast.success(tc("saved"));
      } else {
        toast.error(tc("saveFailed"));
      }
    } catch {
      toast.error(tc("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Skeleton className="h-64" />;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          {t("companyDetails") || "Billing Company Details"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("companyAddress") || "Company Address"}</Label>
            <Textarea
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("cvr") || "CVR"}</Label>
            <Input value={companyCvr} onChange={(e) => setCompanyCvr(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("bankAccount") || "Bank Account"}</Label>
            <Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("bankReg") || "Bank Reg. No."}</Label>
            <Input value={bankReg} onChange={(e) => setBankReg(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("paymentDays") || "Payment Days"}</Label>
            <Input
              type="number"
              value={paymentDays}
              onChange={(e) => setPaymentDays(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("invoicePrefix") || "Invoice Prefix"}</Label>
            <Input value={invoicePrefix} onChange={(e) => setInvoicePrefix(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t("footerNote") || "Invoice Footer Note"}</Label>
          <Textarea
            value={footerNote}
            onChange={(e) => setFooterNote(e.target.value)}
            rows={2}
          />
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm">
          <Save className="mr-1 h-3.5 w-3.5" />
          {saving ? tc("saving") : tc("save")}
        </Button>
      </CardContent>
    </Card>
  );
}
