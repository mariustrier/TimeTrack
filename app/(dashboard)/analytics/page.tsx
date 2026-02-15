"use client";

import { useState, useEffect, useMemo } from "react";
import { subMonths, format } from "date-fns";
import { getToday } from "@/lib/demo-date";
import { useIsDemo } from "@/lib/company-context";
import { useTranslations } from "@/lib/i18n";
import {
  KpiCard,
  FontLoader,
  AnalyticsKeyframes,
  fmtCurrency,
  fmt,
} from "@/components/analytics/analytics-shared";
import { EmployeeInsights } from "@/components/analytics/employee-insights";
import { TeamInsights } from "@/components/analytics/team-insights";
import { ProjectInsights } from "@/components/analytics/project-insights";
import { CompanyInsights } from "@/components/analytics/company-insights";

// ---------------------------------------------------------------------------
// TabBtn — inline tab button component
// ---------------------------------------------------------------------------

function TabBtn({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number | null;
}) {
  const [hover, setHover] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 12px",
        borderRadius: 4,
        border: "none",
        cursor: "pointer",
        fontSize: 12,
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: 600,
        background: active ? "#EEF2FF" : hover ? "hsl(var(--muted))" : "transparent",
        color: active ? "#4338CA" : "hsl(var(--muted-foreground))",
        transition: "all 0.15s ease",
        whiteSpace: "nowrap",
      }}
    >
      {label}
      {count != null && count > 0 && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 16,
            height: 16,
            padding: "0 5px",
            borderRadius: 8,
            fontSize: 10,
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            background: "#EF4444",
            color: "#FFFFFF",
            lineHeight: 1,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// ToggleBtn — inline toggle button for granularity / approval
// ---------------------------------------------------------------------------

function ToggleBtn({
  label,
  active,
  onClick,
  position,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  position: "left" | "right";
}) {
  const [hover, setHover] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: "4px 10px",
        border: "none",
        cursor: "pointer",
        fontSize: 11,
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: 600,
        background: active ? "#EEF2FF" : hover ? "hsl(var(--muted))" : "hsl(var(--card))",
        color: active ? "#4338CA" : "hsl(var(--muted-foreground))",
        borderRadius:
          position === "left" ? "4px 0 0 4px" : "0 4px 4px 0",
        transition: "all 0.15s ease",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AnalyticsPage() {
  const t = useTranslations("analytics");
  const isDemo = useIsDemo();

  const [activeTab, setActiveTab] = useState("employee");
  const [granularity, setGranularity] = useState<"monthly" | "weekly">(
    "monthly"
  );
  const [approvalFilter, setApprovalFilter] = useState("approved_only");
  const today = getToday(isDemo);
  const dateRange = useMemo(
    () => ({ from: subMonths(today, 3), to: today }),
    [isDemo]
  );
  const [kpis, setKpis] = useState<any>(null);
  const [redListCount, setRedListCount] = useState(0);

  // -------------------------------------------------------------------------
  // KPI fetch
  // -------------------------------------------------------------------------
  useEffect(() => {
    const params = new URLSearchParams({
      type: "kpis",
      startDate: format(dateRange.from, "yyyy-MM-dd"),
      endDate: format(dateRange.to, "yyyy-MM-dd"),
      approvalFilter,
    });
    fetch(`/api/analytics?${params}`)
      .then((r) => r.json())
      .then((data) => setKpis(data))
      .catch(() => {});
  }, [dateRange, approvalFilter]);

  // -------------------------------------------------------------------------
  // Red list count — projects over 90% budget
  // -------------------------------------------------------------------------
  useEffect(() => {
    const params = new URLSearchParams({
      type: "project",
      startDate: format(dateRange.from, "yyyy-MM-dd"),
      endDate: format(dateRange.to, "yyyy-MM-dd"),
      approvalFilter,
    });
    fetch(`/api/analytics?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.projects && Array.isArray(data.projects)) {
          const atRisk = data.projects.filter(
            (p: any) =>
              p.budgetHours &&
              p.budgetHours > 0 &&
              p.totalHours / p.budgetHours >= 0.9
          );
          setRedListCount(atRisk.length);
        }
      })
      .catch(() => {});
  }, [dateRange, approvalFilter]);

  // -------------------------------------------------------------------------
  // Tabs config
  // -------------------------------------------------------------------------
  const tabs = [
    { key: "employee", label: t("employee") },
    { key: "team", label: t("team") },
    { key: "project", label: t("project"), count: redListCount },
    { key: "company", label: t("company") },
  ];

  return (
    <div
      style={{
        fontFamily: "'DM Sans', sans-serif",
        background: "hsl(var(--background))",
        minHeight: "100vh",
        color: "hsl(var(--foreground))",
      }}
    >
      <FontLoader />
      <AnalyticsKeyframes />

      {/* ----------------------------------------------------------------- */}
      {/* Header — sticky                                                    */}
      {/* ----------------------------------------------------------------- */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "hsl(var(--card))",
          borderBottom: "1px solid hsl(var(--border))",
          padding: "14px 28px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          {/* Left side: title + tabs */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <h1
              style={{
                fontSize: 15,
                fontWeight: 700,
                margin: 0,
                fontFamily: "'DM Sans', sans-serif",
                color: "hsl(var(--foreground))",
                whiteSpace: "nowrap",
              }}
            >
              {t("title")}
            </h1>

            {/* Tab pills container */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: "hsl(var(--muted))",
                borderRadius: 6,
                padding: 2,
                gap: 1,
              }}
            >
              {tabs.map((tab) => (
                <TabBtn
                  key={tab.key}
                  label={tab.label}
                  active={activeTab === tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  count={tab.count}
                />
              ))}
            </div>
          </div>

          {/* Right side: granularity toggle, approval toggle, date range */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {/* Granularity toggle */}
            <div
              style={{
                display: "flex",
                border: "1px solid hsl(var(--border))",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <ToggleBtn
                label={t("monthly")}
                active={granularity === "monthly"}
                onClick={() => setGranularity("monthly")}
                position="left"
              />
              <ToggleBtn
                label={t("weekly")}
                active={granularity === "weekly"}
                onClick={() => setGranularity("weekly")}
                position="right"
              />
            </div>

            {/* Approval filter toggle */}
            <div
              style={{
                display: "flex",
                border: "1px solid hsl(var(--border))",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <ToggleBtn
                label={t("approvedOnly")}
                active={approvalFilter === "approved_only"}
                onClick={() => setApprovalFilter("approved_only")}
                position="left"
              />
              <ToggleBtn
                label={t("allEntries")}
                active={approvalFilter === "all"}
                onClick={() => setApprovalFilter("all")}
                position="right"
              />
            </div>

            {/* Date range display */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "4px 12px",
                border: "1px solid hsl(var(--border))",
                borderRadius: 4,
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 500,
                color: "hsl(var(--muted-foreground))",
                background: "hsl(var(--card))",
                whiteSpace: "nowrap",
                userSelect: "none",
              }}
            >
              {format(dateRange.from, "d. MMM")} {"\u2014"}{" "}
              {format(dateRange.to, "d. MMM")}
            </div>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* KPI Bar                                                            */}
      {/* ----------------------------------------------------------------- */}
      <div
        style={{
          display: "flex",
          gap: 12,
          padding: "16px 28px",
          overflowX: "auto",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <KpiCard
            label={t("revenueForecast30d")}
            value={kpis?.revenueForecast30d != null ? fmtCurrency(kpis.revenueForecast30d) : "\u2014"}
            sub={t("fromPlannerAllocations")}
            color="#10B981"
            trend="up"
            help={t("revenueForecastHelp")}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <KpiCard
            label={t("ebitdaEst")}
            value={kpis?.ebitda != null ? fmtCurrency(kpis.ebitda) : "\u2014"}
            sub={t("revenueMinusCostOverhead")}
            color="#6366F1"
            trend="up"
            help={t("ebitdaHelp")}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <KpiCard
            label={t("avgEffectiveRate")}
            value={kpis?.avgEffectiveRate != null ? `${kpis.avgEffectiveRate} kr./t` : "\u2014"}
            sub={t("revenueDivTotalHours")}
            help={t("avgEffectiveRateHelp")}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <KpiCard
            label={t("unbilledRevenue")}
            value={kpis?.unbilledRevenue != null ? fmtCurrency(kpis.unbilledRevenue) : "\u2014"}
            sub={kpis?.unbilledAvgAgeDays != null ? t("avgDaysAging", { days: kpis.unbilledAvgAgeDays }) : undefined}
            color="#F59E0B"
            warn
            help={t("unbilledRevenueHelp")}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <KpiCard
            label={t("leaveLiability")}
            value={kpis?.leaveLiability != null ? fmtCurrency(kpis.leaveLiability) : "\u2014"}
            sub={t("earnedVacationTimesCostRate")}
            color="#9CA3AF"
            help={t("leaveLiabilityHelp")}
          />
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Tab Content                                                        */}
      {/* ----------------------------------------------------------------- */}
      <div style={{ padding: "0 28px 40px" }}>
        {activeTab === "employee" && (
          <EmployeeInsights
            dateRange={dateRange}
            approvalFilter={approvalFilter}
            granularity={granularity}
          />
        )}
        {activeTab === "team" && (
          <TeamInsights
            dateRange={dateRange}
            approvalFilter={approvalFilter}
            granularity={granularity}
          />
        )}
        {activeTab === "project" && (
          <ProjectInsights
            dateRange={dateRange}
            approvalFilter={approvalFilter}
            granularity={granularity}
          />
        )}
        {activeTab === "company" && (
          <CompanyInsights
            dateRange={dateRange}
            approvalFilter={approvalFilter}
            granularity={granularity}
          />
        )}
      </div>
    </div>
  );
}
