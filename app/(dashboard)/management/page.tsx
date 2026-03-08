"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "@/lib/i18n";
import { PageGuide } from "@/components/ui/page-guide";
import { UnifiedApprovals } from "@/components/management/UnifiedApprovals";
import { TeamList } from "@/components/team/TeamList";
import { ResourcePlanner } from "@/components/team/ResourcePlanner";
import { AdminAuditLog } from "@/components/admin/AdminAuditLog";
import { CompanySettings } from "@/components/settings/CompanySettings";
import { TimeTrackingSettings } from "@/components/settings/TimeTrackingSettings";
import { HolidaySettings } from "@/components/settings/HolidaySettings";
import { NonBillableCategorySettings } from "@/components/settings/NonBillableCategorySettings";
import { BillingCompanyDetails } from "@/components/settings/BillingCompanyDetails";
import { AccountingSettings } from "@/components/settings/AccountingSettings";
import { ExportSettings } from "@/components/settings/ExportSettings";
import { ChevronDown } from "lucide-react";

// ─── Collapsible Section ───

function SettingsSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border/50">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-3 px-1 text-left hover:bg-muted/30 rounded-md transition-colors"
      >
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  );
}

// ─── Main Page ───

export default function ManagementPage() {
  const t = useTranslations("management");
  const tc = useTranslations("common");
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [approvalCount, setApprovalCount] = useState(0);
  const defaultTab = tabParam && ["approvals", "team", "resource-planner", "setup"].includes(tabParam)
    ? tabParam
    : "approvals";

  // Fetch pending approval count for badge
  useEffect(() => {
    async function fetchCount() {
      try {
        const res = await fetch("/api/approvals/pending");
        if (res.ok) {
          const data = await res.json();
          setApprovalCount(data.counts?.total || 0);
        }
      } catch {}
    }
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <PageGuide
        pageId="management"
        titleKey="managementTitle"
        descKey="managementDesc"
        tips={["managementTip1", "managementTip2", "managementTip3"]}
      />
      <h1 className="text-2xl font-bold text-foreground">
        {t("title") || "Management"}
      </h1>
      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="approvals" className="gap-2">
            {t("approvalsTab") || "Approvals"}
            {approvalCount > 0 && (
              <Badge className="ml-1 h-5 min-w-5 rounded-full px-1.5 text-[10px] font-bold">
                {approvalCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="team">
            {t("teamTab") || "Team"}
          </TabsTrigger>
          <TabsTrigger value="resource-planner">
            {t("resourcePlannerTab") || "Resource Planner"}
          </TabsTrigger>
          <TabsTrigger value="setup">
            {t("setupTab") || "Setup"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="approvals" className="mt-6">
          <UnifiedApprovals />
        </TabsContent>

        <TabsContent value="team" className="mt-6">
          <TeamList />
        </TabsContent>

        <TabsContent value="resource-planner" className="mt-6">
          <ResourcePlanner />
        </TabsContent>

        <TabsContent value="setup" className="mt-6">
          <div className="space-y-2">
            <SettingsSection title={t("companySettings") || "Company Settings"} defaultOpen>
              <CompanySettings />
            </SettingsSection>

            <SettingsSection title={t("timeTrackingSettings") || "Time Tracking"}>
              <TimeTrackingSettings />
            </SettingsSection>

            <SettingsSection title={t("holidaySettings") || "Holidays"}>
              <HolidaySettings />
            </SettingsSection>

            <SettingsSection title={t("absenceCategories") || "Absence Categories"}>
              <NonBillableCategorySettings />
            </SettingsSection>

            <SettingsSection title={t("billingDetails") || "Billing Company Details"}>
              <BillingCompanyDetails />
            </SettingsSection>

            <SettingsSection title={t("accountingIntegration") || "Accounting Integration"}>
              <AccountingSettings />
            </SettingsSection>

            <SettingsSection title={t("dataExport") || "Data Export"}>
              <ExportSettings />
            </SettingsSection>

            <SettingsSection title={t("auditLog") || "Audit Log"}>
              <AdminAuditLog />
            </SettingsSection>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
