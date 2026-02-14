"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  BarChart,
  Bar,
  Cell,
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
import { getToday } from "@/lib/demo-date";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TeamInsightsProps {
  dateRange: { from: Date; to: Date };
  approvalFilter: string;
  granularity: "monthly" | "weekly";
}

interface CapacityDetailEntry {
  name: string;
  fullName: string;
  billable: number;
  internal: number;
  vacation: number;
  available: number;
  capacity: number;
  utilPct: number;
  allocNext4w: number;
  allocPct: number;
  accruedVacationHrs: number;
  costRate: number;
}

interface EffectiveRateEntry {
  name: string;
  effectiveRate: number;
  billRate: number;
  color: string;
}

interface UtilizationEntry {
  name: string;
  billableUtil: number;
  totalUtil: number;
}

interface TimeMixEntry {
  name: string;
  billable: number;
  included: number;
  nonBillable: number;
  internal: number;
  presales: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function firstName(fullName: string): string {
  return fullName.split(" ")[0] || fullName;
}

function initials(fullName: string): string {
  const parts = fullName.split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TeamInsights({
  dateRange,
  approvalFilter,
  granularity,
}: TeamInsightsProps) {
  const [loading, setLoading] = useState(true);
  const [capacityDetail, setCapacityDetail] = useState<CapacityDetailEntry[]>([]);
  const [effectiveRate, setEffectiveRate] = useState<EffectiveRateEntry[]>([]);
  const [utilization, setUtilization] = useState<UtilizationEntry[]>([]);
  const [timeMix, setTimeMix] = useState<TimeMixEntry[]>([]);
  const [currency, setCurrency] = useState("DKK");

  const startDate = format(dateRange.from, "yyyy-MM-dd");
  const endDate = format(dateRange.to, "yyyy-MM-dd");

  // ---- Fetch data --------------------------------------------------------
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          type: "team",
          startDate,
          endDate,
          granularity,
          approvalFilter,
        });
        const res = await fetch(`/api/analytics?${params}`);
        if (!res.ok) throw new Error("Failed to fetch team analytics");
        const data = await res.json();
        setCapacityDetail(data.capacityDetail ?? []);
        setEffectiveRate(data.effectiveRate ?? []);
        setUtilization(data.utilization ?? []);
        setTimeMix(data.timeMix ?? []);
        setCurrency(data.currency ?? "DKK");
      } catch (err) {
        console.error("[TeamInsights]", err);
        setCapacityDetail([]);
        setEffectiveRate([]);
        setUtilization([]);
        setTimeMix([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [startDate, endDate, granularity, approvalFilter]);

  // ---- Derived -----------------------------------------------------------
  const burnoutCount = useMemo(
    () => capacityDetail.filter((d) => d.utilPct > 115).length,
    [capacityDetail]
  );

  const benchEmployees = useMemo(
    () => capacityDetail.filter((d) => d.allocPct < 50),
    [capacityDetail]
  );

  const sortedUtilization = useMemo(
    () => [...utilization].sort((a, b) => b.billableUtil - a.billableUtil),
    [utilization]
  );

  const timeMixWithFirstNames = useMemo(
    () =>
      timeMix.map((d) => ({
        ...d,
        shortName: firstName(d.name),
      })),
    [timeMix]
  );

  const effectiveRateSorted = useMemo(
    () => [...effectiveRate].sort((a, b) => b.effectiveRate - a.effectiveRate),
    [effectiveRate]
  );

  // ---- Loading state -----------------------------------------------------
  if (loading) {
    return (
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
        Indlaeser teamdata...
      </div>
    );
  }

  // ---- Render ------------------------------------------------------------
  return (
    <div>
      {/* Full-width: Capacity & Health */}
      <div style={{ marginBottom: 12 }}>
        <ChartCard
          title="Kapacitet & Sundhed"
          height={320}
          help="Stablede timer pr. medarbejder — fakturerbar, intern, ferie og tilgaengelig kapacitet"
          badge={
            burnoutCount > 0
              ? {
                  label: `${burnoutCount} burnout-risiko`,
                  bg: "#FEE2E2",
                  fg: "#DC2626",
                }
              : undefined
          }
        >
          {capacityDetail.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={capacityDetail} margin={{ top: 5, right: 110, bottom: 5, left: 5 }}>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis
                  dataKey="name"
                  tick={{ ...AXIS_STYLE, textAnchor: "end" }}
                  angle={-20}
                  height={50}
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
                      formatter={(v, k) => {
                        if (k === "utilPct") return `${v.toFixed(0)}%`;
                        return `${v.toFixed(1)}t`;
                      }}
                    />
                  }
                />
                <Legend />
                {/* 100% capacity line */}
                <ReferenceLine
                  y={160}
                  stroke="#9CA3AF"
                  strokeDasharray="3 3"
                  label={{
                    value: "100% kapacitet",
                    fill: "#9CA3AF",
                    fontSize: 10,
                    position: "right",
                  }}
                />
                {/* 115% burnout risk line */}
                <ReferenceLine
                  y={184}
                  stroke="#EF4444"
                  strokeDasharray="6 3"
                  label={{
                    value: "115% burnout",
                    fill: "#EF4444",
                    fontSize: 10,
                    position: "right",
                  }}
                />
                <Bar
                  dataKey="billable"
                  name="Fakturerbar"
                  stackId="capacity"
                  fill="#10B981"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="internal"
                  name="Intern"
                  stackId="capacity"
                  fill="#8B5CF6"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="vacation"
                  name="Ferie"
                  stackId="capacity"
                  fill="#9CA3AF"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="available"
                  name="Tilgaengelig"
                  stackId="capacity"
                  fill="#94A3B8"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 300,
                color: "#9CA3AF",
                fontSize: 12,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Ingen kapacitetsdata
            </div>
          )}
        </ChartCard>
      </div>

      {/* Row: The Bench + Effective Hourly Rate */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        {/* The Bench */}
        <ChartCard
          title="Baenken"
          height={320}
          help="Medarbejdere med under 50% allokering de naeste 4 uger"
        >
          {benchEmployees.length > 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: "4px 0",
                maxHeight: 300,
                overflowY: "auto",
              }}
            >
              {benchEmployees.map((emp) => (
                <div
                  key={emp.fullName}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    background: "hsl(var(--muted))",
                    borderRadius: 6,
                    border: "1px solid hsl(var(--border))",
                  }}
                >
                  {/* Initials avatar */}
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "#6366F1",
                      color: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontFamily: "'DM Sans', sans-serif",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {initials(emp.fullName)}
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontFamily: "'DM Sans', sans-serif",
                        fontWeight: 600,
                        color: "hsl(var(--foreground))",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {emp.fullName}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        fontFamily: "'DM Sans', sans-serif",
                        color: "#9CA3AF",
                      }}
                    >
                      {emp.allocNext4w}t allokeret naeste 4 uger ({emp.allocPct}%)
                    </div>
                  </div>
                  {/* Mini progress bar */}
                  <div
                    style={{
                      width: 60,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 2,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 600,
                        color: emp.allocPct < 25 ? "#EF4444" : "#F59E0B",
                      }}
                    >
                      {emp.allocPct}%
                    </span>
                    <div
                      style={{
                        width: "100%",
                        height: 4,
                        background: "hsl(var(--muted))",
                        borderRadius: 2,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(emp.allocPct, 100)}%`,
                          height: "100%",
                          background: emp.allocPct < 25 ? "#EF4444" : "#F59E0B",
                          borderRadius: 2,
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 300,
                color: "#9CA3AF",
                fontSize: 12,
                fontFamily: "'DM Sans', sans-serif",
                textAlign: "center",
                padding: "0 20px",
              }}
            >
              Ingen medarbejdere under 50% — teamet er fuldt allokeret
            </div>
          )}
        </ChartCard>

        {/* Effective Hourly Rate */}
        <ChartCard
          title="Effektiv Timesats"
          height={320}
          help="Effektiv timesats pr. projekt sammenlignet med fakturasats"
        >
          {effectiveRateSorted.length > 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: "4px 0",
                maxHeight: 300,
                overflowY: "auto",
              }}
            >
              {effectiveRateSorted.map((proj, idx) => (
                <div
                  key={proj.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "6px 10px",
                    background: idx % 2 === 0 ? "hsl(var(--card))" : "hsl(var(--muted))",
                    borderRadius: 4,
                  }}
                >
                  {/* Rank */}
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 600,
                      color: "#9CA3AF",
                      minWidth: 18,
                      textAlign: "right",
                    }}
                  >
                    #{idx + 1}
                  </span>
                  {/* Color dot */}
                  <span
                    style={{
                      display: "inline-block",
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: proj.color,
                      flexShrink: 0,
                    }}
                  />
                  {/* Project name */}
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12,
                      fontFamily: "'DM Sans', sans-serif",
                      fontWeight: 500,
                      color: "hsl(var(--foreground))",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {proj.name}
                  </span>
                  {/* Bill rate */}
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: "'DM Sans', sans-serif",
                      color: "#9CA3AF",
                      whiteSpace: "nowrap",
                    }}
                  >
                    sats: {fmtCurrency(proj.billRate)}
                  </span>
                  {/* Effective rate */}
                  <span
                    style={{
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 700,
                      color:
                        proj.effectiveRate >= proj.billRate
                          ? "#10B981"
                          : "#EF4444",
                      minWidth: 70,
                      textAlign: "right",
                    }}
                  >
                    {fmtCurrency(proj.effectiveRate)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 300,
                color: "#9CA3AF",
                fontSize: 12,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Ingen satsdata
            </div>
          )}
        </ChartCard>
      </div>

      {/* Row: Utilization Comparison + Time Mix */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        {/* Utilization Comparison */}
        <ChartCard
          title="Udnyttelsessammenligning"
          height={320}
          help="Fakturerbar vs. total udnyttelse pr. medarbejder, sorteret hoejest foerst"
        >
          {sortedUtilization.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={sortedUtilization}>
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
                  dataKey="name"
                  tick={{ ...AXIS_STYLE, textAnchor: "end" }}
                  angle={-20}
                  height={50}
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
                <Bar
                  dataKey="billableUtil"
                  name="Fakturerbar"
                  fill="#10B981"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="totalUtil"
                  name="Total"
                  fill="#6366F1"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 300,
                color: "#9CA3AF",
                fontSize: 12,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Ingen udnyttelsesdata
            </div>
          )}
        </ChartCard>

        {/* Time Mix */}
        <ChartCard
          title="Tidsmix"
          height={320}
          help="Fordeling af timer efter faktureringsstatus pr. medarbejder"
        >
          {timeMixWithFirstNames.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={timeMixWithFirstNames}>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis
                  dataKey="shortName"
                  tick={{ ...AXIS_STYLE, textAnchor: "end" }}
                  angle={-20}
                  height={50}
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
                      formatter={(v) => `${v.toFixed(1)}t`}
                    />
                  }
                />
                <Legend />
                <Bar
                  dataKey="billable"
                  name="Fakturerbar"
                  stackId="mix"
                  fill={BILLING_COLORS.billable}
                />
                <Bar
                  dataKey="included"
                  name="Inkluderet"
                  stackId="mix"
                  fill={BILLING_COLORS.included}
                />
                <Bar
                  dataKey="nonBillable"
                  name="Non-billable"
                  stackId="mix"
                  fill={BILLING_COLORS.nonBillable}
                />
                <Bar
                  dataKey="internal"
                  name="Intern"
                  stackId="mix"
                  fill={BILLING_COLORS.internal}
                />
                <Bar
                  dataKey="presales"
                  name="Pre-sales"
                  stackId="mix"
                  fill={BILLING_COLORS.presales}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 300,
                color: "#9CA3AF",
                fontSize: 12,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Ingen tidsmixdata
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
