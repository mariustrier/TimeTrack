"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ComposedChart,
  Line,
  ReferenceArea,
} from "recharts";
import { useTranslations } from "@/lib/i18n";
import { useChartTheme } from "@/lib/chart-theme";
import { BILLING_COLORS, METRIC_COLORS } from "@/lib/chart-colors";
import { ChartCard } from "@/components/analytics/chart-card";
import { formatCurrency, formatPercentage } from "@/lib/calculations";

interface TeamInsightsProps {
  dateRange: { from: Date; to: Date };
  approvalFilter: string;
  granularity: "monthly" | "weekly";
}

interface UtilizationEntry {
  name: string;
  billableUtil: number;
  totalUtil: number;
}

interface ProfitabilityEntry {
  name: string;
  revenue: number;
  cost: number;
  margin: number;
}

interface TimeMixEntry {
  name: string;
  billable: number;
  included: number;
  non_billable: number;
  internal: number;
  presales: number;
}

export function TeamInsights({
  dateRange,
  approvalFilter,
  granularity,
}: TeamInsightsProps) {
  const t = useTranslations("analytics");
  const tc = useTranslations("common");
  const theme = useChartTheme();

  const [loading, setLoading] = useState(true);
  const [utilization, setUtilization] = useState<UtilizationEntry[]>([]);
  const [profitability, setProfitability] = useState<ProfitabilityEntry[]>([]);
  const [timeMix, setTimeMix] = useState<TimeMixEntry[]>([]);
  const [currency, setCurrency] = useState("USD");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          type: "team",
          startDate: format(dateRange.from, "yyyy-MM-dd"),
          endDate: format(dateRange.to, "yyyy-MM-dd"),
          granularity,
          approvalFilter,
        });

        const res = await fetch(`/api/analytics?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch team analytics");

        const data = await res.json();
        setUtilization(data.utilization ?? []);
        setProfitability(data.profitability ?? []);
        setTimeMix(data.timeMix ?? []);
        setCurrency(data.currency ?? "USD");
      } catch (err) {
        console.error("[TeamInsights]", err);
        setUtilization([]);
        setProfitability([]);
        setTimeMix([]);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [dateRange.from, dateRange.to, granularity, approvalFilter]);

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: theme.tooltipBg,
      border: `1px solid ${theme.tooltipBorder}`,
      borderRadius: 8,
    },
    itemStyle: { color: theme.tooltipText },
    labelStyle: { color: theme.tooltipText },
  };

  return (
    <div className="space-y-6">
      {/* Utilization Comparison - Grouped Bar */}
      <ChartCard
        title={t("utilizationComparison")}
        loading={loading}
        isEmpty={utilization.length === 0}
        chartHeight={350}
        exportData={utilization}
        exportFilename="utilization-comparison"
      >
        <BarChart data={utilization}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
          <ReferenceArea y1={70} y2={85} fill="#10B981" fillOpacity={0.08} />
          <XAxis
            dataKey="name"
            tick={{ fill: theme.textMuted, fontSize: 12 }}
            angle={-20}
            textAnchor="end"
            height={60}
          />
          <YAxis
            tick={{ fill: theme.textMuted, fontSize: 12 }}
            tickFormatter={(v: number) => formatPercentage(v)}
          />
          <Tooltip
            {...tooltipStyle}
            formatter={(value: any, name: any) => [
              formatPercentage(value),
              name,
            ]}
          />
          <Legend />
          <ReferenceLine
            y={100}
            stroke={theme.textMuted}
            strokeDasharray="3 3"
            label={{
              value: "100%",
              fill: theme.textMuted,
              fontSize: 12,
            }}
          />
          <Bar
            dataKey="billableUtil"
            name={t("billableUtilization")}
            fill={METRIC_COLORS.billableUtil}
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="totalUtil"
            name={t("totalUtilization")}
            fill={METRIC_COLORS.totalUtil}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ChartCard>

      {/* Profitability Comparison - ComposedChart */}
      <ChartCard
        title={t("profitabilityComparison")}
        loading={loading}
        isEmpty={profitability.length === 0}
        chartHeight={350}
        exportData={profitability}
        exportFilename="profitability-comparison"
      >
        <ComposedChart data={profitability}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
          <XAxis
            dataKey="name"
            tick={{ fill: theme.textMuted, fontSize: 12 }}
            angle={-20}
            textAnchor="end"
            height={60}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: theme.textMuted, fontSize: 12 }}
            tickFormatter={(v: number) => formatCurrency(v, currency)}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: theme.textMuted, fontSize: 12 }}
            tickFormatter={(v: number) => formatPercentage(v)}
          />
          <Tooltip
            {...tooltipStyle}
            formatter={(value: any, name: any) => {
              if (name === t("margin")) {
                return [formatPercentage(value), name];
              }
              return [formatCurrency(value, currency), name];
            }}
          />
          <Legend />
          <Bar
            yAxisId="left"
            dataKey="revenue"
            name={t("revenue")}
            fill={METRIC_COLORS.revenue}
            radius={[4, 4, 0, 0]}
          />
          <Bar
            yAxisId="left"
            dataKey="cost"
            name={t("cost")}
            fill={METRIC_COLORS.cost}
            radius={[4, 4, 0, 0]}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="margin"
            name={t("margin")}
            stroke={METRIC_COLORS.margin}
            strokeWidth={2}
            dot={{ fill: METRIC_COLORS.margin, r: 4 }}
          />
        </ComposedChart>
      </ChartCard>

      {/* Time Mix Comparison - Stacked Bar */}
      <ChartCard
        title={t("timeMixComparison")}
        loading={loading}
        isEmpty={timeMix.length === 0}
        chartHeight={350}
        exportData={timeMix}
        exportFilename="time-mix"
      >
        <BarChart data={timeMix}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
          <XAxis
            dataKey="name"
            tick={{ fill: theme.textMuted, fontSize: 12 }}
            angle={-20}
            textAnchor="end"
            height={60}
          />
          <YAxis
            tick={{ fill: theme.textMuted, fontSize: 12 }}
            tickFormatter={(v: number) => `${v}h`}
          />
          <Tooltip
            {...tooltipStyle}
            formatter={(value: any, name: any) => [`${value}h`, name]}
          />
          <Legend />
          <Bar
            dataKey="billable"
            name={tc("billable")}
            stackId="stack"
            fill={BILLING_COLORS.billable}
          />
          <Bar
            dataKey="included"
            name={tc("included")}
            stackId="stack"
            fill={BILLING_COLORS.included}
          />
          <Bar
            dataKey="non_billable"
            name={tc("nonBillable")}
            stackId="stack"
            fill={BILLING_COLORS.non_billable}
          />
          <Bar
            dataKey="internal"
            name={tc("internal")}
            stackId="stack"
            fill={BILLING_COLORS.internal}
          />
          <Bar
            dataKey="presales"
            name={tc("preSales")}
            stackId="stack"
            fill={BILLING_COLORS.presales}
          />
        </BarChart>
      </ChartCard>
    </div>
  );
}
