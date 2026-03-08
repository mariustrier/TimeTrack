"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "@/lib/i18n";

interface DanishHoliday {
  code: string;
  nameEn: string;
  nameDa: string;
  date: string;
  enabled: boolean;
}

export function HolidaySettings() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");

  const [loading, setLoading] = useState(true);
  const [holidays, setHolidays] = useState<DanishHoliday[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/holidays");
        if (res.ok) {
          const data = await res.json();
          setHolidays(data.holidays || []);
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  async function toggleHoliday(code: string, enabled: boolean) {
    setHolidays((prev) =>
      prev.map((h) => (h.code === code ? { ...h, enabled } : h))
    );
    try {
      const res = await fetch("/api/admin/holidays", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, enabled }),
      });
      if (!res.ok) {
        toast.error(tc("saveFailed"));
        setHolidays((prev) =>
          prev.map((h) => (h.code === code ? { ...h, enabled: !enabled } : h))
        );
      }
    } catch {
      toast.error(tc("saveFailed"));
      setHolidays((prev) =>
        prev.map((h) => (h.code === code ? { ...h, enabled: !enabled } : h))
      );
    }
  }

  if (loading) return <Skeleton className="h-48" />;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          {t("holidaySettings") || "Holiday Settings"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {holidays.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("noHolidays") || "No holiday settings available."}
          </p>
        ) : (
          <div className="space-y-3">
            {holidays.map((holiday) => (
              <div
                key={holiday.code}
                className="flex items-center justify-between py-1"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">
                    {holiday.nameDa || holiday.nameEn}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {holiday.date}
                  </Badge>
                </div>
                <Switch
                  checked={holiday.enabled}
                  onCheckedChange={(checked) =>
                    toggleHoliday(holiday.code, checked)
                  }
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
