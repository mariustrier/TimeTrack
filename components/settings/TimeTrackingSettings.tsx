"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Save, Clock, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "@/lib/i18n";

export function TimeTrackingSettings() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flexStartDate, setFlexStartDate] = useState("");
  const [expenseThreshold, setExpenseThreshold] = useState("");
  const [aiAnonymization, setAiAnonymization] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/economic");
        if (res.ok) {
          const data = await res.json();
          setFlexStartDate(data.flexStartDate || "");
          setExpenseThreshold(data.expenseAutoApproveThreshold?.toString() || "");
          setAiAnonymization(data.aiAnonymization ?? true);
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  async function handleSaveFlexDate() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/economic", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flexStartDate: flexStartDate || null }),
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

  async function handleSaveExpenseThreshold() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/economic", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseAutoApproveThreshold: expenseThreshold ? parseFloat(expenseThreshold) : null,
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

  async function handleToggleAnonymization(checked: boolean) {
    setAiAnonymization(checked);
    try {
      const res = await fetch("/api/admin/economic", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiAnonymization: checked }),
      });
      if (res.ok) {
        toast.success(tc("saved"));
      } else {
        toast.error(tc("saveFailed"));
        setAiAnonymization(!checked);
      }
    } catch {
      toast.error(tc("saveFailed"));
      setAiAnonymization(!checked);
    }
  }

  if (loading) return <Skeleton className="h-48" />;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          {t("timeTrackingSettings") || "Time Tracking Settings"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Flex Start Date */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" />
            {t("flexStartDate") || "Flex Balance Start Date"}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t("flexStartDateDesc") || "Flex balance calculations start from this date (or employee creation date, whichever is later)."}
          </p>
          <div className="flex gap-2">
            <Input
              type="date"
              value={flexStartDate}
              onChange={(e) => setFlexStartDate(e.target.value)}
              className="w-48"
            />
            <Button onClick={handleSaveFlexDate} disabled={saving} size="sm">
              <Save className="mr-1 h-3.5 w-3.5" />
              {tc("save")}
            </Button>
            {flexStartDate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFlexStartDate("");
                  handleSaveFlexDate();
                }}
              >
                {tc("clear") || "Clear"}
              </Button>
            )}
          </div>
        </div>

        {/* Expense Auto-Approve Threshold */}
        <div className="space-y-2">
          <Label>{t("expenseAutoApproveThreshold") || "Expense Auto-Approve Threshold"}</Label>
          <p className="text-xs text-muted-foreground">
            {t("expenseThresholdDesc") || "Expenses below this amount are automatically approved."}
          </p>
          <div className="flex gap-2">
            <Input
              type="number"
              value={expenseThreshold}
              onChange={(e) => setExpenseThreshold(e.target.value)}
              placeholder="0"
              className="w-32"
            />
            <Button onClick={handleSaveExpenseThreshold} disabled={saving} size="sm">
              <Save className="mr-1 h-3.5 w-3.5" />
              {tc("save")}
            </Button>
          </div>
        </div>

        {/* AI Anonymization */}
        <div className="flex items-center justify-between">
          <div>
            <Label>{t("aiAnonymization") || "AI Anonymization"}</Label>
            <p className="text-xs text-muted-foreground">
              {t("aiAnonymizationDesc") || "Anonymize employee data before sending to AI."}
            </p>
          </div>
          <Switch checked={aiAnonymization} onCheckedChange={handleToggleAnonymization} />
        </div>
      </CardContent>
    </Card>
  );
}
