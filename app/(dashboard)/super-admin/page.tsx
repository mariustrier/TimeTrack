"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Building2,
  Users,
  Clock,
  Sparkles,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface CompanyInfo {
  id: string;
  name: string;
  currency: string;
  createdAt: string;
  userCount: number;
  entryCount: number;
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

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function SuperAdminPage() {
  const t = useTranslations("superAdmin");

  const [companies, setCompanies] = useState<CompanyInfo[]>([]);
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [companiesRes, usageRes] = await Promise.all([
        fetch("/api/super-admin/companies"),
        fetch("/api/super-admin/usage"),
      ]);
      if (companiesRes.ok) setCompanies(await companiesRes.json());
      if (usageRes.ok) setUsageData(await usageRes.json());
    } catch (error) {
      console.error("Failed to fetch super admin data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalUsers = companies.reduce((sum, c) => sum + c.userCount, 0);
  const totalEntries = companies.reduce((sum, c) => sum + c.entryCount, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                    <th className="pb-2 font-medium text-muted-foreground">{t("created")}</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => (
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
                        {new Date(company.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
