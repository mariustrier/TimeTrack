"use client";

import { useState } from "react";
import { FileText, Info } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { UninvoicedTab } from "@/components/billing/UninvoicedTab";
import { InvoicesTab } from "@/components/billing/InvoicesTab";
import { BillingSettings } from "@/components/billing/BillingSettings";

export default function BillingPage() {
  const t = useTranslations("billing");
  const [activeTab, setActiveTab] = useState<"uninvoiced" | "invoices" | "settings">("uninvoiced");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-brand-500" />
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
      </div>

      {/* Accounting system notice */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <p>{t("accountingNotice")}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["uninvoiced", "invoices", "settings"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-brand-500 text-brand-600 dark:text-brand-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(tab)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "uninvoiced" && <UninvoicedTab />}
      {activeTab === "invoices" && <InvoicesTab />}
      {activeTab === "settings" && <BillingSettings />}
    </div>
  );
}
