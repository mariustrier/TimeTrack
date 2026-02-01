"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  ComposedChart,
  Bar,
  BarChart,
} from "recharts";
import { useTranslations } from "@/lib/i18n";
import { useChartTheme } from "@/lib/chart-theme";
import {
  BILLING_COLORS,
  METRIC_COLORS,
  BILLING_STATUS_ORDER,
} from "@/lib/chart-colors";
import { ChartCard } from "@/components/analytics/chart-card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/calculations";

interface ProjectInsightsProps {
  dateRange: { from: Date; to: Date };
  approvalFilter: string;
  granularity: "monthly" | "weekly";
}

interface Project {
  id: string;
  name: string;
  client: string | null;
  budgetHours: number | null;
  active: boolean;
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

interface BillableMixPoint {
  name: string;
  billable: number;
  included: number;
  non_billable: number;
  internal: number;
  presales: number;
}

const BILLING_LABELS: Record<string, string> = {
  billable: "billable",
  included: "included",
  non_billable: "nonBillable",
  internal: "internal",
  presales: "preSales",
};

export function ProjectInsights({
  dateRange,
  approvalFilter,
  granularity,
}: ProjectInsightsProps) {
  const t = useTranslations("analytics");
  const tc = useTranslations("common");
  const theme = useChartTheme();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [currency, setCurrency] = useState("USD");

  const [billableMix, setBillableMix] = useState<BillableMixPoint[]>([]);
  const [burndown, setBurndown] = useState<BurndownPoint[]>([]);
  const [profitability, setProfitability] = useState<ProfitabilityPoint[]>([]);

  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const startDate = format(dateRange.from, "yyyy-MM-dd");
  const endDate = format(dateRange.to, "yyyy-MM-dd");

  // Fetch project list + billable mix (no projectId)
  const fetchProjectList = useCallback(async () => {
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
      setProjects(data.projects || []);
      setBillableMix(data.billableMix || []);
      setCurrency(data.currency || "USD");
    } finally {
      setLoadingList(false);
    }
  }, [startDate, endDate, approvalFilter]);

  // Fetch detail for selected project
  const fetchProjectDetail = useCallback(async () => {
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
      setBurndown(data.burndown || []);
      setProfitability(data.profitability || []);
      setBillableMix(data.billableMix || []);
      setCurrency(data.currency || "USD");
    } finally {
      setLoadingDetail(false);
    }
  }, [selectedProjectId, startDate, endDate, approvalFilter, granularity]);

  useEffect(() => {
    fetchProjectList();
  }, [fetchProjectList]);

  useEffect(() => {
    if (selectedProjectId) {
      fetchProjectDetail();
    }
  }, [selectedProjectId, fetchProjectDetail]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const hasBudget = selectedProject?.budgetHours != null && selectedProject.budgetHours > 0;

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: theme.tooltipBg,
      border: `1px solid ${theme.tooltipBorder}`,
      borderRadius: 8,
      color: theme.tooltipText,
      fontSize: 13,
    },
    labelStyle: {
      color: theme.tooltipText,
      fontWeight: 600,
      marginBottom: 4,
    },
    itemStyle: {
      color: theme.tooltipText,
      padding: "2px 0",
    },
  };

  return (
    <div className="space-y-6">
      {/* Project selector */}
      <div className="max-w-sm">
        <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
          <SelectTrigger>
            <SelectValue placeholder={t("selectProject")} />
          </SelectTrigger>
          <SelectContent>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
                {project.client ? ` (${project.client})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Billable vs Non-billable by Project (always visible) */}
      <ChartCard
        title={t("billableByProject")}
        loading={loadingList}
        isEmpty={billableMix.length === 0}
        chartHeight={350}
        exportData={billableMix}
        exportFilename="billable-by-project"
      >
        <BarChart data={billableMix}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
          <XAxis
            dataKey="name"
            tick={{ fill: theme.textMuted, fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: theme.grid }}
          />
          <YAxis
            tick={{ fill: theme.textMuted, fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: theme.grid }}
            label={{
              value: tc("hours"),
              angle: -90,
              position: "insideLeft",
              style: { fill: theme.textMuted, fontSize: 12 },
            }}
          />
          <Tooltip
            {...tooltipStyle}
            formatter={(value: any, name: any) => [
              `${value.toFixed(1)}h`,
              tc(BILLING_LABELS[name] || name),
            ]}
          />
          <Legend
            formatter={(value: any) => tc(BILLING_LABELS[String(value)] || String(value))}
          />
          {BILLING_STATUS_ORDER.map((status) => (
            <Bar
              key={status}
              dataKey={status}
              stackId="stack"
              fill={BILLING_COLORS[status]}
              name={status}
            />
          ))}
        </BarChart>
      </ChartCard>

      {/* Burndown + Profitability - only when project selected */}
      {selectedProjectId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Contract Burn-down */}
          <ChartCard
            title={t("contractBurndown")}
            loading={loadingDetail}
            isEmpty={!hasBudget}
            description={!hasBudget && !loadingDetail ? t("budgetRequired") : undefined}
            exportData={burndown}
            exportFilename="contract-burndown"
          >
            <LineChart data={burndown}>
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
                label={{
                  value: tc("hours"),
                  angle: -90,
                  position: "insideLeft",
                  style: { fill: theme.textMuted, fontSize: 12 },
                }}
              />
              <Tooltip
                {...tooltipStyle}
                formatter={(value: any, name: any) => {
                  if (name === "hoursRemaining") return [`${value.toFixed(1)}h`, t("hoursRemaining")];
                  if (name === "idealBurn") return [`${value.toFixed(1)}h`, t("idealBurn")];
                  return [`${value.toFixed(1)}h`, name];
                }}
              />
              <Legend
                formatter={(value: any) => {
                  if (value === "hoursRemaining") return t("hoursRemaining");
                  if (value === "idealBurn") return t("idealBurn");
                  return value;
                }}
              />
              <Area
                type="monotone"
                dataKey="hoursRemaining"
                stroke={METRIC_COLORS.billableUtil}
                fill={METRIC_COLORS.billableUtil}
                fillOpacity={0.1}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="hoursRemaining"
                stroke={METRIC_COLORS.billableUtil}
                strokeWidth={2}
                dot={false}
                name="hoursRemaining"
              />
              <Line
                type="monotone"
                dataKey="idealBurn"
                stroke={METRIC_COLORS.target}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name="idealBurn"
              />
            </LineChart>
          </ChartCard>

          {/* Project Profitability Over Time */}
          <ChartCard
            title={t("projectProfitability")}
            loading={loadingDetail}
            isEmpty={profitability.length === 0}
            exportData={profitability}
            exportFilename="project-profitability"
          >
            <ComposedChart data={profitability}>
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
                formatter={(value: any, name: any) => {
                  const label =
                    name === "revenue"
                      ? t("revenue")
                      : name === "cost"
                        ? t("cost")
                        : t("profit");
                  return [formatCurrency(value, currency), label];
                }}
              />
              <Legend
                formatter={(value: any) => {
                  if (value === "revenue") return t("revenue");
                  if (value === "cost") return t("cost");
                  if (value === "profit") return t("profit");
                  return value;
                }}
              />
              <Bar
                dataKey="revenue"
                fill={METRIC_COLORS.revenue}
                name="revenue"
                radius={[2, 2, 0, 0]}
              />
              <Bar
                dataKey="cost"
                fill={METRIC_COLORS.cost}
                name="cost"
                radius={[2, 2, 0, 0]}
              />
              <Line
                type="monotone"
                dataKey="profit"
                stroke={METRIC_COLORS.profit}
                strokeWidth={2}
                dot={{ r: 3, fill: METRIC_COLORS.profit }}
                name="profit"
              />
            </ComposedChart>
          </ChartCard>
        </div>
      )}
    </div>
  );
}
