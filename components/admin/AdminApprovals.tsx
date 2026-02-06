"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TimeEntryApprovals } from "@/components/approvals/time-entry-approvals";
import { ExpenseApprovals } from "@/components/approvals/expense-approvals";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "@/lib/i18n";

export function AdminApprovals() {
  const t = useTranslations("approvals");
  const [counts, setCounts] = useState<{ timeEntryApprovals?: number; expenseApprovals?: number }>({});

  useEffect(() => {
    async function fetchCounts() {
      try {
        const res = await fetch("/api/admin/pending-counts");
        if (res.ok) {
          const data = await res.json();
          setCounts(data.counts || {});
        }
      } catch (error) {
        console.error("Failed to fetch pending counts:", error);
      }
    }
    fetchCounts();
  }, []);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="time-entries">
        <div className="flex items-center gap-2">
          <TabsList>
            <TabsTrigger value="time-entries" className="gap-2">
              {t("timeEntriesTab")}
              {counts.timeEntryApprovals ? (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5">
                  {counts.timeEntryApprovals}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="expenses" className="gap-2">
              {t("expensesTab")}
              {counts.expenseApprovals ? (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5">
                  {counts.expenseApprovals}
                </Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>
        </div>
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
