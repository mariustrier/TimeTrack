"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { format } from "date-fns";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
} from "recharts";
import {
  KpiCard,
  ChartCard,
  MiniSelect,
  ChartTooltip,
  InfoTip,
  BILLING_COLORS,
  METRIC,
  AXIS_STYLE,
  GRID_STYLE,
  fmt,
  fmtCurrency,
} from "@/components/analytics/analytics-shared";
import { withProjection } from "@/lib/analytics-utils";
import { getToday } from "@/lib/demo-date";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmployeeInsightsProps {
  dateRange: { from: Date; to: Date };
  approvalFilter: string;
  granularity: "monthly" | "weekly";
}

interface Member {
  id: string;
  name: string;
}

interface Kpis {
  billableUtil: number;
  totalHours: number;
  flexBalance: number;
  absenceDays: number;
}

interface TimeDistributionEntry {
  status: string;
  hours: number;
  fill: string;
}

interface PhaseBreakdownEntry {
  name: string;
  hours: number;
  color: string;
}

interface UtilizationTrendEntry {
  period: string;
  billableUtil: number;
  totalUtil: number;
  plannedUtil?: number;
}

interface ProfitabilityEntry {
  period: string;
  revenue: number;
  cost: number;
  profit: number;
}

interface FlexTrendEntry {
  period: string;
  flex: number;
}

// ---------------------------------------------------------------------------
// Status display labels
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  billable: "Fakturerbar",
  included: "Inkluderet",
  nonBillable: "Ikke-fakturerbar",
  non_billable: "Ikke-fakturerbar",
  internal: "Intern",
  presales: "Pre-sales",
};

// ---------------------------------------------------------------------------
// Pie label renderer
// ---------------------------------------------------------------------------

const RADIAN = Math.PI / 180;

function renderPieLabel(props: any) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
  if (percent < 0.05) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="#fff"
      textAnchor="middle"
      dominantBaseline="central"
      style={{ fontSize: 12, fontWeight: 600 }}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

// ---------------------------------------------------------------------------
// Util color helper
// ---------------------------------------------------------------------------

function utilColor(pct: number): string {
  if (pct >= 70) return "#10B981";
  if (pct >= 55) return "#F59E0B";
  return "#EF4444";
}

function flexColor(val: number): string {
  const abs = Math.abs(val);
  if (abs > 30) return "#EF4444";
  if (abs > 15) return "#F59E0B";
  return "#10B981";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EmployeeInsights({
  dateRange,
  approvalFilter,
  granularity,
}: EmployeeInsightsProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [membersLoading, setMembersLoading] = useState(true);

  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [timeDistribution, setTimeDistribution] = useState<TimeDistributionEntry[]>([]);
  const [phaseBreakdown, setPhaseBreakdown] = useState<PhaseBreakdownEntry[]>([]);
  const [utilizationTrend, setUtilizationTrend] = useState<UtilizationTrendEntry[]>([]);
  const [profitability, setProfitability] = useState<ProfitabilityEntry[]>([]);
  const [flexTrend, setFlexTrend] = useState<FlexTrendEntry[]>([]);
  const [currency, setCurrency] = useState("DKK");

  const startDate = format(dateRange.from, "yyyy-MM-dd");
  const endDate = format(dateRange.to, "yyyy-MM-dd");

  // ---- Fetch members list ------------------------------------------------
  useEffect(() => {
    setMembersLoading(true);
    const params = new URLSearchParams({
      type: "employee",
      startDate,
      endDate,
      granularity,
      approvalFilter,
    });
    fetch(`/api/analytics?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.members) setMembers(data.members);
        if (data.currency) setCurrency(data.currency);
      })
      .catch(() => setMembers([]))
      .finally(() => setMembersLoading(false));
  }, [startDate, endDate, granularity, approvalFilter]);

  // ---- Fetch employee data -----------------------------------------------
  const fetchEmployeeData = useCallback(() => {
    if (!selectedEmployeeId) {
      setKpis(null);
      setTimeDistribution([]);
      setPhaseBreakdown([]);
      setUtilizationTrend([]);
      setProfitability([]);
      setFlexTrend([]);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({
      type: "employee",
      employeeId: selectedEmployeeId,
      startDate,
      endDate,
      granularity,
      approvalFilter,
    });
    fetch(`/api/analytics?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setKpis(data.kpis ?? null);
        setTimeDistribution(data.timeDistribution ?? []);
        setPhaseBreakdown(data.phaseBreakdown ?? []);
        setUtilizationTrend(data.utilizationTrend ?? []);
        setProfitability(data.profitability ?? []);
        setFlexTrend(data.flexTrend ?? []);
        if (data.currency) setCurrency(data.currency);
      })
      .catch(() => {
        setKpis(null);
        setTimeDistribution([]);
        setPhaseBreakdown([]);
        setUtilizationTrend([]);
        setProfitability([]);
        setFlexTrend([]);
      })
      .finally(() => setLoading(false));
  }, [selectedEmployeeId, startDate, endDate, granularity, approvalFilter]);

  useEffect(() => {
    fetchEmployeeData();
  }, [fetchEmployeeData]);

  // ---- Projected chart data ----------------------------------------------
  const projectedUtilization = useMemo(
    () =>
      withProjection(utilizationTrend, getToday(), granularity, [
        "billableUtil",
        "totalUtil",
      ]),
    [utilizationTrend, granularity]
  );

  const projectedProfitability = useMemo(
    () =>
      withProjection(profitability, getToday(), granularity, [
        "revenue",
        "cost",
        "profit",
      ]),
    [profitability, granularity]
  );

  const projectedFlex = useMemo(
    () => withProjection(flexTrend, getToday(), granularity, ["flex"]),
    [flexTrend, granularity]
  );

  // ---- Derived -----------------------------------------------------------
  const hasTimeData = timeDistribution.some((d) => d.hours > 0);
  const hasPhaseData = phaseBreakdown.length > 0;
  const hasUtilData = utilizationTrend.length > 0;
  const hasProfitData = profitability.length > 0;
  const hasFlexData = flexTrend.length > 0;

  const billableHours = useMemo(() => {
    const b = timeDistribution.find((d) => d.status === "billable");
    return b ? b.hours : 0;
  }, [timeDistribution]);

  const totalDistHours = useMemo(
    () => timeDistribution.reduce((s, d) => s + d.hours, 0),
    [timeDistribution]
  );

  const billablePct = totalDistHours > 0 ? Math.round((billableHours / totalDistHours) * 100) : 0;

  // ---- Member select options ---------------------------------------------
  const memberOptions = useMemo(
    () => [
      { value: "", label: "Vaelg medarbejder..." },
      ...members.map((m) => ({ value: m.id, label: m.name })),
    ],
    [members]
  );

  // ---- Render ------------------------------------------------------------
  return (
    <div>
      {/* Employee selector */}
      <div style={{ marginBottom: 16 }}>
        <MiniSelect
          value={selectedEmployeeId}
          onChange={setSelectedEmployeeId}
          options={memberOptions}
          width={220}
        />
      </div>

      {/* Empty state */}
      {!selectedEmployeeId && !membersLoading && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "64px 0",
            color: "#9CA3AF",
            fontSize: 13,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Vaelg en medarbejder for at se indsigter
        </div>
      )}

      {/* Loading */}
      {selectedEmployeeId && loading && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "64px 0",
            color: "#9CA3AF",
            fontSize: 13,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Indlaeser data...
        </div>
      )}

      {/* Content */}
      {selectedEmployeeId && !loading && kpis && (
        <>
          {/* KPI row */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 0", minWidth: 160 }}>
              <KpiCard
                label="Gns. Udnyttelse"
                value={`${kpis.billableUtil}%`}
                color={utilColor(kpis.billableUtil)}
                sub={`mod ${kpis.billableUtil >= 70 ? "80" : "70"}% gennemsnit`}
                help="Andel af kapacitet brugt pa fakturerbart arbejde i perioden"
              />
            </div>
            <div style={{ flex: "1 1 0", minWidth: 160 }}>
              <KpiCard
                label="Total Timer"
                value={`${kpis.totalHours}t`}
                sub={`${billablePct}% fakturerbar`}
                help="Samlet antal registrerede timer i perioden"
              />
            </div>
            <div style={{ flex: "1 1 0", minWidth: 160 }}>
              <KpiCard
                label="Flex Saldo"
                value={`${kpis.flexBalance > 0 ? "+" : ""}${kpis.flexBalance}t`}
                color={flexColor(kpis.flexBalance)}
                sub="akkumuleret flex"
                warn={Math.abs(kpis.flexBalance) > 30}
                help="Akkumuleret fleksbalance — positiv = overarbejde, negativ = undertid"
              />
            </div>
            <div style={{ flex: "1 1 0", minWidth: 160 }}>
              <KpiCard
                label="Fravaersdage"
                value={`${kpis.absenceDays}`}
                sub="ferie + sygdom"
                help="Antal fravaersdage (ferie, sygdom, personlig) i perioden"
              />
            </div>
          </div>

          {/* Row: Time Distribution + Phase Breakdown */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            {/* Time Distribution - Pie */}
            <ChartCard
              title="Tidsfordeling"
              height={300}
              help="Fordeling af timer efter faktureringsstatus"
            >
              {hasTimeData ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={timeDistribution}
                      dataKey="hours"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      labelLine={false}
                      label={renderPieLabel}
                    >
                      {timeDistribution.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={
                        <ChartTooltip
                          formatter={(v, k) =>
                            `${v.toFixed(1)}t`
                          }
                        />
                      }
                    />
                    <Legend
                      formatter={(value: string) =>
                        STATUS_LABELS[value] || value
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 280,
                    color: "#9CA3AF",
                    fontSize: 12,
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Ingen tidsdata
                </div>
              )}
            </ChartCard>

            {/* Phase Breakdown - Horizontal bar */}
            <ChartCard
              title="Fasefordeling"
              height={300}
              help="Timer fordelt pa projektfaser"
            >
              {hasPhaseData ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={phaseBreakdown} layout="vertical">
                    <CartesianGrid {...GRID_STYLE} />
                    <XAxis
                      type="number"
                      tick={AXIS_STYLE}
                      tickLine={false}
                      axisLine={{ stroke: GRID_STYLE.stroke }}
                      tickFormatter={(v: number) => `${v}t`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={AXIS_STYLE}
                      tickLine={false}
                      axisLine={{ stroke: GRID_STYLE.stroke }}
                      width={120}
                    />
                    <Tooltip
                      content={
                        <ChartTooltip
                          formatter={(v) => `${v.toFixed(1)}t`}
                        />
                      }
                    />
                    <Bar dataKey="hours" name="Timer" radius={[0, 4, 4, 0]}>
                      {phaseBreakdown.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 280,
                    color: "#9CA3AF",
                    fontSize: 12,
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Ingen fasedata
                </div>
              )}
            </ChartCard>
          </div>

          {/* Full-width: Utilization Trend */}
          <div style={{ marginBottom: 12 }}>
            <ChartCard
              title="Udnyttelsestrend"
              height={260}
              help="Fakturerbar og samlet udnyttelse over tid med planlagt maal"
            >
              {hasUtilData ? (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={projectedUtilization}>
                    <CartesianGrid {...GRID_STYLE} />
                    <ReferenceArea
                      y1={70}
                      y2={85}
                      fill="#10B981"
                      fillOpacity={0.08}
                    />
                    <ReferenceLine
                      y={100}
                      stroke="#9CA3AF"
                      strokeDasharray="3 3"
                      label={{
                        value: "100%",
                        fill: "#9CA3AF",
                        fontSize: 10,
                        position: "right",
                      }}
                    />
                    <XAxis
                      dataKey="period"
                      tick={AXIS_STYLE}
                      tickLine={false}
                      axisLine={{ stroke: GRID_STYLE.stroke }}
                    />
                    <YAxis
                      tick={AXIS_STYLE}
                      tickLine={false}
                      axisLine={{ stroke: GRID_STYLE.stroke }}
                      tickFormatter={(v: number) => `${v}%`}
                    />
                    <Tooltip
                      content={
                        <ChartTooltip
                          formatter={(v) => `${v.toFixed(1)}%`}
                        />
                      }
                    />
                    <Legend />
                    {/* Planned (gray dashed) */}
                    <Line
                      type="monotone"
                      dataKey="plannedUtil"
                      name="Planlagt"
                      stroke="#9CA3AF"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      dot={false}
                    />
                    {/* Billable (green solid) */}
                    <Line
                      type="monotone"
                      dataKey="billableUtil"
                      name="Fakturerbar"
                      stroke="#10B981"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#10B981" }}
                      activeDot={{ r: 5 }}
                    />
                    {/* Total (indigo solid) */}
                    <Line
                      type="monotone"
                      dataKey="totalUtil"
                      name="Total"
                      stroke="#6366F1"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#6366F1" }}
                      activeDot={{ r: 5 }}
                    />
                    {/* Projections (dashed with dots) */}
                    <Line
                      type="monotone"
                      dataKey="proj_billableUtil"
                      stroke="#10B981"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      dot={{ r: 3, fill: "#10B981", strokeWidth: 0 }}
                      legendType="none"
                    />
                    <Line
                      type="monotone"
                      dataKey="proj_totalUtil"
                      stroke="#6366F1"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      dot={{ r: 3, fill: "#6366F1", strokeWidth: 0 }}
                      legendType="none"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 260,
                    color: "#9CA3AF",
                    fontSize: 12,
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Ingen udnyttelsesdata
                </div>
              )}
            </ChartCard>
          </div>

          {/* Row: Profitability + Flex Balance Trend */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Profitability */}
            <ChartCard
              title="Rentabilitet"
              height={300}
              help="Omsætning, omkostninger og profit over tid"
            >
              {hasProfitData ? (
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={projectedProfitability}>
                    <CartesianGrid {...GRID_STYLE} />
                    <XAxis
                      dataKey="period"
                      tick={AXIS_STYLE}
                      tickLine={false}
                      axisLine={{ stroke: GRID_STYLE.stroke }}
                    />
                    <YAxis
                      tick={AXIS_STYLE}
                      tickLine={false}
                      axisLine={{ stroke: GRID_STYLE.stroke }}
                      tickFormatter={(v: number) => fmtCurrency(v)}
                    />
                    <Tooltip
                      content={
                        <ChartTooltip
                          formatter={(v) => fmtCurrency(v)}
                        />
                      }
                    />
                    <Legend />
                    <Bar
                      dataKey="revenue"
                      name="Omsætning"
                      fill={METRIC.revenue}
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="cost"
                      name="Omkostning"
                      fill={METRIC.cost}
                      radius={[4, 4, 0, 0]}
                    />
                    <Line
                      type="monotone"
                      dataKey="profit"
                      name="Profit"
                      stroke={METRIC.profit}
                      strokeWidth={2}
                      dot={{ r: 3, fill: METRIC.profit }}
                      activeDot={{ r: 5 }}
                    />
                    {/* Projections (dashed with dots) */}
                    <Line
                      type="monotone"
                      dataKey="proj_revenue"
                      stroke={METRIC.revenue}
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      dot={{ r: 3, fill: METRIC.revenue, strokeWidth: 0 }}
                      legendType="none"
                    />
                    <Line
                      type="monotone"
                      dataKey="proj_cost"
                      stroke={METRIC.cost}
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      dot={{ r: 3, fill: METRIC.cost, strokeWidth: 0 }}
                      legendType="none"
                    />
                    <Line
                      type="monotone"
                      dataKey="proj_profit"
                      stroke={METRIC.profit}
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      dot={{ r: 3, fill: METRIC.profit, strokeWidth: 0 }}
                      legendType="none"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 280,
                    color: "#9CA3AF",
                    fontSize: 12,
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Ingen rentabilitetsdata
                </div>
              )}
            </ChartCard>

            {/* Flex Balance Trend */}
            <ChartCard
              title="Flex Saldo Trend"
              height={300}
              help="Fleksbalance over tid — grøn zone er +/-5 timer"
            >
              {hasFlexData ? (
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={projectedFlex}>
                    <CartesianGrid {...GRID_STYLE} />
                    <ReferenceArea
                      y1={-5}
                      y2={5}
                      fill="#10B981"
                      fillOpacity={0.08}
                    />
                    <ReferenceLine
                      y={0}
                      stroke="#9CA3AF"
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      dataKey="period"
                      tick={AXIS_STYLE}
                      tickLine={false}
                      axisLine={{ stroke: GRID_STYLE.stroke }}
                    />
                    <YAxis
                      tick={AXIS_STYLE}
                      tickLine={false}
                      axisLine={{ stroke: GRID_STYLE.stroke }}
                      tickFormatter={(v: number) => `${v}t`}
                    />
                    <Tooltip
                      content={
                        <ChartTooltip
                          formatter={(v) =>
                            `${v > 0 ? "+" : ""}${v.toFixed(1)}t`
                          }
                        />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="flex"
                      name="Flex"
                      stroke="#6366F1"
                      strokeWidth={2}
                      fill="#6366F1"
                      fillOpacity={0.15}
                      dot={{ r: 3, fill: "#6366F1" }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="proj_flex"
                      stroke="#6366F1"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      dot={{ r: 3, fill: "#6366F1", strokeWidth: 0 }}
                      legendType="none"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 280,
                    color: "#9CA3AF",
                    fontSize: 12,
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Ingen flexdata
                </div>
              )}
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
