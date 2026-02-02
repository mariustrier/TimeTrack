"use client";

import { useState } from "react";
import { subMonths } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRangePicker, DateRange } from "@/components/ui/date-range-picker";
import { EmployeeInsights } from "@/components/analytics/employee-insights";
import { TeamInsights } from "@/components/analytics/team-insights";
import { ProjectInsights } from "@/components/analytics/project-insights";
import { CompanyInsights } from "@/components/analytics/company-insights";
import { useTranslations } from "@/lib/i18n";
import { PageGuide } from "@/components/ui/page-guide";

export default function AnalyticsPage() {
  const t = useTranslations("analytics");
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subMonths(new Date(), 3),
    to: new Date(),
  });
  const [approvalFilter, setApprovalFilter] = useState("approved_only");
  const [granularity, setGranularity] = useState<"monthly" | "weekly">(
    "monthly"
  );

  return (
    <div className="space-y-6">
      <PageGuide pageId="analytics" titleKey="analyticsTitle" descKey="analyticsDesc" tips={["analyticsTip1", "analyticsTip2", "analyticsTip3"]} />
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={granularity} onValueChange={(v) => setGranularity(v as "monthly" | "weekly")}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">{t("monthly")}</SelectItem>
              <SelectItem value="weekly">{t("weekly")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={approvalFilter} onValueChange={setApprovalFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="approved_only">{t("approvedOnly")}</SelectItem>
              <SelectItem value="all">{t("allEntries")}</SelectItem>
            </SelectContent>
          </Select>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="employee">
        <TabsList>
          <TabsTrigger value="employee">{t("employee")}</TabsTrigger>
          <TabsTrigger value="team">{t("team")}</TabsTrigger>
          <TabsTrigger value="project">{t("project")}</TabsTrigger>
          <TabsTrigger value="company">{t("company")}</TabsTrigger>
        </TabsList>

        <TabsContent value="employee">
          <EmployeeInsights
            dateRange={dateRange}
            approvalFilter={approvalFilter}
            granularity={granularity}
          />
        </TabsContent>

        <TabsContent value="team">
          <TeamInsights
            dateRange={dateRange}
            approvalFilter={approvalFilter}
            granularity={granularity}
          />
        </TabsContent>

        <TabsContent value="project">
          <ProjectInsights
            dateRange={dateRange}
            approvalFilter={approvalFilter}
            granularity={granularity}
          />
        </TabsContent>

        <TabsContent value="company">
          <CompanyInsights
            dateRange={dateRange}
            approvalFilter={approvalFilter}
            granularity={granularity}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
