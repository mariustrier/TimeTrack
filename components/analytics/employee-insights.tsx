"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ComposedChart,
  Bar,
  Line as Line2,
  ReferenceArea,
} from "recharts";
import { useTranslations } from "@/lib/i18n";
import { useChartTheme } from "@/lib/chart-theme";
import { BILLING_COLORS, METRIC_COLORS } from "@/lib/chart-colors";
import { ChartCard } from "@/components/analytics/chart-card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/calculations";

interface EmployeeInsightsProps {
  dateRange: { from: Date; to: Date };
  approvalFilter: string;
  granularity: "monthly" | "weekly";
}

interface Member {
  id: string;
  name: string;
}

interface TimeDistributionEntry {
  status: string;
  hours: number;
}

interface UtilizationTrendEntry {
  period: string;
  billableUtil: number;
  totalUtil: number;
}

interface ProfitabilityEntry {
  period: string;
  revenue: number;
  cost: number;
  profit: number;
}

const STATUS_LABEL_KEYS: Record<string, string> = {
  billable: "billable",
  included: "included",
  non_billable: "nonBillable",
  internal: "internal",
  presales: "preSales",
};

const RADIAN = Math.PI / 180;

function renderCustomLabel(props: any) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent < 0.05) return null;

  return (
    <text
      x={x}
      y={y}
      fill="#fff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
      fontWeight={600}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export function EmployeeInsights({
  dateRange,
  approvalFilter,
  granularity,
}: EmployeeInsightsProps) {
  const t = useTranslations("analytics");
  const tc = useTranslations("common");
  const theme = useChartTheme();

  const [members, setMembers] = useState<Member[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(false);
  const [membersLoading, setMembersLoading] = useState(true);

  const [timeDistribution, setTimeDistribution] = useState<
    TimeDistributionEntry[]
  >([]);
  const [utilizationTrend, setUtilizationTrend] = useState<
    UtilizationTrendEntry[]
  >([]);
  const [profitability, setProfitability] = useState<ProfitabilityEntry[]>([]);

  const startDate = format(dateRange.from, "yyyy-MM-dd");
  const endDate = format(dateRange.to, "yyyy-MM-dd");

  // Fetch members list
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
      .then((res) => res.json())
      .then((data) => {
        if (data.members) {
          setMembers(data.members);
        }
        if (data.currency) {
          setCurrency(data.currency);
        }
      })
      .catch(() => {
        setMembers([]);
      })
      .finally(() => {
        setMembersLoading(false);
      });
  }, [startDate, endDate, granularity, approvalFilter]);

  // Fetch employee data
  const fetchEmployeeData = useCallback(() => {
    if (!selectedEmployeeId) {
      setTimeDistribution([]);
      setUtilizationTrend([]);
      setProfitability([]);
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
      .then((res) => res.json())
      .then((data) => {
        setTimeDistribution(data.timeDistribution || []);
        setUtilizationTrend(data.utilizationTrend || []);
        setProfitability(data.profitability || []);
        if (data.currency) {
          setCurrency(data.currency);
        }
      })
      .catch(() => {
        setTimeDistribution([]);
        setUtilizationTrend([]);
        setProfitability([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedEmployeeId, startDate, endDate, granularity, approvalFilter]);

  useEffect(() => {
    fetchEmployeeData();
  }, [fetchEmployeeData]);

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: theme.tooltipBg,
      border: `1px solid ${theme.tooltipBorder}`,
      borderRadius: 8,
    },
    itemStyle: { color: theme.tooltipText },
    labelStyle: { color: theme.tooltipText },
  };

  const pieData = timeDistribution.map((entry) => ({
    ...entry,
    label: tc(STATUS_LABEL_KEYS[entry.status] || entry.status),
    color: BILLING_COLORS[entry.status] || "#94A3B8",
  }));

  const hasTimeData = pieData.some((d) => d.hours > 0);
  const hasUtilizationData = utilizationTrend.length > 0;
  const hasProfitabilityData = profitability.length > 0;

  return (
    <div className="space-y-6">
      {/* Employee selector */}
      <div className="flex items-center gap-3">
        <Select
          value={selectedEmployeeId}
          onValueChange={setSelectedEmployeeId}
        >
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder={t("selectEmployee")} />
          </SelectTrigger>
          <SelectContent>
            {members.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {member.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Empty state when no employee is selected */}
      {!selectedEmployeeId && !membersLoading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {t("selectEmployee")}
          </p>
        </div>
      )}

      {/* Charts */}
      {selectedEmployeeId && (
        <div className="space-y-6">
          {/* Time Distribution - Full width */}
          <ChartCard
            title={t("timeDistribution")}
            loading={loading}
            isEmpty={!hasTimeData}
            chartHeight={350}
            exportData={pieData}
            exportFilename="time-distribution"
          >
            <PieChart>
              <Pie
                data={pieData}
                dataKey="hours"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                labelLine={false}
                label={renderCustomLabel}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle.contentStyle}
                itemStyle={tooltipStyle.itemStyle}
                labelStyle={tooltipStyle.labelStyle}
                formatter={(value: any, name: any) => [
                  `${value.toFixed(1)}h`,
                  name,
                ]}
              />
              <Legend />
            </PieChart>
          </ChartCard>

          {/* Utilization Trend + Profitability - Side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Utilization Trend */}
            <ChartCard
              title={t("utilizationTrend")}
              loading={loading}
              isEmpty={!hasUtilizationData}
              chartHeight={300}
              exportData={utilizationTrend}
              exportFilename="utilization-trend"
            >
              <LineChart data={utilizationTrend}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={theme.grid}
                />
                <ReferenceArea y1={70} y2={85} fill="#10B981" fillOpacity={0.08} />
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
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={tooltipStyle.contentStyle}
                  itemStyle={tooltipStyle.itemStyle}
                  labelStyle={tooltipStyle.labelStyle}
                  formatter={(value: any) => [`${Number(value).toFixed(1)}%`]}
                />
                <Legend />
                <ReferenceLine
                  y={100}
                  stroke={METRIC_COLORS.target}
                  strokeDasharray="3 3"
                  label={{
                    value: t("targetLine"),
                    fill: theme.textMuted,
                    fontSize: 11,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="billableUtil"
                  name={t("billableUtilization")}
                  stroke={METRIC_COLORS.billableUtil}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="totalUtil"
                  name={t("totalUtilization")}
                  stroke={METRIC_COLORS.totalUtil}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ChartCard>

            {/* Profitability Over Time */}
            <ChartCard
              title={t("profitabilityOverTime")}
              loading={loading}
              isEmpty={!hasProfitabilityData}
              chartHeight={300}
              exportData={profitability}
              exportFilename="profitability"
            >
              <ComposedChart data={profitability}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={theme.grid}
                />
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
                  tickFormatter={(v) => formatCurrency(v, currency)}
                />
                <Tooltip
                  contentStyle={tooltipStyle.contentStyle}
                  itemStyle={tooltipStyle.itemStyle}
                  labelStyle={tooltipStyle.labelStyle}
                  formatter={(value: any, name: any) => [
                    formatCurrency(value, currency),
                    name,
                  ]}
                />
                <Legend />
                <Bar
                  dataKey="revenue"
                  name={t("revenue")}
                  fill={METRIC_COLORS.revenue}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="cost"
                  name={t("cost")}
                  fill={METRIC_COLORS.cost}
                  radius={[4, 4, 0, 0]}
                />
                <Line2
                  type="monotone"
                  dataKey="profit"
                  name={t("profit")}
                  stroke={METRIC_COLORS.profit}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </ComposedChart>
            </ChartCard>
          </div>
        </div>
      )}
    </div>
  );
}
