"use client";

import { useEffect, useMemo, useState } from "react";
import { format, parse, addMonths } from "date-fns";
import {
  ComposedChart,
  Area,
  Bar,
  Line,
  LineChart,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceArea,
} from "recharts";
import { useTranslations } from "@/lib/i18n";
import { useChartTheme } from "@/lib/chart-theme";
import { METRIC_COLORS, BILLING_COLORS } from "@/lib/chart-colors";
import { ChartCard } from "@/components/analytics/chart-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/calculations";

interface CompanyInsightsProps {
  dateRange: { from: Date; to: Date };
  approvalFilter: string;
  granularity: "monthly" | "weekly";
}

interface RevenueOverheadEntry {
  period: string;
  revenue: number;
  overhead: number;
  contributionMargin: number;
}

interface NonBillableTrendEntry {
  period: string;
  totalPercent: number;
  internal: number;
  presales: number;
  nonBillable: number;
}

interface UnbilledWorkEntry {
  projectName: string;
  hours: number;
  estimatedRevenue: number;
  oldestEntryDate: string;
  ageInDays: number;
  entryCount: number;
}

export function CompanyInsights({
  dateRange,
  approvalFilter,
  granularity,
}: CompanyInsightsProps) {
  const t = useTranslations("analytics");
  const tc = useTranslations("common");
  const theme = useChartTheme();

  const [loading, setLoading] = useState(true);
  const [revenueOverhead, setRevenueOverhead] = useState<
    RevenueOverheadEntry[]
  >([]);
  const [nonBillableTrend, setNonBillableTrend] = useState<
    NonBillableTrendEntry[]
  >([]);
  const [unbilledWork, setUnbilledWork] = useState<UnbilledWorkEntry[]>([]);
  const [currency, setCurrency] = useState("USD");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          type: "company",
          startDate: format(dateRange.from, "yyyy-MM-dd"),
          endDate: format(dateRange.to, "yyyy-MM-dd"),
          granularity,
          approvalFilter,
        });

        const res = await fetch(`/api/analytics?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch company analytics");

        const data = await res.json();
        setRevenueOverhead(data.revenueOverhead ?? []);
        setNonBillableTrend(data.nonBillableTrend ?? []);
        setUnbilledWork(data.unbilledWork ?? []);
        setCurrency(data.currency ?? "USD");
      } catch (err) {
        console.error("[CompanyInsights]", err);
        setRevenueOverhead([]);
        setNonBillableTrend([]);
        setUnbilledWork([]);
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

  const forecastResult = useMemo(() => {
    if (granularity !== "monthly" || revenueOverhead.length < 3) {
      return { data: revenueOverhead as any[], hasForecast: false };
    }

    const last3 = revenueOverhead.slice(-3);
    const avgRevenue = Math.round(
      last3.reduce((s, d) => s + d.revenue, 0) / 3
    );
    const avgMargin = Math.round(
      last3.reduce((s, d) => s + d.contributionMargin, 0) / 3
    );

    const lastPeriod = revenueOverhead[revenueOverhead.length - 1].period;
    const lastDate = parse(lastPeriod, "MMM yyyy", new Date());

    const combined: any[] = revenueOverhead.map((d) => ({ ...d }));
    combined[combined.length - 1].forecastRevenue =
      combined[combined.length - 1].revenue;
    combined[combined.length - 1].forecastMargin =
      combined[combined.length - 1].contributionMargin;

    for (let i = 1; i <= 3; i++) {
      const d = addMonths(lastDate, i);
      combined.push({
        period: format(d, "MMM yyyy"),
        forecastRevenue: avgRevenue,
        forecastMargin: avgMargin,
      });
    }

    return { data: combined, hasForecast: true };
  }, [revenueOverhead, granularity]);

  return (
    <div className="space-y-6">
      {/* Revenue vs Overhead */}
      <ChartCard
        title={t("revenueVsOverhead")}
        description={
          forecastResult.hasForecast
            ? `${t("revenueVsOverheadDesc")} · ${t("forecastBased")}`
            : t("revenueVsOverheadDesc")
        }
        loading={loading}
        isEmpty={revenueOverhead.length === 0}
        chartHeight={350}
        exportData={revenueOverhead}
        exportFilename="revenue-vs-overhead"
      >
        <ComposedChart data={forecastResult.data}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
          <XAxis
            dataKey="period"
            tick={{ fill: theme.textMuted, fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: theme.grid }}
          />
          <YAxis
            tick={{ fill: theme.textMuted, fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: theme.grid }}
            tickFormatter={(v: number) => formatCurrency(v, currency)}
          />
          <Tooltip
            {...tooltipStyle}
            formatter={(value: any, name: any) => [
              formatCurrency(value, currency),
              name,
            ]}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="revenue"
            name={t("revenue")}
            fill="#10B981"
            fillOpacity={0.15}
            stroke="#10B981"
          />
          <Bar
            dataKey="overhead"
            name={t("overhead")}
            fill="#F97316"
            radius={[4, 4, 0, 0]}
          />
          <Line
            type="monotone"
            dataKey="contributionMargin"
            name={t("contributionMargin")}
            stroke="#6366F1"
            strokeWidth={2}
            dot={{ fill: "#6366F1", r: 4 }}
          />
          {forecastResult.hasForecast && (
            <>
              <Line
                type="monotone"
                dataKey="forecastRevenue"
                stroke="#10B981"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                legendType="none"
              />
              <Line
                type="monotone"
                dataKey="forecastMargin"
                stroke="#6366F1"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                legendType="none"
              />
            </>
          )}
        </ComposedChart>
      </ChartCard>

      {/* Non-Billable Trend */}
      <ChartCard
        title={t("nonBillableTrend")}
        description={t("nonBillableTrendDesc")}
        loading={loading}
        isEmpty={nonBillableTrend.length === 0}
        chartHeight={350}
        exportData={nonBillableTrend}
        exportFilename="non-billable-trend"
      >
        <LineChart data={nonBillableTrend}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
          <ReferenceArea y1={0} y2={15} fill="#10B981" fillOpacity={0.06} />
          <ReferenceArea y1={15} y2={25} fill="#F59E0B" fillOpacity={0.06} />
          <XAxis
            dataKey="period"
            tick={{ fill: theme.textMuted, fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: theme.grid }}
          />
          <YAxis
            tick={{ fill: theme.textMuted, fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: theme.grid }}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            {...tooltipStyle}
            formatter={(value: any, name: any) => [
              `${value.toFixed(1)}%`,
              name,
            ]}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="totalPercent"
            name={t("totalNonBillable")}
            stroke="#9CA3AF"
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={{ fill: "#9CA3AF", r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="internal"
            name={tc("internal")}
            stroke={BILLING_COLORS.internal}
            strokeWidth={2}
            dot={{ fill: BILLING_COLORS.internal, r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="presales"
            name={tc("preSales")}
            stroke={BILLING_COLORS.presales}
            strokeWidth={2}
            dot={{ fill: BILLING_COLORS.presales, r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="nonBillable"
            name={tc("nonBillable")}
            stroke={BILLING_COLORS.non_billable}
            strokeWidth={2}
            dot={{ fill: BILLING_COLORS.non_billable, r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ChartCard>

      {/* Unbilled Work Aging */}
      <ChartCard
        title={t("unbilledWorkAging")}
        description={t("unbilledWorkAgingDesc")}
        loading={loading}
        isEmpty={unbilledWork.length === 0}
        chartHeight={Math.max(300, unbilledWork.length * 40 + 60)}
        exportData={unbilledWork}
        exportFilename="unbilled-work"
      >
        <BarChart data={unbilledWork} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
          <XAxis
            type="number"
            tick={{ fill: theme.textMuted, fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: theme.grid }}
            tickFormatter={(v: number) => formatCurrency(v, currency)}
          />
          <YAxis
            type="category"
            dataKey="projectName"
            tick={{ fill: theme.textMuted, fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: theme.grid }}
            width={140}
          />
          <Tooltip
            {...tooltipStyle}
            formatter={(value: any, name: any) => [
              formatCurrency(value, currency),
              name,
            ]}
          />
          <Bar
            dataKey="estimatedRevenue"
            name={t("estimatedRevenue")}
            fill={METRIC_COLORS.revenue}
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ChartCard>

      {/* Unbilled Work Detail Table */}
      {!loading && unbilledWork.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              {t("unbilledWorkDetails")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-4 py-2 font-medium">{t("project")}</th>
                    <th className="px-4 py-2 font-medium">{t("hours")}</th>
                    <th className="px-4 py-2 font-medium">
                      {t("estimatedRevenue")}
                    </th>
                    <th className="px-4 py-2 font-medium">
                      {t("oldestEntry")}
                    </th>
                    <th className="px-4 py-2 font-medium">{t("ageDays")}</th>
                  </tr>
                </thead>
                <tbody>
                  {unbilledWork.map((row, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="px-4 py-2">{row.projectName}</td>
                      <td className="px-4 py-2">{row.hours.toFixed(1)}</td>
                      <td className="px-4 py-2">
                        {formatCurrency(row.estimatedRevenue, currency)}
                      </td>
                      <td className="px-4 py-2">{row.oldestEntryDate}</td>
                      <td className="px-4 py-2">{row.ageInDays}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
