"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "@/lib/i18n";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";

export function CompanySettings() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [masterCurrency, setMasterCurrency] = useState("DKK");
  const [defaultHourlyRate, setDefaultHourlyRate] = useState("");
  const [useUniversalRate, setUseUniversalRate] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/economic");
        if (res.ok) {
          const data = await res.json();
          setMasterCurrency(data.masterCurrency || "DKK");
          setDefaultHourlyRate(data.defaultHourlyRate?.toString() || "");
          setUseUniversalRate(data.useUniversalRate || false);
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/economic", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterCurrency,
          defaultHourlyRate: defaultHourlyRate ? parseFloat(defaultHourlyRate) : null,
          useUniversalRate,
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

  if (loading) return <Skeleton className="h-40" />;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          {t("companySettings") || "Company Settings"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("masterCurrency") || "Currency"}</Label>
            <Select value={masterCurrency} onValueChange={setMasterCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("defaultHourlyRate") || "Default Hourly Rate"}</Label>
            <Input
              type="number"
              value={defaultHourlyRate}
              onChange={(e) => setDefaultHourlyRate(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm">
          <Save className="mr-1 h-3.5 w-3.5" />
          {saving ? tc("saving") : tc("save")}
        </Button>
      </CardContent>
    </Card>
  );
}
