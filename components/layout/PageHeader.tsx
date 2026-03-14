"use client";

import { useState } from "react";

interface Tab {
  key: string;
  label: string;
  count?: number;
}

interface PageHeaderProps {
  title: string;
  tabs?: Tab[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  rightControls?: React.ReactNode;
}

function HeaderTabBtn({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  const [hover, setHover] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 12px",
        borderRadius: 4,
        border: "none",
        cursor: "pointer",
        fontSize: 12,
        fontFamily: "'DM Sans', var(--font-sans), sans-serif",
        fontWeight: 600,
        background: active ? "#EEF2FF" : hover ? "hsl(var(--muted))" : "transparent",
        color: active ? "#4338CA" : "hsl(var(--muted-foreground))",
        transition: "all 0.15s ease",
        whiteSpace: "nowrap",
      }}
    >
      {label}
      {count != null && count > 0 && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 16,
            height: 16,
            padding: "0 5px",
            borderRadius: 8,
            fontSize: 10,
            fontFamily: "'JetBrains Mono', var(--font-mono), monospace",
            fontWeight: 700,
            background: "#EF4444",
            color: "#FFFFFF",
            lineHeight: 1,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export function PageHeader({ title, tabs, activeTab, onTabChange, rightControls }: PageHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
        marginBottom: 16,
      }}
    >
      {/* Left side: title + tabs */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <h1
          style={{
            fontSize: 15,
            fontWeight: 700,
            margin: 0,
            fontFamily: "'DM Sans', var(--font-sans), sans-serif",
            color: "hsl(var(--foreground))",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </h1>

        {tabs && tabs.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "hsl(var(--muted))",
              borderRadius: 6,
              padding: 2,
              gap: 1,
            }}
          >
            {tabs.map((tab) => (
              <HeaderTabBtn
                key={tab.key}
                label={tab.label}
                active={activeTab === tab.key}
                onClick={() => onTabChange?.(tab.key)}
                count={tab.count}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right side: controls */}
      {rightControls && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {rightControls}
        </div>
      )}
    </div>
  );
}
