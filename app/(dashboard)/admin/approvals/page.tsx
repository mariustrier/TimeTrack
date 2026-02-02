"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TimeEntryApprovals } from "@/components/approvals/time-entry-approvals";
import { ExpenseApprovals } from "@/components/approvals/expense-approvals";
import { useTranslations } from "@/lib/i18n";
import { PageGuide } from "@/components/ui/page-guide";
import { InfoTooltip } from "@/components/ui/info-tooltip";

export default function ApprovalsPage() {
  const t = useTranslations("approvals");

  return (
    <div className="space-y-6">
      <PageGuide pageId="approvals" titleKey="approvalsTitle" descKey="approvalsDesc" tips={["approvalsTip1", "approvalsTip2", "approvalsTip3"]} />
      <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
      <Tabs defaultValue="time-entries">
        <TabsList>
          <TabsTrigger value="time-entries" className="flex items-center gap-1">{t("timeEntriesTab")} <InfoTooltip textKey="timeEntriesTab" size={12} /></TabsTrigger>
          <TabsTrigger value="expenses" className="flex items-center gap-1">{t("expensesTab")} <InfoTooltip textKey="expensesTab" size={12} /></TabsTrigger>
        </TabsList>
        <TabsContent value="time-entries">
          <TimeEntryApprovals />
        </TabsContent>
        <TabsContent value="expenses">
          <ExpenseApprovals />
        </TabsContent>
      </Tabs>
    </div>
  );
}
