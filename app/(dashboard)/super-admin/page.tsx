"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  Building2,
  Users,
  Clock,
  Sparkles,
  KeyRound,
  Loader2,
  LogIn,
  FileDown,
  DatabaseZap,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CompanyInfo {
  id: string;
  name: string;
  currency: string;
  createdAt: string;
  userCount: number;
  entryCount: number;
  importedEntryCount: number;
  lastImportDate: string | null;
  accountingSystem: string | null;
}

interface CompanyUsage {
  companyId: string;
  companyName: string;
  dailyCostCents: number;
  monthlyCostCents: number;
  totalCostCents: number;
}

interface UsageData {
  usage: CompanyUsage[];
  totals: {
    dailyCostCents: number;
    monthlyCostCents: number;
    totalCostCents: number;
    dailyLimitCents: number;
    monthlyLimitCents: number;
  };
}

interface SupportSession {
  id: string;
  companyId: string;
  status: string;
  company: { id: string; name: string };
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function SuperAdminPage() {
  const t = useTranslations("superAdmin");
  const ts = useTranslations("support");
  const router = useRouter();

  const [companies, setCompanies] = useState<CompanyInfo[]>([]);
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SupportSession[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [backfillLoading, setBackfillLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [companiesRes, usageRes, sessionsRes] = await Promise.all([
        fetch("/api/super-admin/companies"),
        fetch("/api/super-admin/usage"),
        fetch("/api/super-admin/access/status"),
      ]);
      if (companiesRes.ok) setCompanies(await companiesRes.json());
      if (usageRes.ok) setUsageData(await usageRes.json());
      if (sessionsRes.ok) setSessions(await sessionsRes.json());
    } catch (error) {
      console.error("Failed to fetch super admin data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getSessionForCompany = (companyId: string) => {
    return sessions.find(
      (s) => s.companyId === companyId && ["pending", "granted", "active"].includes(s.status)
    );
  };

  const handleRequestAccess = async (companyId: string) => {
    setActionLoading(companyId);
    try {
      const res = await fetch("/api/super-admin/access/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      if (res.ok) {
        toast.success(ts("requestSent"));
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || ts("requestFailed"));
      }
    } catch {
      toast.error(ts("requestFailed"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleEnter = async (sessionId: string) => {
    setActionLoading(sessionId);
    try {
      const res = await fetch("/api/super-admin/access/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supportAccessId: sessionId }),
      });
      if (res.ok) {
        toast.success(ts("sessionStarted"));
        router.push("/dashboard");
        router.refresh();
      } else {
        toast.error(ts("enterFailed"));
      }
    } catch {
      toast.error(ts("enterFailed"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleBackfillActivities = async () => {
    if (!confirm(t("backfillConfirm"))) return;
    setBackfillLoading(true);
    try {
      const res = await fetch("/api/super-admin/backfill-activities", {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.activitiesCreated > 0) {
          toast.success(`${t("backfillSuccess")}: ${data.projectsProcessed} projects, ${data.activitiesCreated} activities`);
        } else {
          toast.info(t("backfillNone"));
        }
      } else {
        toast.error("Backfill failed");
      }
    } catch {
      toast.error("Backfill failed");
    } finally {
      setBackfillLoading(false);
    }
  };

  const totalUsers = companies.reduce((sum, c) => sum + c.userCount, 0);
  const totalEntries = companies.reduce((sum, c) => sum + c.entryCount, 0);
  const totalImported = companies.reduce((sum, c) => sum + c.importedEntryCount, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{companies.length}</p>
              <p className="text-sm text-muted-foreground">{t("totalCompanies")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-950">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalUsers}</p>
              <p className="text-sm text-muted-foreground">{t("totalUsers")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-950">
              <Clock className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalEntries.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">{t("totalEntries")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950">
              <FileDown className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalImported.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">{t("totalImported")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Companies Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("companies")}</CardTitle>
        </CardHeader>
        <CardContent>
          {companies.length === 0 ? (
            <div className="py-8 text-center">
              <Building2 className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 font-medium text-foreground">{t("noCompanies")}</p>
              <p className="text-sm text-muted-foreground">{t("noCompaniesDescription")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium text-muted-foreground">{t("companyName")}</th>
                    <th className="pb-2 font-medium text-muted-foreground">{t("users")}</th>
                    <th className="pb-2 font-medium text-muted-foreground">{t("entries")}</th>
                    <th className="pb-2 font-medium text-muted-foreground">{t("importedEntries")}</th>
                    <th className="pb-2 font-medium text-muted-foreground">{t("lastImport")}</th>
                    <th className="pb-2 font-medium text-muted-foreground">{t("accounting")}</th>
                    <th className="pb-2 font-medium text-muted-foreground">{t("created")}</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground">{ts("access")}</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => {
                    const session = getSessionForCompany(company.id);
                    return (
                      <tr key={company.id} className="border-b last:border-0">
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{company.name}</span>
                            <Badge variant="outline" className="text-xs">{company.currency}</Badge>
                          </div>
                        </td>
                        <td className="py-3 text-muted-foreground">{company.userCount}</td>
                        <td className="py-3 text-muted-foreground">{company.entryCount.toLocaleString()}</td>
                        <td className="py-3 text-muted-foreground">
                          {company.importedEntryCount > 0 ? (
                            <span className="font-medium text-amber-600">{company.importedEntryCount.toLocaleString()}</span>
                          ) : (
                            <span className="text-muted-foreground/50">-</span>
                          )}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {company.lastImportDate ? (
                            new Date(company.lastImportDate).toLocaleDateString()
                          ) : (
                            <span className="text-muted-foreground/50">-</span>
                          )}
                        </td>
                        <td className="py-3">
                          {company.accountingSystem ? (
                            <Badge variant="outline" className="text-xs capitalize">
                              {company.accountingSystem}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground/50">-</span>
                          )}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {new Date(company.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 text-right">
                          {!session && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7"
                              onClick={() => handleRequestAccess(company.id)}
                              disabled={actionLoading === company.id}
                            >
                              {actionLoading === company.id ? (
                                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                              ) : (
                                <KeyRound className="mr-1.5 h-3 w-3" />
                              )}
                              {ts("requestAccess")}
                            </Button>
                          )}
                          {session?.status === "pending" && (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                              {ts("pending")}
                            </Badge>
                          )}
                          {session?.status === "granted" && (
                            <Button
                              size="sm"
                              className="h-7 bg-green-600 hover:bg-green-700"
                              onClick={() => handleEnter(session.id)}
                              disabled={actionLoading === session.id}
                            >
                              {actionLoading === session.id ? (
                                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                              ) : (
                                <LogIn className="mr-1.5 h-3 w-3" />
                              )}
                              {ts("enter")}
                            </Button>
                          )}
                          {session?.status === "active" && (
                            <Badge className="bg-amber-500 text-white">
                              {ts("active")}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backfill Timeline Activities */}
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="font-medium text-foreground">{t("backfillActivities")}</p>
            <p className="text-sm text-muted-foreground">{t("backfillDescription")}</p>
          </div>
          <Button
            variant="outline"
            onClick={handleBackfillActivities}
            disabled={backfillLoading}
          >
            {backfillLoading ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <DatabaseZap className="mr-1.5 h-4 w-4" />
            )}
            {t("backfillActivities")}
          </Button>
        </CardContent>
      </Card>

      {/* AI Usage */}
      {usageData && (
        <>
          {/* Budget Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                {t("budgetOverview")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("dailyBudget")}</span>
                    <span className="font-medium text-foreground">
                      {formatCents(usageData.totals.dailyCostCents)} / {formatCents(usageData.totals.dailyLimitCents)}
                    </span>
                  </div>
                  <Progress
                    value={
                      usageData.totals.dailyLimitCents > 0
                        ? Math.min((usageData.totals.dailyCostCents / usageData.totals.dailyLimitCents) * 100, 100)
                        : 0
                    }
                    className="h-2"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("monthlyBudget")}</span>
                    <span className="font-medium text-foreground">
                      {formatCents(usageData.totals.monthlyCostCents)} / {formatCents(usageData.totals.monthlyLimitCents)}
                    </span>
                  </div>
                  <Progress
                    value={
                      usageData.totals.monthlyLimitCents > 0
                        ? Math.min((usageData.totals.monthlyCostCents / usageData.totals.monthlyLimitCents) * 100, 100)
                        : 0
                    }
                    className="h-2"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Per-Company AI Usage */}
          <Card>
            <CardHeader>
              <CardTitle>{t("aiCostBreakdown")}</CardTitle>
            </CardHeader>
            <CardContent>
              {usageData.usage.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">{t("noCost")}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 font-medium text-muted-foreground">{t("companyName")}</th>
                        <th className="pb-2 text-right font-medium text-muted-foreground">{t("dailyCost")}</th>
                        <th className="pb-2 text-right font-medium text-muted-foreground">{t("monthlyCost")}</th>
                        <th className="pb-2 text-right font-medium text-muted-foreground">{t("totalCost")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usageData.usage.map((u) => (
                        <tr key={u.companyId} className="border-b last:border-0">
                          <td className="py-3 font-medium text-foreground">{u.companyName}</td>
                          <td className="py-3 text-right text-muted-foreground">{formatCents(u.dailyCostCents)}</td>
                          <td className="py-3 text-right text-muted-foreground">{formatCents(u.monthlyCostCents)}</td>
                          <td className="py-3 text-right font-medium text-foreground">{formatCents(u.totalCostCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
