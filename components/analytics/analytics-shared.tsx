"use client";

import React, { useState, useRef, useCallback } from "react";

// ---------------------------------------------------------------------------
// Color constants
// ---------------------------------------------------------------------------

export const BILLING_COLORS: Record<string, string> = {
  billable: "#10B981",
  included: "#6366F1",
  nonBillable: "#F59E0B",
  internal: "#8B5CF6",
  presales: "#3B82F6",
};

export const METRIC: Record<string, string> = {
  revenue: "#10B981",
  cost: "#EF4444",
  profit: "#6366F1",
  overhead: "#F97316",
  margin: "#8B5CF6",
  target: "#9CA3AF",
  forecast: "#6366F1",
};

export const PIE_TEAM = [
  "#6366F1",
  "#10B981",
  "#F59E0B",
  "#3B82F6",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
];

// ---------------------------------------------------------------------------
// Shared style constants
// ---------------------------------------------------------------------------

export const AXIS_STYLE = {
  fontSize: 10,
  fontFamily: "'JetBrains Mono', monospace",
  fill: "#9CA3AF",
};

export const GRID_STYLE = {
  strokeDasharray: "3 3",
  stroke: "hsl(var(--border))",
};

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

export function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) {
    return (n / 1_000_000).toFixed(1) + "M";
  }
  if (Math.abs(n) >= 1_000) {
    return Math.round(n / 1_000) + "k";
  }
  return String(n);
}

export function fmtCurrency(n: number): string {
  return `${fmt(n)} kr.`;
}

export function ageColor(days: number): string {
  if (days >= 61) return "#EF4444";
  if (days >= 31) return "#F59E0B";
  return "#10B981";
}

// ---------------------------------------------------------------------------
// KpiCard
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  trend?: "up" | "down" | "flat";
  warn?: boolean;
  help?: string;
}

const trendArrows: Record<string, string> = {
  up: "\u2191",
  down: "\u2193",
  flat: "\u2192",
};

const trendColors: Record<string, string> = {
  up: "#10B981",
  down: "#EF4444",
  flat: "#9CA3AF",
};

export function KpiCard({
  label,
  value,
  sub,
  color,
  trend,
  warn,
  help,
}: KpiCardProps) {
  return (
    <div
      style={{
        background: warn ? "#FFFBEB" : "hsl(var(--card))",
        border: `1px solid ${warn ? "#FDE68A" : "hsl(var(--border))"}`,
        borderRadius: 8,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        transition: "box-shadow 0.2s ease",
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          "0 2px 8px rgba(0,0,0,0.08)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          {label}
        </span>
        {help && <InfoTip text={help} />}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 6,
        }}
      >
        <span
          style={{
            fontSize: 22,
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            color: color || "hsl(var(--foreground))",
            lineHeight: 1.1,
          }}
        >
          {value}
        </span>
        {trend && (
          <span
            style={{
              fontSize: 14,
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 600,
              color: trendColors[trend],
            }}
          >
            {trendArrows[trend]}
          </span>
        )}
      </div>
      {sub && (
        <span
          style={{
            fontSize: 10,
            fontFamily: "'DM Sans', sans-serif",
            color: "#9CA3AF",
          }}
        >
          {sub}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChartCard
// ---------------------------------------------------------------------------

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
  height?: number;
  info?: string;
  badge?: { label: string; bg: string; fg: string };
  help?: string;
  exportData?: Record<string, any>[];
  exportFilename?: string;
}

export function ChartCard({
  title,
  children,
  height = 300,
  info,
  badge,
  help,
  exportData,
  exportFilename,
}: ChartCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [headerHover, setHeaderHover] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const expandedChartRef = useRef<HTMLDivElement>(null);

  const getFilename = useCallback(
    () => exportFilename || title.replace(/\s+/g, "-").toLowerCase(),
    [exportFilename, title]
  );

  const handleExportPng = useCallback(
    (ref: React.RefObject<HTMLDivElement | null>) => {
      const container = ref.current;
      if (!container) return;
      const svgElement = container.querySelector("svg");
      if (!svgElement) return;

      const { width, height: svgHeight } = svgElement.getBoundingClientRect();
      if (!width || !svgHeight) return;

      // Clone SVG and inline computed styles
      const clone = svgElement.cloneNode(true) as SVGSVGElement;
      clone.setAttribute("width", String(width));
      clone.setAttribute("height", String(svgHeight));
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

      const origEls = svgElement.querySelectorAll("*");
      const cloneEls = clone.querySelectorAll("*");
      const styleProps = [
        "fill",
        "stroke",
        "stroke-width",
        "stroke-dasharray",
        "opacity",
        "font-size",
        "font-family",
        "font-weight",
        "text-anchor",
        "dominant-baseline",
        "color",
      ];
      cloneEls.forEach((el, i) => {
        const orig = origEls[i];
        if (!orig) return;
        const cs = window.getComputedStyle(orig);
        styleProps.forEach((p) => {
          const v = cs.getPropertyValue(p);
          if (v && v !== "none" && v !== "normal" && v !== "0") {
            (el as HTMLElement).style.setProperty(p, v);
          }
        });
      });

      const svgData = new XMLSerializer().serializeToString(clone);
      const svgBlob = new Blob([svgData], {
        type: "image/svg+xml;charset=utf-8",
      });
      const url = URL.createObjectURL(svgBlob);

      const img = document.createElement("img");
      img.onload = () => {
        const scale = 2;
        const canvas = document.createElement("canvas");
        canvas.width = width * scale;
        canvas.height = svgHeight * scale;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.scale(scale, scale);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, svgHeight);
        ctx.drawImage(img, 0, 0, width, svgHeight);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => {
          if (!blob) return;
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `${getFilename()}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }, "image/png");
      };
      img.src = url;
    },
    [getFilename]
  );

  const handleExportCsv = useCallback(() => {
    if (!exportData || exportData.length === 0) return;

    const headers = Object.keys(exportData[0]);
    const rows = exportData.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          if (val == null) return "";
          if (
            typeof val === "string" &&
            (val.includes(",") || val.includes('"'))
          ) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return String(val);
        })
        .join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${getFilename()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [exportData, getFilename]);

  const cardContent = (
    ref: React.RefObject<HTMLDivElement | null>,
    h: number
  ) => (
    <div ref={ref as React.RefObject<HTMLDivElement>} style={{ width: "100%", height: h }}>
      {children}
    </div>
  );

  return (
    <>
      <div
        style={{
          background: "hsl(var(--card))",
          border: "1px solid hsl(var(--border))",
          borderRadius: 8,
          transition: "box-shadow 0.2s ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow =
            "0 2px 8px rgba(0,0,0,0.06)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            borderBottom: "1px solid hsl(var(--border))",
          }}
          onMouseEnter={() => setHeaderHover(true)}
          onMouseLeave={() => setHeaderHover(false)}
        >
          <div
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <span
              style={{
                fontSize: 13,
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 600,
                color: "hsl(var(--foreground))",
              }}
            >
              {title}
            </span>
            {badge && (
              <span
                style={{
                  fontSize: 10,
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 600,
                  padding: "2px 6px",
                  borderRadius: 4,
                  background: badge.bg,
                  color: badge.fg,
                }}
              >
                {badge.label}
              </span>
            )}
            {info && (
              <span
                style={{
                  fontSize: 10,
                  fontFamily: "'DM Sans', sans-serif",
                  color: "#9CA3AF",
                }}
              >
                {info}
              </span>
            )}
            {help && <InfoTip text={help} />}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              opacity: headerHover ? 1 : 0,
              transition: "opacity 0.15s ease",
            }}
          >
            {/* PNG export */}
            <button
              onClick={() => handleExportPng(chartRef)}
              title="Export PNG"
              style={{
                border: "none",
                background: "none",
                cursor: "pointer",
                padding: 4,
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#9CA3AF",
                transition: "color 0.15s, background 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = "hsl(var(--foreground))";
                (e.currentTarget as HTMLElement).style.background = "hsl(var(--muted))";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = "#9CA3AF";
                (e.currentTarget as HTMLElement).style.background = "none";
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </button>
            {/* CSV export */}
            {exportData && (
              <button
                onClick={handleExportCsv}
                title="Export CSV"
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  padding: 4,
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#9CA3AF",
                  transition: "color 0.15s, background 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "hsl(var(--foreground))";
                  (e.currentTarget as HTMLElement).style.background = "hsl(var(--muted))";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "#9CA3AF";
                  (e.currentTarget as HTMLElement).style.background = "none";
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </button>
            )}
            {/* Expand button */}
            <button
              onClick={() => setExpanded(true)}
              title="Expand"
              style={{
                border: "none",
                background: "none",
                cursor: "pointer",
                padding: 4,
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#9CA3AF",
                transition: "color 0.15s, background 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = "hsl(var(--foreground))";
                (e.currentTarget as HTMLElement).style.background = "hsl(var(--muted))";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = "#9CA3AF";
                (e.currentTarget as HTMLElement).style.background = "none";
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
          </div>
        </div>
        {/* Body */}
        <div style={{ padding: "10px 14px 14px" }}>
          {cardContent(chartRef, height)}
        </div>
      </div>

      {/* Expanded modal overlay */}
      {expanded && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(4px)",
            animation: "fadeIn 0.2s ease",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setExpanded(false);
          }}
        >
          <div
            style={{
              background: "hsl(var(--card))",
              borderRadius: 12,
              maxWidth: 1200,
              width: "90vw",
              maxHeight: "90vh",
              overflow: "auto",
              animation: "scaleIn 0.2s ease",
              boxShadow: "0 24px 48px rgba(0,0,0,0.2)",
            }}
          >
            {/* Modal header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid hsl(var(--border))",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontSize: 15,
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 600,
                    color: "hsl(var(--foreground))",
                  }}
                >
                  {title}
                </span>
                {badge && (
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: "'DM Sans', sans-serif",
                      fontWeight: 600,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: badge.bg,
                      color: badge.fg,
                    }}
                  >
                    {badge.label}
                  </span>
                )}
                {help && <InfoTip text={help} />}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  onClick={() => handleExportPng(expandedChartRef)}
                  title="Export PNG"
                  style={{
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    padding: 6,
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </button>
                {exportData && (
                  <button
                    onClick={handleExportCsv}
                    title="Export CSV"
                    style={{
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      padding: 6,
                      borderRadius: 4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "hsl(var(--muted-foreground))",
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => setExpanded(false)}
                  title="Close"
                  style={{
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    padding: 6,
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "hsl(var(--muted-foreground))",
                    marginLeft: 4,
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
            {/* Modal body */}
            <div style={{ padding: 20 }}>
              {cardContent(expandedChartRef, 520)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// MiniSelect
// ---------------------------------------------------------------------------

interface MiniSelectProps {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  width?: number;
}

export function MiniSelect({ value, onChange, options, width }: MiniSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        fontSize: 12,
        fontFamily: "'DM Sans', sans-serif",
        padding: "4px 8px",
        borderRadius: 6,
        border: "1px solid hsl(var(--border))",
        background: "hsl(var(--card))",
        color: "hsl(var(--foreground))",
        outline: "none",
        cursor: "pointer",
        width: width ? width : undefined,
        appearance: "auto" as const,
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// StatusDot
// ---------------------------------------------------------------------------

interface StatusDotProps {
  color: string;
  pulse?: boolean;
}

export function StatusDot({ color, pulse }: StatusDotProps) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: color,
        animation: pulse ? "pulse 2s ease-in-out infinite" : undefined,
        flexShrink: 0,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// InfoTip
// ---------------------------------------------------------------------------

interface InfoTipProps {
  text: string;
}

export function InfoTip({ text }: InfoTipProps) {
  const [hover, setHover] = useState(false);

  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 15,
        height: 15,
        borderRadius: "50%",
        background: "hsl(var(--muted))",
        color: "#9CA3AF",
        fontSize: 9,
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: 700,
        cursor: "help",
        flexShrink: 0,
        lineHeight: 1,
        userSelect: "none",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      i
      {hover && (
        <span
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1F2937",
            color: "#FFFFFF",
            fontSize: 11,
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 400,
            padding: "6px 10px",
            borderRadius: 6,
            whiteSpace: "nowrap",
            maxWidth: 240,
            zIndex: 10000,
            pointerEvents: "none",
            animation: "fadeIn 0.15s ease",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          {text}
          {/* Arrow */}
          <span
            style={{
              position: "absolute",
              top: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: "5px solid #1F2937",
            }}
          />
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ChartTooltip
// ---------------------------------------------------------------------------

interface ChartTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  formatter?: (value: number, key: string) => string;
}

export function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const filtered = payload.filter(
    (entry: any) => !String(entry.dataKey || "").startsWith("proj_")
  );

  if (filtered.length === 0) return null;

  return (
    <div
      style={{
        background: "#1F2937",
        borderRadius: 8,
        padding: "10px 14px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
        minWidth: 140,
      }}
    >
      {label && (
        <div
          style={{
            fontSize: 11,
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 600,
            color: "#D1D5DB",
            marginBottom: 6,
          }}
        >
          {label}
        </div>
      )}
      {filtered.map((entry: any, i: number) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "2px 0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: 2,
                background: entry.color || "#6366F1",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontFamily: "'DM Sans', sans-serif",
                color: "#D1D5DB",
              }}
            >
              {entry.name || entry.dataKey}
            </span>
          </div>
          <span
            style={{
              fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 600,
              color: "#FFFFFF",
            }}
          >
            {formatter
              ? formatter(entry.value, entry.dataKey)
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BudgetBar
// ---------------------------------------------------------------------------

interface BudgetBarProps {
  used: number;
  total: number;
  compact?: boolean;
}

export function BudgetBar({ used, total, compact }: BudgetBarProps) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const overBudget = total > 0 && used > total;

  let barColor = "#10B981"; // green
  if (pct >= 90) barColor = "#EF4444"; // red
  else if (pct >= 75) barColor = "#F59E0B"; // amber

  const barHeight = compact ? 4 : 6;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
      }}
    >
      <div
        style={{
          flex: 1,
          height: barHeight,
          background: "hsl(var(--muted))",
          borderRadius: barHeight / 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: barColor,
            borderRadius: barHeight / 2,
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <span
        style={{
          fontSize: compact ? 10 : 11,
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 600,
          color: overBudget ? "#EF4444" : "hsl(var(--muted-foreground))",
          whiteSpace: "nowrap",
          minWidth: compact ? 32 : 38,
          textAlign: "right",
        }}
      >
        {Math.round(pct)}%
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AnalyticsKeyframes
// ---------------------------------------------------------------------------

export function AnalyticsKeyframes() {
  return (
    <style>{`
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes scaleIn {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
      }
    `}</style>
  );
}

// ---------------------------------------------------------------------------
// FontLoader
// ---------------------------------------------------------------------------

export function FontLoader() {
  return (
    <link
      href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
  );
}
