"use client";

import { useState } from "react";
import { HardDrive, Download, FileArchive, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function BackupsPage() {
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
      a.download = `timetrack-backup-${new Date().toISOString().split("T")[0]}.zip`;
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
      <h1 className="text-2xl font-bold text-slate-900">Backups & Export</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50">
                <FileArchive className="h-5 w-5 text-brand-600" />
              </div>
              <CardTitle className="text-lg">Full Data Export</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Download a complete backup of your company data as a ZIP file
              containing CSV exports of all users, projects, and time entries.
            </p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-sm font-medium text-slate-900">ZIP contains:</h4>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                <li>- users.csv (team members & rates)</li>
                <li>- projects.csv (all projects)</li>
                <li>- time-entries.csv (all time entries)</li>
                <li>- metadata.json (export metadata)</li>
                <li>- README.txt (file descriptions)</li>
              </ul>
            </div>
            <Button
              onClick={handleExport}
              disabled={downloading}
              className="w-full"
            >
              {downloading ? (
                <>Generating backup...</>
              ) : success ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Downloaded!
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download Backup
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                <HardDrive className="h-5 w-5 text-slate-600" />
              </div>
              <CardTitle className="text-lg">Data Information</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your data is stored securely and backed up automatically. Manual
              exports give you a portable copy of all your company data.
            </p>
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-sm font-medium text-slate-900">Format</p>
                <p className="text-xs text-slate-500">
                  CSV files in a ZIP archive, compatible with Excel, Google
                  Sheets, and other tools.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-sm font-medium text-slate-900">Scope</p>
                <p className="text-xs text-slate-500">
                  Exports all data for your company. Personal data is limited to
                  company members only.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
