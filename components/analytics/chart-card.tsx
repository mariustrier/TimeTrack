"use client";

import { ReactNode, useRef, useCallback } from "react";
import { BarChart3, Download, Image as ImageIcon } from "lucide-react";
import { ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";

interface ChartCardProps {
  title: string;
  description?: string;
  loading?: boolean;
  isEmpty?: boolean;
  children: ReactNode;
  className?: string;
  chartHeight?: number;
  exportData?: Record<string, any>[];
  exportFilename?: string;
}

export function ChartCard({
  title,
  description,
  loading,
  isEmpty,
  children,
  className,
  chartHeight = 300,
  exportData,
  exportFilename,
}: ChartCardProps) {
  const t = useTranslations("analytics");
  const chartRef = useRef<HTMLDivElement>(null);

  const handleExportPng = useCallback(() => {
    const container = chartRef.current;
    if (!container) return;
    const svgElement = container.querySelector("svg");
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);

    const img = document.createElement("img");
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = svgElement.clientWidth * 2;
      canvas.height = svgElement.clientHeight * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(2, 2);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${exportFilename || title.replace(/\s+/g, "-").toLowerCase()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, "image/png");
    };
    img.src = url;
  }, [exportFilename, title]);

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
    a.download = `${exportFilename || title.replace(/\s+/g, "-").toLowerCase()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [exportData, exportFilename, title]);

  const showExport = !loading && !isEmpty;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {showExport && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleExportPng}
                title={t("exportPng")}
              >
                <ImageIcon className="h-3.5 w-3.5" />
              </Button>
              {exportData && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleExportCsv}
                  title={t("exportCsv")}
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="w-full" style={{ height: chartHeight }} />
        ) : isEmpty ? (
          <div
            className="flex flex-col items-center justify-center text-center"
            style={{ height: chartHeight }}
          >
            <BarChart3 className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">{t("noData")}</p>
          </div>
        ) : (
          <div ref={chartRef} style={{ width: "100%", height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              {children as React.ReactElement}
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
