"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { UninvoicedTab } from "@/components/billing/UninvoicedTab";
import { InvoicesTab } from "@/components/billing/InvoicesTab";
import { PageHeader } from "@/components/layout/PageHeader";

export default function BillingPage() {
  const t = useTranslations("billing");
  const [activeTab, setActiveTab] = useState<"uninvoiced" | "invoices">("uninvoiced");

  return (
    <div>
      <PageHeader
        title={t("title")}
        tabs={[
          { key: "uninvoiced", label: t("uninvoiced") },
          { key: "invoices", label: t("invoices") },
        ]}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as "uninvoiced" | "invoices")}
      />

      {/* Accounting system notice */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300 mb-6">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <p>{t("accountingNotice")}</p>
      </div>

      {/* Tab Content */}
      {activeTab === "uninvoiced" && <UninvoicedTab />}
      {activeTab === "invoices" && <InvoicesTab />}
    </div>
  );
}
