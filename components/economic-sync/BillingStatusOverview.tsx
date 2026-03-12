"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertTriangle, BarChart3 } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

interface BillingStatusData {
  summary: {
    totalHours: number;
    billableHours: number;
    nonBillableHours: number;
    invoicedHours: number;
    uninvoicedBillableHours: number;
    invoicedAmount: number;
  };
  byActivity: {
    activityNumber: number;
    activityName: string;
    totalHours: number;
    billableHours: number;
    nonBillableHours: number;
    invoicedHours: number;
    invoicedAmount: number;
    tilbudCategoryId: string | null;
  }[];
  byEmployee: {
    userId: string;
    name: string;
    totalHours: number;
    billableHours: number;
    nonBillableHours: number;
  }[];
  recentInvoices: {
    date: string;
    bilag: string;
    amount: number;
  }[];
}

interface BillingStatusOverviewProps {
  projectId: string;
}

export const BillingStatusOverview = ({ projectId }: BillingStatusOverviewProps) => {
  const t = useTranslations("economicSync");
  const [data, setData] = useState<BillingStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/projects/${projectId}/billing-status`);
        if (!res.ok) throw new Error("Failed to fetch");
        const result = await res.json();
        setData(result);
      } catch {
        setError("Kunne ikke hente faktureringsstatus");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [projectId]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 0" }}>
        <Loader2 style={{ width: 24, height: 24, animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "32px 0", color: "#ef4444" }}>
        <p>{error}</p>
      </div>
    );
  }

  if (!data || data.summary.totalHours === 0) {
    return (
      <div style={{ textAlign: "center", padding: "32px 0" }}>
        <BarChart3 style={{ width: 40, height: 40, margin: "0 auto 12px", opacity: 0.3 }} />
        <p style={{ fontSize: 14, color: "#6b7280" }}>
          Ingen importerede data for dette projekt
        </p>
      </div>
    );
  }

  const { summary, byActivity, byEmployee, recentInvoices } = data;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Uninvoiced warning */}
      {summary.uninvoicedBillableHours > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            backgroundColor: "#fef3c7",
            borderRadius: 8,
            border: "1px solid #fde68a",
            fontSize: 13,
            color: "#92400e",
          }}
        >
          <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0 }} />
          {t("uninvoicedWarning")
            .replace("{hours}", summary.uninvoicedBillableHours.toFixed(1))
            .replace("{amount}", summary.invoicedAmount.toLocaleString("da-DK"))}
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <KpiCard
          label={t("registered")}
          value={`${summary.totalHours.toFixed(1)}t`}
          color="#3b82f6"
        />
        <KpiCard
          label={t("billable")}
          value={`${summary.billableHours.toFixed(1)}t`}
          color="#10b981"
        />
        <KpiCard
          label={t("nonBillable")}
          value={`${summary.nonBillableHours.toFixed(1)}t`}
          color="#ef4444"
        />
        <KpiCard
          label={t("invoiced")}
          value={`${summary.invoicedHours.toFixed(1)}t`}
          subValue={`${summary.invoicedAmount.toLocaleString("da-DK")} kr`}
          color="#8b5cf6"
        />
      </div>

      {/* Activity breakdown */}
      {byActivity.length > 0 && (
        <div>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            {t("activityBreakdown")}
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {byActivity.map((act) => {
              const maxHours = Math.max(...byActivity.map((a) => a.totalHours));
              const billablePct = act.totalHours > 0 ? (act.billableHours / act.totalHours) * 100 : 0;
              const nonBillablePct = act.totalHours > 0 ? (act.nonBillableHours / act.totalHours) * 100 : 0;
              const widthPct = maxHours > 0 ? (act.totalHours / maxHours) * 100 : 0;

              return (
                <div key={act.activityNumber} style={{ fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontWeight: 500 }}>
                      {act.activityNumber} - {act.activityName}
                    </span>
                    <span style={{ color: "#6b7280" }}>
                      {act.totalHours.toFixed(1)}t
                      {act.invoicedHours > 0 && (
                        <span style={{ color: "#8b5cf6", marginLeft: 6 }}>
                          ({act.invoicedHours.toFixed(1)}t faktureret)
                        </span>
                      )}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: "#f3f4f6",
                      overflow: "hidden",
                      width: `${widthPct}%`,
                      minWidth: 20,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        height: "100%",
                      }}
                    >
                      <div
                        style={{
                          width: `${billablePct}%`,
                          backgroundColor: "#10b981",
                          borderRadius: "4px 0 0 4px",
                        }}
                      />
                      <div
                        style={{
                          width: `${nonBillablePct}%`,
                          backgroundColor: "#ef4444",
                          borderRadius: "0 4px 4px 0",
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11, color: "#6b7280" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: "#10b981" }} />
              {t("billable")}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: "#ef4444" }} />
              {t("nonBillable")}
            </span>
          </div>
        </div>
      )}

      {/* Employee breakdown */}
      {byEmployee.length > 0 && (
        <div>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            {t("employeeBreakdown")}
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {byEmployee.map((emp) => {
              const maxHours = Math.max(...byEmployee.map((e) => e.totalHours));
              const widthPct = maxHours > 0 ? (emp.totalHours / maxHours) * 100 : 0;
              const billablePct = emp.totalHours > 0 ? (emp.billableHours / emp.totalHours) * 100 : 0;

              return (
                <div key={emp.userId} style={{ fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontWeight: 500 }}>{emp.name}</span>
                    <span style={{ color: "#6b7280" }}>
                      {emp.totalHours.toFixed(1)}t ({emp.billableHours.toFixed(1)}t fakturerbar)
                    </span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: "#f3f4f6",
                      overflow: "hidden",
                      width: `${widthPct}%`,
                      minWidth: 20,
                    }}
                  >
                    <div
                      style={{
                        width: `${billablePct}%`,
                        height: "100%",
                        backgroundColor: "#3b82f6",
                        borderRadius: 3,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent invoices */}
      {recentInvoices.length > 0 && (
        <div>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            {t("recentInvoices")}
          </h4>
          <div
            style={{
              fontSize: 13,
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            {recentInvoices.map((inv, i) => (
              <div
                key={`${inv.bilag}-${i}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  borderBottom: i < recentInvoices.length - 1 ? "1px solid #e5e7eb" : "none",
                }}
              >
                <span style={{ color: "#6b7280" }}>{inv.date}</span>
                <span>Bilag {inv.bilag}</span>
                <span style={{ fontWeight: 500 }}>{inv.amount.toLocaleString("da-DK")} kr</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/** Simple KPI card with inline styles */
const KpiCard = ({
  label,
  value,
  subValue,
  color,
}: {
  label: string;
  value: string;
  subValue?: string;
  color: string;
}) => (
  <div
    style={{
      padding: "12px 16px",
      borderRadius: 8,
      border: "1px solid #e5e7eb",
      textAlign: "center",
    }}
  >
    <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
    {subValue && (
      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{subValue}</div>
    )}
    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>{label}</div>
  </div>
);
