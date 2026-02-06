"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AdminOverview } from "@/components/admin/AdminOverview";
import { AdminApprovals } from "@/components/admin/AdminApprovals";
import { AdminVacations } from "@/components/admin/AdminVacations";
import { AdminBackups } from "@/components/admin/AdminBackups";
import { useTranslations } from "@/lib/i18n";
import { PageGuide } from "@/components/ui/page-guide";

export default function AdminPage() {
  const t = useTranslations("admin");
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    async function fetchCounts() {
      try {
        const res = await fetch("/api/admin/pending-counts");
        if (res.ok) {
          const data = await res.json();
          setCounts(data.counts || {});
        }
      } catch {}
    }
    fetchCounts();
    const interval = setInterval(fetchCounts, 60000);
    return () => clearInterval(interval);
  }, []);

  const approvalCount = (counts.approvals || 0) + (counts.expenseApprovals || 0);
  const vacationCount = counts.vacationManagement || 0;

  return (
    <div className="space-y-6">
      <PageGuide
        pageId="admin"
        titleKey="adminTitle"
        descKey="adminDesc"
        tips={["adminTip1", "adminTip2", "adminTip3"]}
      />
      <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t("overviewTab")}</TabsTrigger>
          <TabsTrigger value="approvals" className="gap-2">
            {t("approvalsTab")}
            {approvalCount > 0 && (
              <Badge className="ml-1 h-5 min-w-5 rounded-full px-1.5 text-[10px] font-bold">
                {approvalCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="vacations" className="gap-2">
            {t("vacationsTab")}
            {vacationCount > 0 && (
              <Badge className="ml-1 h-5 min-w-5 rounded-full px-1.5 text-[10px] font-bold">
                {vacationCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="backups">{t("backupsTab")}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-6">
          <AdminOverview />
        </TabsContent>
        <TabsContent value="approvals" className="mt-6">
          <AdminApprovals />
        </TabsContent>
        <TabsContent value="vacations" className="mt-6">
          <AdminVacations />
        </TabsContent>
        <TabsContent value="backups" className="mt-6">
          <AdminBackups />
        </TabsContent>
      </Tabs>
    </div>
  );
}
