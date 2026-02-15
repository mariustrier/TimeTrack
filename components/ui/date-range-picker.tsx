"use client";

import { useState } from "react";
import {
  subDays,
  subMonths,
  startOfMonth,
  startOfYear,
  format,
} from "date-fns";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTranslations } from "@/lib/i18n";
import { getToday } from "@/lib/demo-date";
import { useIsDemo } from "@/lib/company-context";

export interface DateRange {
  from: Date;
  to: Date;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

export function DateRangePicker({
  value,
  onChange,
  className,
}: DateRangePickerProps) {
  const t = useTranslations("analytics");
  const isDemo = useIsDemo();
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(
    format(value.from, "yyyy-MM-dd")
  );
  const [customTo, setCustomTo] = useState(format(value.to, "yyyy-MM-dd"));

  const presets = [
    { label: t("last7Days"), from: subDays(getToday(isDemo), 7), to: getToday(isDemo) },
    { label: t("last30Days"), from: subDays(getToday(isDemo), 30), to: getToday(isDemo) },
    {
      label: t("thisMonth"),
      from: startOfMonth(getToday(isDemo)),
      to: getToday(isDemo),
    },
    {
      label: t("last3Months"),
      from: subMonths(getToday(isDemo), 3),
      to: getToday(isDemo),
    },
    {
      label: t("last6Months"),
      from: subMonths(getToday(isDemo), 6),
      to: getToday(isDemo),
    },
    {
      label: t("last12Months"),
      from: subMonths(getToday(isDemo), 12),
      to: getToday(isDemo),
    },
    {
      label: t("yearToDate"),
      from: startOfYear(getToday(isDemo)),
      to: getToday(isDemo),
    },
  ];

  function applyPreset(from: Date, to: Date) {
    onChange({ from, to });
    setCustomFrom(format(from, "yyyy-MM-dd"));
    setCustomTo(format(to, "yyyy-MM-dd"));
    setOpen(false);
  }

  function applyCustom() {
    if (customFrom && customTo) {
      onChange({ from: new Date(customFrom), to: new Date(customTo) });
      setOpen(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={className}>
          <CalendarDays className="mr-2 h-4 w-4" />
          {format(value.from, "MMM d, yyyy")} –{" "}
          {format(value.to, "MMM d, yyyy")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="space-y-1 p-2">
          {presets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => applyPreset(preset.from, preset.to)}
              className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="border-t p-3 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">
            {t("custom")}
          </p>
          <div className="flex gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <Button size="sm" className="w-full" onClick={applyCustom}>
            {t("apply")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
