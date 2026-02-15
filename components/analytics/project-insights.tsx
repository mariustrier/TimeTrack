"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ReferenceArea,
  BarChart,
  Bar,
  AreaChart,
  Area,
  ComposedChart,
  Line,
  PieChart,
  Pie,
  Cell,
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

interface ProjectInsightsProps {
  dateRange: { from: Date; to: Date };
  approvalFilter: string;
  granularity: "monthly" | "weekly";
}

interface ProjectItem {
  id: string;
  name: string;
  client: string;
  color: string;
  budgetHours: number;
  margin: number;
}

interface RedListItem {
  name: string;
  client: string;
  color: string;
  pm: string;
  budgetHours: number;
  usedHours: number;
  budgetPct: number;
  timePct: number;
  overrun: number;
  margin: number;
}

interface BudgetVelocityItem {
  name: string;
  timeElapsed: number;
  budgetConsumed: number;
  color: string;
  hours: number;
}

interface BillableMixItem {
  name: string;
  billable: number;
  included: number;
  nonBillable: number;
  internal: number;
  presales: number;
  budgetHours: number;
}

interface BurndownPoint {
  period: string;
  hoursRemaining: number;
  idealBurn: number;
}

interface ProfitabilityPoint {
  period: string;
  revenue: number;
  cost: number;
  profit: number;
}

interface PhaseDistPoint {
  name: string;
  hours: number;
  color: string;
}

interface TeamContribPoint {
  name: string;
  hours: number;
  pct: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BILLING_STATUS_KEYS = ["billable", "included", "nonBillable", "internal", "presales"] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProjectInsights({
  dateRange,
  approvalFilter,
  granularity,
}: ProjectInsightsProps) {
  const isDemo = useIsDemo();
  const t = useTranslations("analytics");

  const billingLabel = (key: string) => {
    const map: Record<string, string> = { billable: t("billable"), included: t("included"), nonBillable: t("nonBillable"), internal: t("internal"), presales: t("preSales") };
    return map[key] || key;
  };

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [redList, setRedList] = useState<RedListItem[]>([]);
  const [budgetVelocity, setBudgetVelocity] = useState<BudgetVelocityItem[]>([]);
  const [billableMix, setBillableMix] = useState<BillableMixItem[]>([]);
  const [currency, setCurrency] = useState("DKK");

  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [burndown, setBurndown] = useState<BurndownPoint[]>([]);
  const [profitability, setProfitability] = useState<ProfitabilityPoint[]>([]);
  const [phaseDistribution, setPhaseDistribution] = useState<PhaseDistPoint[]>([]);
  const [teamContribution, setTeamContribution] = useState<TeamContribPoint[]>([]);

  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const startDate = format(dateRange.from, "yyyy-MM-dd");
  const endDate = format(dateRange.to, "yyyy-MM-dd");

  // ---- Fetch overview data (no projectId) ----
  const fetchOverview = useCallback(async () => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams({
        type: "project",
        startDate,
        endDate,
        approvalFilter,
      });
      const res = await fetch(`/api/analytics?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setProjects(data.projects ?? []);
      setRedList(data.redList ?? []);
      setBudgetVelocity(data.budgetVelocity ?? []);
      setBillableMix(data.billableMix ?? []);
      setCurrency(data.currency ?? "DKK");
    } finally {
      setLoadingList(false);
    }
  }, [startDate, endDate, approvalFilter]);

  // ---- Fetch detail for selected project ----
  const fetchDetail = useCallback(async () => {
    if (!selectedProjectId) return;
    setLoadingDetail(true);
    try {
      const params = new URLSearchParams({
        type: "project",
        startDate,
        endDate,
        approvalFilter,
        projectId: selectedProjectId,
        granularity,
      });
      const res = await fetch(`/api/analytics?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setBurndown(data.burndown ?? []);
      setProfitability(data.profitability ?? []);
      setPhaseDistribution(data.phaseDistribution ?? []);
      setTeamContribution(data.teamContribution ?? []);
      setRedList(data.redList ?? []);
      setBudgetVelocity(data.budgetVelocity ?? []);
      setBillableMix(data.billableMix ?? []);
      setCurrency(data.currency ?? "DKK");
    } finally {
      setLoadingDetail(false);
    }
  }, [selectedProjectId, startDate, endDate, approvalFilter, granularity]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    if (selectedProjectId) fetchDetail();
  }, [selectedProjectId, fetchDetail]);

  // ---- Derived data ----
  const projectedBurndown = useMemo(
    () => withProjection(burndown, getToday(isDemo), granularity, ["hoursRemaining"]),
    [burndown, granularity]
  );

  const projectedProfitability = useMemo(
    () => withProjection(profitability, getToday(isDemo), granularity, ["revenue", "cost", "profit"]),
    [profitability, granularity]
  );

  const projectOptions = useMemo(
    () => projects.map((p) => ({ value: p.id, label: `${p.name}${p.client ? ` (${p.client})` : ""}` })),
    [projects]
  );

  // ---- Scatter tooltip renderer ----
  const renderScatterTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const d = payload[0]?.payload as BudgetVelocityItem | undefined;
    if (!d) return null;
    const overPace = d.budgetConsumed > d.timeElapsed;
    return (
      <div
        style={{
          background: "#1F2937",
          borderRadius: 8,
          padding: "10px 14px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
          minWidth: 160,
        }}
      >
        <div style={{ fontSize: 12, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, color: "#FFFFFF", marginBottom: 6 }}>
          {d.name}
        </div>
        <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "#D1D5DB", marginBottom: 2 }}>
          {t("timeLabel")} {d.timeElapsed}%
        </div>
        <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "#D1D5DB", marginBottom: 2 }}>
          {t("budgetLabel")} {d.budgetConsumed}%
        </div>
        <div
          style={{
            fontSize: 11,
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 600,
            color: overPace ? "#EF4444" : "#10B981",
            marginTop: 4,
          }}
        >
          {overPace ? t("overPace") : t("healthy")}
        </div>
      </div>
    );
  };

  // ---- Render ----
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* ============================================================
          1. RED LIST TABLE
         ============================================================ */}
      {redList.length > 0 && (
        <ChartCard
          title={t("redList")}
          badge={{ label: t("flaggedCount", { count: redList.length }), bg: "#FEE2E2", fg: "#DC2626" }}
          info={t("redListInfo")}
          help={t("redListHelp")}
        >
          <div style={{ width: "100%", overflowX: "auto" }}>
            {/* Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.8fr 0.8fr 1.2fr 0.8fr 0.6fr",
                gap: 8,
                padding: "6px 0",
                borderBottom: "1px solid hsl(var(--border))",
              }}
            >
              {[t("colProject"), t("colPL"), t("colBudget"), t("colOverrun"), t("colMargin")].map((h) => (
                <span
                  key={h}
                  style={{
                    fontSize: 10,
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "#9CA3AF",
                  }}
                >
                  {h}
                </span>
              ))}
            </div>
            {/* Rows */}
            {redList.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.8fr 0.8fr 1.2fr 0.8fr 0.6fr",
                  gap: 8,
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: "1px solid hsl(var(--muted))",
                }}
              >
                {/* Projekt */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <StatusDot color={item.color} />
                  <span style={{ fontSize: 12, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, color: "hsl(var(--foreground))" }}>
                    {item.name}
                  </span>
                </div>
                {/* PM */}
                <span style={{ fontSize: 11, fontFamily: "'DM Sans', sans-serif", color: "hsl(var(--muted-foreground))" }}>
                  {item.pm}
                </span>
                {/* Budget */}
                <BudgetBar used={item.usedHours} total={item.budgetHours} />
                {/* Overrun */}
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 600,
                    color: item.overrun > 0 ? "#EF4444" : "#10B981",
                  }}
                >
                  {item.overrun > 0 ? `+${item.overrun}t` : t("onTrack")}
                </span>
                {/* Margin */}
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 600,
                    color: item.margin < 20 ? "#EF4444" : item.margin < 30 ? "#F59E0B" : "#10B981",
                  }}
                >
                  {item.margin}%
                </span>
              </div>
            ))}
          </div>
        </ChartCard>
      )}

      {/* ============================================================
          2. PROJECT SELECTOR
         ============================================================ */}
      <div style={{ width: 240 }}>
        <MiniSelect
          value={selectedProjectId}
          onChange={setSelectedProjectId}
          options={[{ value: "", label: t("selectProject") }, ...projectOptions]}
          width={240}
        />
      </div>

      {/* ============================================================
          3. BUDGET VELOCITY + BILLABLE MIX (2-col)
         ============================================================ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        {/* Budget Velocity — Scatter */}
        <ChartCard
          title={t("budgetVelocity")}
          help={t("budgetVelocityHelp")}
          height={300}
        >
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis
                type="number"
                dataKey="timeElapsed"
                name={t("timeLabel")}
                domain={[0, 100]}
                tick={AXIS_STYLE}
                tickLine={false}
                label={{ value: t("timeSpentPct"), position: "insideBottom", offset: -4, style: { ...AXIS_STYLE, fontSize: 9 } }}
              />
              <YAxis
                type="number"
                dataKey="budgetConsumed"
                name={t("budgetLabel")}
                domain={[0, 100]}
                tick={AXIS_STYLE}
                tickLine={false}
                label={{ value: t("budgetSpentPct"), angle: -90, position: "insideLeft", style: { ...AXIS_STYLE, fontSize: 9 } }}
              />
              <ZAxis dataKey="hours" range={[60, 300]} name={t("hours")} />
              {/* Red tint above diagonal */}
              <ReferenceArea x1={0} x2={100} y1={0} y2={100} fill="#EF4444" fillOpacity={0.04} />
              {/* Diagonal */}
              <ReferenceLine
                segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]}
                stroke="#9CA3AF"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
              <Tooltip content={renderScatterTooltip} />
              <Scatter name={t("projects")} data={budgetVelocity}>
                {budgetVelocity.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.budgetConsumed > entry.timeElapsed ? "#EF4444" : entry.color}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Billable Mix — stacked Bar */}
        <ChartCard
          title={t("billableMix")}
          help={t("billableMixHelp")}
          height={300}
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={billableMix} margin={{ top: 10, right: 10, bottom: 60, left: 10 }}>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis
                dataKey="name"
                tick={{ ...AXIS_STYLE, fontSize: 9 }}
                tickLine={false}
                angle={-45}
                textAnchor="end"
                interval={0}
                height={70}
              />
              <YAxis tick={AXIS_STYLE} tickLine={false} />
              <Tooltip
                content={
                  <ChartTooltip
                    formatter={(v, k) => {
                      const label = billingLabel(k);
                      return `${v.toFixed(1)}t`;
                    }}
                  />
                }
              />
              <Legend
                formatter={(value: string) => billingLabel(value)}
                wrapperStyle={{ fontSize: 10, fontFamily: "'DM Sans', sans-serif" }}
              />
              {BILLING_STATUS_KEYS.map((key) => (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId="mix"
                  fill={BILLING_COLORS[key]}
                  name={key}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ============================================================
          4. BURN-DOWN + PROFITABILITY (2-col, project-selected only)
         ============================================================ */}
      {selectedProjectId && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          {/* Contract Burn-down */}
          <ChartCard
            title={t("contractBurndown")}
            help={t("contractBurndownHelp")}
            height={300}
          >
            {burndown.length === 0 && !loadingDetail ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "#9CA3AF", fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
                {t("noBurndownData")}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={projectedBurndown} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                  <CartesianGrid {...GRID_STYLE} />
                  <XAxis dataKey="period" tick={AXIS_STYLE} tickLine={false} />
                  <YAxis tick={AXIS_STYLE} tickLine={false} />
                  <Tooltip
                    content={
                      <ChartTooltip
                        formatter={(v, k) => {
                          if (k === "hoursRemaining") return t("hoursRemainingFmt", { hours: v.toFixed(1) });
                          if (k === "idealBurn") return t("hoursIdealFmt", { hours: v.toFixed(1) });
                          return `${v.toFixed(1)}t`;
                        }}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="hoursRemaining"
                    stroke="#10B981"
                    fill="#10B981"
                    fillOpacity={0.15}
                    strokeWidth={2}
                    name={t("hoursRemaining")}
                  />
                  <Line
                    type="monotone"
                    dataKey="idealBurn"
                    stroke="#9CA3AF"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name={t("idealBurn")}
                  />
                  {/* Projection */}
                  <Line dataKey="proj_hoursRemaining" stroke="#10B981" strokeWidth={2} strokeDasharray="6 3" dot={false} legendType="none" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Project Profitability */}
          <ChartCard
            title={t("projectProfitability")}
            help={t("profitabilityHelp")}
            height={300}
          >
            {profitability.length === 0 && !loadingDetail ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "#9CA3AF", fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
                {t("noProfitData")}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={projectedProfitability} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                  <CartesianGrid {...GRID_STYLE} />
                  <XAxis dataKey="period" tick={AXIS_STYLE} tickLine={false} />
                  <YAxis tick={AXIS_STYLE} tickLine={false} tickFormatter={(v: number) => fmtCurrency(v)} />
                  <Tooltip
                    content={
                      <ChartTooltip
                        formatter={(v, k) => {
                          if (k === "revenue") return fmtCurrency(v);
                          if (k === "cost") return fmtCurrency(v);
                          if (k === "profit") return fmtCurrency(v);
                          return fmtCurrency(v);
                        }}
                      />
                    }
                  />
                  <Legend
                    formatter={(value: string) => {
                      if (value === "revenue") return t("revenue");
                      if (value === "cost") return t("cost");
                      if (value === "profit") return t("profit");
                      return value;
                    }}
                    wrapperStyle={{ fontSize: 10, fontFamily: "'DM Sans', sans-serif" }}
                  />
                  <Bar dataKey="revenue" fill={METRIC.revenue} name="revenue" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="cost" fill={METRIC.cost} name="cost" radius={[2, 2, 0, 0]} />
                  <Line type="monotone" dataKey="profit" stroke={METRIC.profit} strokeWidth={2} dot={{ r: 3, fill: METRIC.profit }} name="profit" />
                  {/* Projections */}
                  <Line dataKey="proj_revenue" stroke={METRIC.revenue} strokeWidth={2} strokeDasharray="6 3" dot={false} legendType="none" />
                  <Line dataKey="proj_cost" stroke={METRIC.cost} strokeWidth={2} strokeDasharray="6 3" dot={false} legendType="none" />
                  <Line dataKey="proj_profit" stroke={METRIC.profit} strokeWidth={2} strokeDasharray="6 3" dot={false} legendType="none" />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      )}

      {/* ============================================================
          5. PHASE DISTRIBUTION + TEAM CONTRIBUTION (2-col, project)
         ============================================================ */}
      {selectedProjectId && (phaseDistribution.length > 0 || teamContribution.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* Phase Distribution — vertical bar */}
          <ChartCard
            title={t("phaseDistribution")}
            help={t("phaseDistributionHelp")}
            height={300}
          >
            {phaseDistribution.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "#9CA3AF", fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
                {t("noPhaseData")}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={phaseDistribution} layout="vertical" margin={{ top: 10, right: 20, bottom: 10, left: 80 }}>
                  <CartesianGrid {...GRID_STYLE} />
                  <XAxis type="number" tick={AXIS_STYLE} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={AXIS_STYLE}
                    tickLine={false}
                    width={75}
                  />
                  <Tooltip
                    content={
                      <ChartTooltip formatter={(v) => `${v.toFixed(1)}t`} />
                    }
                  />
                  <Bar dataKey="hours" name={t("hours")} radius={[0, 4, 4, 0]}>
                    {phaseDistribution.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Team Contribution — donut Pie */}
          <ChartCard
            title={t("teamContribution")}
            help={t("teamContributionHelp")}
            height={300}
          >
            {teamContribution.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "#9CA3AF", fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
                {t("noTeamData")}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={teamContribution}
                    dataKey="hours"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={110}
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
                    {teamContribution.map((_, i) => (
                      <Cell key={i} fill={PIE_TEAM[i % PIE_TEAM.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={
                      <ChartTooltip
                        formatter={(v, k) => `${v.toFixed(1)}t`}
                      />
                    }
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 10, fontFamily: "'DM Sans', sans-serif" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      )}
    </div>
  );
}
