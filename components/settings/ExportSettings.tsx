"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "@/lib/i18n";

export function ExportSettings() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");

  const [exportStart, setExportStart] = useState("");
  const [exportEnd, setExportEnd] = useState("");
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (!exportStart || !exportEnd) {
      toast.error(t("selectDateRange") || "Select a date range");
      return;
    }
    setExporting(true);
    try {
      const params = new URLSearchParams({ startDate: exportStart, endDate: exportEnd });
      const res = await fetch(`/api/admin/export/economic?${params}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `export-${exportStart}-${exportEnd}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(t("exportSuccess") || "Export downloaded");
      } else {
        toast.error(t("exportFailed") || "Export failed");
      }
    } catch {
      toast.error(t("exportFailed") || "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          {t("dataExport") || "Data Export"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t("exportDesc") || "Export time entries as CSV for your accounting system."}
        </p>
        <div className="flex items-end gap-3">
          <div className="space-y-2">
            <Label>{tc("from") || "From"}</Label>
            <Input
              type="date"
              value={exportStart}
              onChange={(e) => setExportStart(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-2">
            <Label>{tc("to") || "To"}</Label>
            <Input
              type="date"
              value={exportEnd}
              onChange={(e) => setExportEnd(e.target.value)}
              className="w-40"
            />
          </div>
          <Button onClick={handleExport} disabled={exporting} size="sm">
            <Download className="mr-1 h-3.5 w-3.5" />
            {exporting ? tc("exporting") || "Exporting..." : tc("export") || "Export"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
