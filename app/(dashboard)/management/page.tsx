"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "@/lib/i18n";
import { PageGuide } from "@/components/ui/page-guide";
import { PageHeader } from "@/components/layout/PageHeader";
import { UnifiedApprovals } from "@/components/management/UnifiedApprovals";
import { TeamList } from "@/components/team/TeamList";
import { ResourcePlanner } from "@/components/team/ResourcePlanner";
import { AdminAuditLog } from "@/components/admin/AdminAuditLog";
import { CompanySettings } from "@/components/settings/CompanySettings";
import { TimeTrackingSettings } from "@/components/settings/TimeTrackingSettings";
import { HolidaySettings } from "@/components/settings/HolidaySettings";
import { PhaseSettings } from "@/components/settings/PhaseSettings";
import { RoleCategorySettings } from "@/components/settings/RoleCategorySettings";
import { AbsenceCategorySettings } from "@/components/settings/AbsenceCategorySettings";
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
  const [activeTab, setActiveTab] = useState(defaultTab);

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
      <PageHeader
        title={t("title") || "Management"}
        tabs={[
          { key: "approvals", label: t("approvalsTab") || "Approvals", count: approvalCount || undefined },
          { key: "team", label: t("teamTab") || "Team" },
          { key: "resource-planner", label: t("resourcePlannerTab") || "Resource Planner" },
          { key: "setup", label: t("setupTab") || "Setup" },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {activeTab === "approvals" && <UnifiedApprovals />}

      {activeTab === "team" && <TeamList />}

      {activeTab === "resource-planner" && <ResourcePlanner />}

      {activeTab === "setup" && (
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

          <SettingsSection title={t("phases") || "Project Phases"}>
            <PhaseSettings />
          </SettingsSection>

          <SettingsSection title={t("employeeCategories") || "Employee Categories"}>
            <RoleCategorySettings />
          </SettingsSection>

          <SettingsSection title={t("absenceCategories") || "Absence Categories"}>
            <AbsenceCategorySettings />
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
      )}
    </div>
  );
}
