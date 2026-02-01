"use client";

import { useTheme } from "next-themes";
import { useMemo } from "react";

interface ChartTheme {
  text: string;
  textMuted: string;
  grid: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  background: string;
}

export function useChartTheme(): ChartTheme {
  const { resolvedTheme } = useTheme();

  return useMemo(() => {
    if (resolvedTheme === "dark") {
      return {
        text: "#E2E8F0",
        textMuted: "#94A3B8",
        grid: "#334155",
        tooltipBg: "#1E293B",
        tooltipBorder: "#334155",
        tooltipText: "#E2E8F0",
        background: "#0F172A",
      };
    }
    return {
      text: "#1E293B",
      textMuted: "#64748B",
      grid: "#E2E8F0",
      tooltipBg: "#FFFFFF",
      tooltipBorder: "#E2E8F0",
      tooltipText: "#1E293B",
      background: "#FFFFFF",
    };
  }, [resolvedTheme]);
}
