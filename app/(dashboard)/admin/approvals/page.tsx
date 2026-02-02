"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TimeEntryApprovals } from "@/components/approvals/time-entry-approvals";
import { ExpenseApprovals } from "@/components/approvals/expense-approvals";
import { useTranslations } from "@/lib/i18n";

export default function ApprovalsPage() {
  const t = useTranslations("approvals");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
      <Tabs defaultValue="time-entries">
        <TabsList>
          <TabsTrigger value="time-entries">{t("timeEntriesTab")}</TabsTrigger>
          <TabsTrigger value="expenses">{t("expensesTab")}</TabsTrigger>
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
