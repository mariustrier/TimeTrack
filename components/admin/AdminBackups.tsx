"use client";

import { useState } from "react";
import { HardDrive, Download, FileArchive, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";

export function AdminBackups() {
  const t = useTranslations("backups");
  const [downloading, setDownloading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleExport() {
    setDownloading(true);
    setSuccess(false);
    try {
      const res = await fetch("/api/admin/export");
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cloudtimer-backup-${new Date().toISOString().split("T")[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccess(true);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-950">
                <FileArchive className="h-5 w-5 text-brand-600 dark:text-brand-400" />
              </div>
              <CardTitle className="text-lg">{t("fullExport")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("fullExportDescription")}
            </p>
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <h4 className="text-sm font-medium text-foreground">{t("zipContains")}</h4>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>- {t("usersFile")}</li>
                <li>- {t("projectsFile")}</li>
                <li>- {t("entriesFile")}</li>
                <li>- {t("metadataFile")}</li>
                <li>- {t("readmeFile")}</li>
              </ul>
            </div>
            <Button
              onClick={handleExport}
              disabled={downloading}
              className="w-full"
            >
              {downloading ? (
                <>{t("generating")}</>
              ) : success ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {t("downloaded")}
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  {t("downloadBackup")}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <HardDrive className="h-5 w-5 text-muted-foreground" />
              </div>
              <CardTitle className="text-lg">{t("dataInfo")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("dataInfoDescription")}
            </p>
            <div className="space-y-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium text-foreground">{t("format")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("formatDescription")}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium text-foreground">{t("scope")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("scopeDescription")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
