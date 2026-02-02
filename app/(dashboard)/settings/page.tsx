"use client";

import { useState, useEffect } from "react";
import { Download, Trash2, AlertTriangle, Clock, RotateCcw } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { PageGuide } from "@/components/ui/page-guide";
import { toast } from "sonner";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tl = useTranslations("legal");
  const tc = useTranslations("common");
  const [downloading, setDownloading] = useState(false);
  const [deletionStatus, setDeletionStatus] = useState<any>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replaying, setReplaying] = useState(false);

  useEffect(() => {
    fetch("/api/user/deletion-status")
      .then((r) => r.json())
      .then(setDeletionStatus)
      .catch(() => {});
  }, []);

  const handleExport = async () => {
    setDownloading(true);
    try {
      const res = await fetch("/api/user/export");
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `my-data-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("downloaded"));
    } catch {
      toast.error("Export failed");
    } finally {
      setDownloading(false);
    }
  };

  const handleDeletionRequest = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/user/delete-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: deleteReason || undefined }),
      });
      if (!res.ok) throw new Error();
      setShowDeleteDialog(false);
      setDeletionStatus({ requested: true, requestedAt: new Date().toISOString() });
      toast.success(t("deletionPending"));
    } catch {
      toast.error("Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplayTour = async () => {
    setReplaying(true);
    try {
      await fetch("/api/auth/complete-tour", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset: true }),
      });
      window.location.href = "/dashboard";
    } catch {
      setReplaying(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageGuide pageId="settings" titleKey="settingsTitle" descKey="settingsDesc" tips={["settingsTip1", "settingsTip2", "settingsTip3"]} />
      <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>

      {/* Replay Tour Section */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start gap-4">
          <RotateCcw className="h-6 w-6 text-brand-500 mt-0.5" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-foreground">{t("replayTour")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("replayTourDesc")}</p>
            <button
              onClick={handleReplayTour}
              disabled={replaying}
              className="mt-4 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-50"
            >
              {replaying ? t("replaying") : t("replayTour")}
            </button>
          </div>
        </div>
      </div>

      {/* Data Export Section */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start gap-4">
          <Download className="h-6 w-6 text-brand-500 mt-0.5" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-foreground">{t("dataExport")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("dataExportDesc")}</p>
            <button
              onClick={handleExport}
              disabled={downloading}
              className="mt-4 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-50"
            >
              {downloading ? t("downloading") : t("downloadData")}
            </button>
          </div>
        </div>
      </div>

      {/* Account Deletion Section */}
      <div className="rounded-xl border border-destructive/30 bg-card p-6">
        <div className="flex items-start gap-4">
          <Trash2 className="h-6 w-6 text-destructive mt-0.5" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-foreground">{t("deleteAccountTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("deleteAccountDesc")}</p>
            <p className="mt-2 text-xs text-muted-foreground">{t("financialDataNotice")}</p>

            {deletionStatus?.requested && !deletionStatus?.denied ? (
              <div className="mt-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">{t("deletionPending")}</p>
                </div>
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  {t("deletionPendingDesc").replace("{date}", new Date(deletionStatus.requestedAt).toLocaleDateString())}
                </p>
              </div>
            ) : deletionStatus?.denied ? (
              <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-4">
                <p className="text-sm font-medium text-red-800 dark:text-red-200">{t("deletionDenied")}</p>
                <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                  {t("deletionDeniedDesc").replace("{reason}", deletionStatus.deniedReason || "")}
                </p>
              </div>
            ) : (
              <>
                {!showDeleteDialog ? (
                  <button
                    onClick={() => setShowDeleteDialog(true)}
                    className="mt-4 rounded-lg border border-destructive bg-transparent px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  >
                    {t("submitDeletionRequest")}
                  </button>
                ) : (
                  <div className="mt-4 space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm font-medium">{t("deleteAccountTitle")}</span>
                    </div>
                    <textarea
                      value={deleteReason}
                      onChange={(e) => setDeleteReason(e.target.value)}
                      placeholder={t("deleteReasonPlaceholder")}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleDeletionRequest}
                        disabled={submitting}
                        className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
                      >
                        {submitting ? t("submitting") : t("submitDeletionRequest")}
                      </button>
                      <button
                        onClick={() => setShowDeleteDialog(false)}
                        className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
                      >
                        {tc("cancel")}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
