"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  KpiCard,
  ChartCard,
  ChartTooltip,
  BudgetBar,
  AXIS_STYLE,
  GRID_STYLE,
  FontLoader,
  AnalyticsKeyframes,
  fmt,
} from "@/components/analytics/analytics-shared";
import { useTranslations } from "@/lib/i18n";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TilbudOverviewProps {
  projectId: string;
}

interface CategoryStat {
  id: string;
  name: string;
  parentId: string | null;
  parentName: string | null;
  faseNumber: number | null;
  quotedHours: number;
  usedHours: number;
  isTimeloen: boolean;
  timeloenAmount: number;
  children: CategoryStat[];
}

interface EmployeeBreakdown {
  id: string;
  name: string;
  hours: number;
  color: string;
}

interface WeeklyBurn {
  week: string;
  hours: number;
}

interface TilbudStats {
  totalBudgetHours: number;
  totalUsedHours: number;
  totalTimeloenAmount: number;
  hourlyRate: number;
  currency: string;
  categories: CategoryStat[];
  employees: EmployeeBreakdown[];
  weeklyBurn: WeeklyBurn[];
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

const EMPLOYEE_COLORS = [
  "#6366F1",
  "#10B981",
  "#F59E0B",
  "#3B82F6",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
];

function rowColor(pct: number): string {
  if (pct > 100) return "#FEF2F2"; // red tint
  if (pct >= 70) return "#FFFBEB"; // amber tint
  return "transparent"; // green zone, no tint needed
}

function progressColor(pct: number): string {
  if (pct > 100) return "#EF4444";
  if (pct >= 70) return "#F59E0B";
  return "#10B981";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TilbudOverview({ projectId }: TilbudOverviewProps) {
  const t = useTranslations("tilbud");

  const [stats, setStats] = useState<TilbudStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedFases, setExpandedFases] = useState<Set<string>>(new Set());

  // ---- Fetch ----
  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/tilbud/stats`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || t("fetchFailed"));
        return;
      }
      const data: TilbudStats = await res.json();
      setStats(data);
    } catch {
      setError(t("fetchFailed"));
    } finally {
      setLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // ---- Computed ----
  const warningCategories = useMemo(() => {
    if (!stats) return [];
    return stats.categories.filter((c) => {
      if (c.isTimeloen || c.quotedHours <= 0) return false;
      return (c.usedHours / c.quotedHours) * 100 > 85;
    });
  }, [stats]);

  const toggleFase = useCallback((faseId: string) => {
    setExpandedFases((prev) => {
      const next = new Set(Array.from(prev));
      if (next.has(faseId)) next.delete(faseId);
      else next.add(faseId);
      return next;
    });
  }, []);

  // ---- Max employee hours for bar scaling ----
  const maxEmployeeHours = useMemo(() => {
    if (!stats) return 0;
    return Math.max(...stats.employees.map((e) => e.hours), 1);
  }, [stats]);

  // ---- Loading state ----
  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <FontLoader />
        <div
          style={{
            width: 24,
            height: 24,
            border: "2px solid hsl(var(--border))",
            borderTop: "2px solid hsl(var(--foreground))",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ---- Error state ----
  if (error) {
    return (
      <div
        style={{
          background: "#FEF2F2",
          border: "1px solid #FECACA",
          borderRadius: 8,
          padding: "16px 20px",
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13,
          color: "#991B1B",
        }}
      >
        {error}
      </div>
    );
  }

  if (!stats) return null;

  const usedPct =
    stats.totalBudgetHours > 0
      ? (stats.totalUsedHours / stats.totalBudgetHours) * 100
      : 0;

  return (
    <div
      style={{
        fontFamily: "'DM Sans', sans-serif",
        color: "#1F2937",
      }}
    >
      <FontLoader />
      <AnalyticsKeyframes />

      {/* Warning banner */}
      {warningCategories.length > 0 && (
        <div
          style={{
            background: "#FFFBEB",
            border: "1px solid #FDE68A",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 16,
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{"\u26A0\uFE0F"}</span>
          <div>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#92400E",
              }}
            >
              {t("budgetWarning")}
            </span>
            <div style={{ fontSize: 12, color: "#92400E", marginTop: 2 }}>
              {warningCategories.map((c) => (
                <span key={c.id} style={{ display: "block" }}>
                  {c.name}: {((c.usedHours / c.quotedHours) * 100).toFixed(0)}%
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <KpiCard
          label={t("totalBudget")}
          value={`${stats.totalBudgetHours.toFixed(1)}t`}
          sub={`${(stats.totalBudgetHours * stats.hourlyRate).toLocaleString("da-DK")} ${stats.currency}`}
          color="#6366F1"
        />
        <KpiCard
          label={t("consumed")}
          value={`${stats.totalUsedHours.toFixed(1)}t`}
          sub={`${usedPct.toFixed(0)}% ${t("ofBudget")}`}
          color={usedPct > 85 ? "#EF4444" : usedPct > 70 ? "#F59E0B" : "#10B981"}
          warn={usedPct > 85}
        />
        <KpiCard
          label={t("timeloenTotal")}
          value={`${stats.totalTimeloenAmount.toLocaleString("da-DK")} ${stats.currency}`}
          sub={t("timeloenSub")}
          color="#8B5CF6"
        />
      </div>

      {/* Category table */}
      <div
        style={{
          background: "hsl(var(--card))",
          border: "1px solid hsl(var(--border))",
          borderRadius: 8,
          overflow: "hidden",
          marginBottom: 20,
        }}
      >
        {/* Table header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 80px 80px 140px",
            padding: "10px 14px",
            borderBottom: "1px solid hsl(var(--border))",
            fontSize: 10,
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          <span>{t("category")}</span>
          <span style={{ textAlign: "right" }}>{t("quoted")}</span>
          <span style={{ textAlign: "right" }}>{t("used")}</span>
          <span>{t("progress")}</span>
        </div>

        {/* Category rows */}
        {stats.categories.map((cat) => {
          const pct =
            cat.quotedHours > 0
              ? (cat.usedHours / cat.quotedHours) * 100
              : 0;
          const hasChildren = cat.children && cat.children.length > 0;
          const isExpanded = expandedFases.has(cat.id);

          return (
            <div key={cat.id}>
              {/* Parent row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 80px 80px 140px",
                  padding: "8px 14px",
                  borderBottom: "1px solid hsl(var(--border))",
                  background: rowColor(pct),
                  cursor: hasChildren ? "pointer" : "default",
                  transition: "background 0.15s ease",
                }}
                onClick={hasChildren ? () => toggleFase(cat.id) : undefined}
                onMouseEnter={(e) => {
                  if (!hasChildren) return;
                  (e.currentTarget as HTMLElement).style.background =
                    pct > 100
                      ? "#FEE2E2"
                      : pct >= 70
                        ? "#FEF3C7"
                        : "hsl(var(--muted))";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = rowColor(pct);
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {hasChildren && (
                    <span
                      style={{
                        fontSize: 10,
                        color: "#9CA3AF",
                        transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                        transition: "transform 0.15s ease",
                        display: "inline-block",
                      }}
                    >
                      {"\u25B6"}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      fontStyle: cat.isTimeloen ? "italic" : "normal",
                    }}
                  >
                    {cat.faseNumber != null && (
                      <span
                        style={{
                          fontSize: 10,
                          fontFamily: "'JetBrains Mono', monospace",
                          fontWeight: 700,
                          color: "#9CA3AF",
                          marginRight: 6,
                        }}
                      >
                        F{cat.faseNumber}
                      </span>
                    )}
                    {cat.name}
                  </span>
                  {cat.isTimeloen && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 600,
                        padding: "1px 5px",
                        borderRadius: 3,
                        background: "#EEF2FF",
                        color: "#4F46E5",
                        fontStyle: "italic",
                      }}
                    >
                      {t("timeloen")}
                    </span>
                  )}
                </div>
                <span
                  style={{
                    textAlign: "right",
                    fontSize: 12,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 500,
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  {cat.quotedHours.toFixed(1)}
                </span>
                <span
                  style={{
                    textAlign: "right",
                    fontSize: 12,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 600,
                    color: pct > 100 ? "#EF4444" : "hsl(var(--foreground))",
                  }}
                >
                  {cat.usedHours.toFixed(1)}
                </span>
                <div style={{ display: "flex", alignItems: "center" }}>
                  {cat.quotedHours > 0 ? (
                    <BudgetBar used={cat.usedHours} total={cat.quotedHours} compact />
                  ) : (
                    <span
                      style={{
                        fontSize: 10,
                        fontFamily: "'JetBrains Mono', monospace",
                        color: "#9CA3AF",
                      }}
                    >
                      &mdash;
                    </span>
                  )}
                </div>
              </div>

              {/* Expanded children */}
              {hasChildren && isExpanded && (
                <div>
                  {cat.children.map((child) => {
                    const childPct =
                      child.quotedHours > 0
                        ? (child.usedHours / child.quotedHours) * 100
                        : 0;
                    return (
                      <div
                        key={child.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 80px 80px 140px",
                          padding: "6px 14px 6px 34px",
                          borderBottom: "1px solid hsl(var(--border))",
                          background: "hsl(var(--muted))",
                          fontSize: 12,
                        }}
                      >
                        <span
                          style={{
                            fontStyle: child.isTimeloen ? "italic" : "normal",
                            color: "hsl(var(--muted-foreground))",
                          }}
                        >
                          {child.name}
                          {child.isTimeloen && (
                            <span
                              style={{
                                marginLeft: 6,
                                fontSize: 9,
                                fontWeight: 600,
                                padding: "1px 4px",
                                borderRadius: 3,
                                background: "#EEF2FF",
                                color: "#4F46E5",
                                fontStyle: "italic",
                              }}
                            >
                              {t("timeloen")}
                            </span>
                          )}
                        </span>
                        <span
                          style={{
                            textAlign: "right",
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 500,
                            color: "hsl(var(--muted-foreground))",
                          }}
                        >
                          {child.quotedHours.toFixed(1)}
                        </span>
                        <span
                          style={{
                            textAlign: "right",
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 600,
                            color: childPct > 100 ? "#EF4444" : "hsl(var(--foreground))",
                          }}
                        >
                          {child.usedHours.toFixed(1)}
                        </span>
                        <div style={{ display: "flex", alignItems: "center" }}>
                          {child.quotedHours > 0 ? (
                            <BudgetBar
                              used={child.usedHours}
                              total={child.quotedHours}
                              compact
                            />
                          ) : (
                            <span
                              style={{
                                fontSize: 10,
                                fontFamily: "'JetBrains Mono', monospace",
                                color: "#9CA3AF",
                              }}
                            >
                              &mdash;
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Empty state */}
        {stats.categories.length === 0 && (
          <div
            style={{
              padding: "32px 20px",
              textAlign: "center",
              fontSize: 13,
              color: "hsl(var(--muted-foreground))",
            }}
          >
            {t("noCategories")}
          </div>
        )}
      </div>

      {/* Employee breakdown — horizontal bars */}
      <div
        style={{
          background: "hsl(var(--card))",
          border: "1px solid hsl(var(--border))",
          borderRadius: 8,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid hsl(var(--border))",
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 600,
              color: "hsl(var(--foreground))",
            }}
          >
            {t("employeeBreakdown")}
          </span>
        </div>
        <div style={{ padding: "10px 14px 14px" }}>
          {stats.employees.length === 0 && (
            <div
              style={{
                padding: "20px 0",
                textAlign: "center",
                fontSize: 12,
                color: "hsl(var(--muted-foreground))",
              }}
            >
              {t("noEmployeeData")}
            </div>
          )}
          {stats.employees.map((emp, i) => {
            const barWidthPct = (emp.hours / maxEmployeeHours) * 100;
            const color = emp.color || EMPLOYEE_COLORS[i % EMPLOYEE_COLORS.length];
            return (
              <div
                key={emp.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "5px 0",
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 500,
                    width: 120,
                    flexShrink: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: "hsl(var(--foreground))",
                  }}
                >
                  {emp.name}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 8,
                    background: "hsl(var(--muted))",
                    borderRadius: 4,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${barWidthPct}%`,
                      height: "100%",
                      background: color,
                      borderRadius: 4,
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 600,
                    color: "hsl(var(--muted-foreground))",
                    minWidth: 40,
                    textAlign: "right",
                  }}
                >
                  {emp.hours.toFixed(1)}t
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Weekly burn chart */}
      <ChartCard title={t("weeklyBurn")} height={260}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={stats.weeklyBurn}
            margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
          >
            <CartesianGrid {...GRID_STYLE} />
            <XAxis
              dataKey="week"
              {...AXIS_STYLE}
              tick={{ ...AXIS_STYLE }}
            />
            <YAxis
              {...AXIS_STYLE}
              tick={{ ...AXIS_STYLE }}
              tickFormatter={(v: number) => fmt(v)}
            />
            <Tooltip
              content={
                <ChartTooltip
                  formatter={(v: number, key: string) =>
                    `${v.toFixed(1)}t`
                  }
                />
              }
            />
            <Bar
              dataKey="hours"
              name={t("hours")}
              fill="#6366F1"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
