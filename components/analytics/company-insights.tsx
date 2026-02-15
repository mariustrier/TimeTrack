"use client";

import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  LineChart,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ReferenceArea,
  Tooltip,
  Legend,
} from "recharts";
import {
  KpiCard,
  ChartCard,
  MiniSelect,
  ChartTooltip,
  StatusDot,
  BudgetBar,
  BILLING_COLORS,
  METRIC,
  PIE_TEAM,
  AXIS_STYLE,
  GRID_STYLE,
  fmt,
  fmtCurrency,
  ageColor,
} from "@/components/analytics/analytics-shared";
import { withProjection } from "@/lib/analytics-utils";
import { getToday } from "@/lib/demo-date";
import { useIsDemo } from "@/lib/company-context";
import { useTranslations } from "@/lib/i18n";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CompanyInsightsProps {
  dateRange: { from: Date; to: Date };
  approvalFilter: string;
  granularity: "monthly" | "weekly";
}

interface RevenueBridgeEntry {
  period: string;
  actual: number | null;
  forecast: number | null;
  breakeven: number;
}

interface ClientConcentrationEntry {
  name: string;
  revenue: number;
  pct: number;
}

interface InvoicePipelineEntry {
  period: string;
  draft: number;
  sent: number;
  paid: number;
}

interface BillingVelocityData {
  avgDays: number;
  buckets: { label: string; value: string; color: string }[];
}

interface CollectionSummaryData {
  invoiced: number;
  paid: number;
  outstanding: number;
}

interface ExpenseBreakdownEntry {
  period: string;
  salaries: number;
  rent: number;
  software: number;
  insurance: number;
  utilities: number;
  travel: number;
  other: number;
}

interface NonBillableTrendEntry {
  period: string;
  totalNB: number;
  internal: number;
  presales: number;
  nonBillable: number;
}

interface UnbilledAgingEntry {
  name: string;
  revenue: number;
  age: number;
  hours: number;
}

// ---------------------------------------------------------------------------
// Expense category colors
// ---------------------------------------------------------------------------

const EXPENSE_COLORS: Record<string, string> = {
  salaries: "#10B981",
  rent: "#6366F1",
  insurance: "#F59E0B",
  software: "#8B5CF6",
  utilities: "#EF4444",
  travel: "#3B82F6",
  other: "#F97316",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CompanyInsights({
  dateRange,
  approvalFilter,
  granularity,
}: CompanyInsightsProps) {
  const isDemo = useIsDemo();
  const t = useTranslations("analytics");
  const expenseLabel = (key: string) => {
    const map: Record<string, string> = { salaries: t("catSalaries"), rent: t("catRent"), insurance: t("catInsurance"), software: t("catSoftware"), utilities: t("catUtilities"), travel: t("catTravel"), other: t("catOther") };
    return map[key] || key;
  };
  const [loading, setLoading] = useState(true);
  const [revenueBridge, setRevenueBridge] = useState<RevenueBridgeEntry[]>([]);
  const [clientConcentration, setClientConcentration] = useState<ClientConcentrationEntry[]>([]);
  const [invoicePipeline, setInvoicePipeline] = useState<InvoicePipelineEntry[]>([]);
  const [billingVelocity, setBillingVelocity] = useState<BillingVelocityData>({ avgDays: 0, buckets: [] });
  const [collectionSummary, setCollectionSummary] = useState<CollectionSummaryData>({ invoiced: 0, paid: 0, outstanding: 0 });
  const [expenseBreakdown, setExpenseBreakdown] = useState<ExpenseBreakdownEntry[]>([]);
  const [nonBillableTrend, setNonBillableTrend] = useState<NonBillableTrendEntry[]>([]);
  const [unbilledAging, setUnbilledAging] = useState<UnbilledAgingEntry[]>([]);
  const [currency, setCurrency] = useState("DKK");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          type: "company",
          startDate: format(dateRange.from, "yyyy-MM-dd"),
          endDate: format(dateRange.to, "yyyy-MM-dd"),
          granularity,
          approvalFilter,
        });
        const res = await fetch(`/api/analytics?${params}`);
        if (!res.ok) throw new Error("Failed to fetch company analytics");
        const data = await res.json();
        setRevenueBridge(data.revenueBridge ?? []);
        setClientConcentration(data.clientConcentration ?? []);
        setInvoicePipeline(data.invoicePipeline ?? []);
        setBillingVelocity(data.billingVelocity ?? { avgDays: 0, buckets: [] });
        setCollectionSummary(data.collectionSummary ?? { invoiced: 0, paid: 0, outstanding: 0 });
        setExpenseBreakdown(data.expenseBreakdown ?? []);
        setNonBillableTrend(data.nonBillableTrend ?? []);
        setUnbilledAging(data.unbilledAging ?? []);
        setCurrency(data.currency ?? "DKK");
      } catch (err) {
        console.error("[CompanyInsights]", err);
        setRevenueBridge([]);
        setClientConcentration([]);
        setInvoicePipeline([]);
        setExpenseBreakdown([]);
        setNonBillableTrend([]);
        setUnbilledAging([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dateRange.from, dateRange.to, granularity, approvalFilter]);

  // ---- Derived ----
  const projectedNonBillable = useMemo(
    () => withProjection(nonBillableTrend, getToday(isDemo), granularity, ["totalNB", "internal", "presales", "nonBillable"]),
    [nonBillableTrend, granularity]
  );

  const projectedExpenseBreakdown = useMemo(
    () => withProjection(
      expenseBreakdown.map((d) => ({ ...d, _total: d.salaries + d.rent + d.software + d.insurance + d.utilities + d.travel + d.other })),
      getToday(isDemo),
      granularity,
      ["_total"]
    ),
    [expenseBreakdown, granularity]
  );

  const projectedInvoicePipeline = useMemo(
    () => withProjection(
      invoicePipeline.map((d) => ({ ...d, _total: d.draft + d.sent + d.paid })),
      getToday(isDemo),
      granularity,
      ["_total"]
    ),
    [invoicePipeline, granularity]
  );

  const topClientPct = useMemo(() => {
    if (clientConcentration.length === 0) return 0;
    return clientConcentration[0].pct;
  }, [clientConcentration]);

  const maxUnbilledRevenue = useMemo(() => {
    if (unbilledAging.length === 0) return 1;
    return Math.max(...unbilledAging.map((u) => u.revenue));
  }, [unbilledAging]);

  // Breakeven value from first entry that has it
  const breakevenValue = useMemo(() => {
    const entry = revenueBridge.find((e) => e.breakeven > 0);
    return entry?.breakeven ?? 0;
  }, [revenueBridge]);

  // ---- Render ----
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* ============================================================
          1. REVENUE BRIDGE (full-width)
         ============================================================ */}
      <ChartCard
        title={t("revenueBridge")}
        badge={{ label: t("forecast"), bg: "#EEF2FF", fg: "#4338CA" }}
        help={t("revenueBridgeHelp")}
        height={320}
      >
        {revenueBridge.length === 0 && !loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 320, color: "#9CA3AF", fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
            {t("noRevenueData")}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={revenueBridge} margin={{ top: 10, right: 120, bottom: 10, left: 10 }}>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis dataKey="period" tick={AXIS_STYLE} tickLine={false} />
              <YAxis tick={AXIS_STYLE} tickLine={false} tickFormatter={(v: number) => fmtCurrency(v)} />
              <Tooltip
                content={
                  <ChartTooltip
                    formatter={(v, k) => {
                      if (k === "actual") return fmtCurrency(v);
                      if (k === "forecast") return fmtCurrency(v);
                      return fmtCurrency(v);
                    }}
                  />
                }
              />
              <Legend
                formatter={(value: string) => {
                  if (value === "actual") return t("actual");
                  if (value === "forecast") return t("forecast");
                  return value;
                }}
                wrapperStyle={{ fontSize: 10, fontFamily: "'DM Sans', sans-serif" }}
              />
              {/* Actual revenue bar */}
              <Bar
                dataKey="actual"
                fill={METRIC.revenue}
                name="actual"
                radius={[2, 2, 0, 0]}
              />
              {/* Forecast bar — indigo, 40% opacity, dashed stroke */}
              <Bar
                dataKey="forecast"
                fill="#6366F1"
                fillOpacity={0.4}
                stroke="#6366F1"
                strokeDasharray="4 4"
                name="forecast"
                radius={[2, 2, 0, 0]}
              />
              {/* Break-even line */}
              {breakevenValue > 0 && (
                <ReferenceLine
                  y={breakevenValue}
                  stroke="#EF4444"
                  strokeDasharray="6 3"
                  strokeWidth={1.5}
                  label={{
                    value: `Break-even ${fmtCurrency(breakevenValue)}`,
                    position: "right",
                    style: {
                      fontSize: 10,
                      fontFamily: "'JetBrains Mono', monospace",
                      fill: "#EF4444",
                      fontWeight: 600,
                    },
                  }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* ============================================================
          2. CLIENT CONCENTRATION + INVOICE PIPELINE (2-col)
         ============================================================ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        {/* Client Concentration — donut Pie */}
        <ChartCard
          title={t("clientConcentration")}
          badge={topClientPct > 40 ? { label: t("monitorBadge"), bg: "#FFFBEB", fg: "#D97706" } : undefined}
          help={t("clientConcentrationHelp")}
          height={300}
        >
          {clientConcentration.length === 0 && !loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "#9CA3AF", fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
              {t("noClientData")}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={clientConcentration}
                  dataKey="revenue"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={105}
                  paddingAngle={2}
                  label={({ pct, cx, cy, midAngle, innerRadius, outerRadius }: any) => {
                    if (pct < 5) return null;
                    const RADIAN = Math.PI / 180;
                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                    return (
                      <text
                        x={x}
                        y={y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        style={{
                          fontSize: 11,
                          fontFamily: "'JetBrains Mono', monospace",
                          fontWeight: 600,
                          fill: "#FFFFFF",
                        }}
                      >
                        {pct}%
                      </text>
                    );
                  }}
                >
                  {clientConcentration.map((_, i) => (
                    <Cell key={i} fill={PIE_TEAM[i % PIE_TEAM.length]} />
                  ))}
                </Pie>
                <Tooltip
                  content={
                    <ChartTooltip formatter={(v) => fmtCurrency(v)} />
                  }
                />
                <Legend
                  wrapperStyle={{ fontSize: 10, fontFamily: "'DM Sans', sans-serif" }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Invoice Pipeline — stacked Bar */}
        <ChartCard
          title={t("invoicePipeline")}
          help={t("invoicePipelineHelp")}
          height={300}
        >
          {invoicePipeline.length === 0 && !loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "#9CA3AF", fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
              {t("noInvoiceData")}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={projectedInvoicePipeline} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis dataKey="period" tick={AXIS_STYLE} tickLine={false} />
                <YAxis tick={AXIS_STYLE} tickLine={false} tickFormatter={(v: number) => fmtCurrency(v)} />
                <Tooltip
                  content={
                    <ChartTooltip formatter={(v) => fmtCurrency(v)} />
                  }
                />
                <Legend
                  formatter={(value: string) => {
                    if (value === "paid") return t("paid");
                    if (value === "sent") return t("sent");
                    if (value === "draft") return t("draft");
                    return value;
                  }}
                  wrapperStyle={{ fontSize: 10, fontFamily: "'DM Sans', sans-serif" }}
                />
                <Bar dataKey="paid" stackId="pipeline" fill="#10B981" name="paid" radius={[0, 0, 0, 0]} />
                <Bar dataKey="sent" stackId="pipeline" fill="#3B82F6" name="sent" radius={[0, 0, 0, 0]} />
                <Bar dataKey="draft" stackId="pipeline" fill="#F59E0B" name="draft" radius={[2, 2, 0, 0]} />
                <Line type="monotone" dataKey="proj__total" stroke="#6366F1" strokeWidth={2} strokeDasharray="6 3" dot={false} legendType="none" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ============================================================
          3. BILLING VELOCITY + COLLECTION + EXPENSE BREAKDOWN (1fr + 2fr)
         ============================================================ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginBottom: 12 }}>
        {/* Left column: Billing Velocity + Collection Summary */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Billing Velocity — manual card */}
          <div
            style={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              padding: "16px 18px",
              transition: "box-shadow 0.2s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 600,
                color: "hsl(var(--foreground))",
                marginBottom: 12,
              }}
            >
              {t("billingVelocity")}
            </div>
            {/* Big number */}
            <div
              style={{
                fontSize: 36,
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 700,
                color: "hsl(var(--foreground))",
                lineHeight: 1.1,
              }}
            >
              {billingVelocity.avgDays.toFixed(1)}
            </div>
            <div
              style={{
                fontSize: 11,
                fontFamily: "'DM Sans', sans-serif",
                color: "#9CA3AF",
                marginTop: 4,
                marginBottom: 14,
              }}
            >
              {t("billingVelocityDesc")}
            </div>
            {/* Bucket pills */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {billingVelocity.buckets.map((bucket, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 20,
                    background: `${bucket.color}14`,
                    border: `1px solid ${bucket.color}33`,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 600,
                      color: bucket.color,
                    }}
                  >
                    {bucket.value}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: "'DM Sans', sans-serif",
                      color: "hsl(var(--muted-foreground))",
                    }}
                  >
                    {bucket.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Collection Summary — manual card */}
          <div
            style={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              padding: "16px 18px",
              transition: "box-shadow 0.2s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 600,
                color: "hsl(var(--foreground))",
                marginBottom: 12,
              }}
            >
              {t("collectionSummary")}
            </div>
            {/* Rows */}
            {[
              { label: t("totalInvoiced"), value: collectionSummary.invoiced, color: "hsl(var(--foreground))" },
              { label: t("paid"), value: collectionSummary.paid, color: "#10B981" },
              { label: t("outstanding"), value: collectionSummary.outstanding, color: "#F59E0B" },
            ].map((row, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 0",
                  borderBottom: i < 2 ? "1px solid hsl(var(--muted))" : undefined,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontFamily: "'DM Sans', sans-serif",
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  {row.label}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 600,
                    color: row.color,
                  }}
                >
                  {fmtCurrency(row.value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right column: Expense Breakdown */}
        <ChartCard
          title={t("expenseBreakdown")}
          help={t("expenseBreakdownHelp")}
          height={290}
        >
          {expenseBreakdown.length === 0 && !loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 290, color: "#9CA3AF", fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
              {t("noExpenseData")}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={290}>
              <ComposedChart data={projectedExpenseBreakdown} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis dataKey="period" tick={AXIS_STYLE} tickLine={false} />
                <YAxis tick={AXIS_STYLE} tickLine={false} tickFormatter={(v: number) => fmtCurrency(v)} />
                <Tooltip
                  content={
                    <ChartTooltip
                      formatter={(v, k) => fmtCurrency(v)}
                    />
                  }
                />
                <Legend
                  formatter={(value: string) => expenseLabel(value)}
                  wrapperStyle={{ fontSize: 10, fontFamily: "'DM Sans', sans-serif" }}
                />
                <Bar dataKey="salaries" stackId="exp" fill={EXPENSE_COLORS.salaries} name="salaries" />
                <Bar dataKey="rent" stackId="exp" fill={EXPENSE_COLORS.rent} name="rent" />
                <Bar dataKey="insurance" stackId="exp" fill={EXPENSE_COLORS.insurance} name="insurance" />
                <Bar dataKey="software" stackId="exp" fill={EXPENSE_COLORS.software} name="software" />
                <Bar dataKey="utilities" stackId="exp" fill={EXPENSE_COLORS.utilities} name="utilities" />
                <Bar dataKey="travel" stackId="exp" fill={EXPENSE_COLORS.travel} name="travel" />
                <Bar dataKey="other" stackId="exp" fill={EXPENSE_COLORS.other} name="other" radius={[2, 2, 0, 0]} />
                <Line type="monotone" dataKey="proj__total" stroke="#6366F1" strokeWidth={2} strokeDasharray="6 3" dot={false} legendType="none" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ============================================================
          4. NON-BILLABLE TREND + UNBILLED WORK AGING (2-col)
         ============================================================ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* Non-Billable Trend — LineChart */}
        <ChartCard
          title={t("nonBillableTrend")}
          help={t("nonBillableTrendHelp")}
          height={280}
        >
          {nonBillableTrend.length === 0 && !loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 280, color: "#9CA3AF", fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
              {t("noTrendData")}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={projectedNonBillable} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                <CartesianGrid {...GRID_STYLE} />
                {/* Green zone 0-15% */}
                <ReferenceArea y1={0} y2={15} fill="#10B981" fillOpacity={0.06} />
                {/* Amber zone 15-25% */}
                <ReferenceArea y1={15} y2={25} fill="#F59E0B" fillOpacity={0.06} />
                <XAxis dataKey="period" tick={AXIS_STYLE} tickLine={false} />
                <YAxis tick={AXIS_STYLE} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip
                  content={
                    <ChartTooltip formatter={(v) => `${v.toFixed(1)}%`} />
                  }
                />
                <Legend
                  formatter={(value: string) => {
                    if (value === "totalNB") return t("totalNonBillableShort");
                    if (value === "internal") return t("internal");
                    if (value === "presales") return t("preSales");
                    if (value === "nonBillable") return t("nonBillableShort");
                    return value;
                  }}
                  wrapperStyle={{ fontSize: 10, fontFamily: "'DM Sans', sans-serif" }}
                />
                {/* Total NB — gray dashed */}
                <Line
                  type="monotone"
                  dataKey="totalNB"
                  stroke="#9CA3AF"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={{ fill: "#9CA3AF", r: 3 }}
                  activeDot={{ r: 5 }}
                  name="totalNB"
                />
                {/* Internal — purple */}
                <Line
                  type="monotone"
                  dataKey="internal"
                  stroke="#8B5CF6"
                  strokeWidth={2}
                  dot={{ fill: "#8B5CF6", r: 3 }}
                  activeDot={{ r: 5 }}
                  name="internal"
                />
                {/* Presales — blue */}
                <Line
                  type="monotone"
                  dataKey="presales"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ fill: "#3B82F6", r: 3 }}
                  activeDot={{ r: 5 }}
                  name="presales"
                />
                {/* Non-billable — amber */}
                <Line
                  type="monotone"
                  dataKey="nonBillable"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  dot={{ fill: "#F59E0B", r: 3 }}
                  activeDot={{ r: 5 }}
                  name="nonBillable"
                />
                {/* Projection lines */}
                <Line dataKey="proj_totalNB" stroke="#9CA3AF" strokeWidth={2} strokeDasharray="6 3" dot={false} legendType="none" />
                <Line dataKey="proj_internal" stroke="#8B5CF6" strokeWidth={2} strokeDasharray="6 3" dot={false} legendType="none" />
                <Line dataKey="proj_presales" stroke="#3B82F6" strokeWidth={2} strokeDasharray="6 3" dot={false} legendType="none" />
                <Line dataKey="proj_nonBillable" stroke="#F59E0B" strokeWidth={2} strokeDasharray="6 3" dot={false} legendType="none" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Unbilled Work Aging — list layout */}
        <ChartCard
          title={t("unbilledWork")}
          help={t("unbilledWorkHelp")}
          height={280}
        >
          {unbilledAging.length === 0 && !loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 280, color: "#9CA3AF", fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
              {t("noUnbilledData")}
            </div>
          ) : (
            <div
              style={{
                height: 280,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: "4px 0",
              }}
            >
              {[...unbilledAging]
                .sort((a, b) => b.revenue - a.revenue)
                .map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "6px 8px",
                      borderRadius: 6,
                      background: "hsl(var(--muted))",
                      border: "1px solid hsl(var(--muted))",
                    }}
                  >
                    {/* Status dot */}
                    <StatusDot color={ageColor(item.age)} pulse={item.age >= 61} />

                    {/* Project name + hours/age */}
                    <div style={{ flex: "0 0 auto", minWidth: 100, maxWidth: 140 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontFamily: "'DM Sans', sans-serif",
                          fontWeight: 500,
                          color: "hsl(var(--foreground))",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {item.name}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          fontFamily: "'JetBrains Mono', monospace",
                          color: "#9CA3AF",
                        }}
                      >
                        {item.hours.toFixed(0)}t / {item.age}d
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div style={{ flex: 1, minWidth: 60 }}>
                      <div
                        style={{
                          height: 5,
                          background: "hsl(var(--muted))",
                          borderRadius: 3,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.min((item.revenue / maxUnbilledRevenue) * 100, 100)}%`,
                            background: ageColor(item.age),
                            borderRadius: 3,
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                    </div>

                    {/* Revenue amount */}
                    <span
                      style={{
                        fontSize: 12,
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 600,
                        color: "hsl(var(--foreground))",
                        whiteSpace: "nowrap",
                        minWidth: 70,
                        textAlign: "right",
                      }}
                    >
                      {fmtCurrency(item.revenue)}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
