"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "@/lib/i18n";

interface AbsenceReason {
  id: string;
  name: string;
  code: string | null;
  isDefault: boolean;
  active: boolean;
}

export function NonBillableCategorySettings() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");

  const [loading, setLoading] = useState(true);
  const [reasons, setReasons] = useState<AbsenceReason[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/absence-reasons");
        if (res.ok) {
          const data = await res.json();
          setReasons(data.reasons || data || []);
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <Skeleton className="h-32" />;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Tag className="h-4 w-4" />
          {t("absenceReasons") || "Absence Reasons"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {reasons.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("noAbsenceReasons") || "No absence reasons configured."}
          </p>
        ) : (
          <div className="space-y-2">
            {reasons.map((reason) => (
              <div
                key={reason.id}
                className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-foreground">{reason.name}</span>
                  {reason.code && (
                    <Badge variant="outline" className="text-xs">
                      {reason.code}
                    </Badge>
                  )}
                  {reason.isDefault && (
                    <Badge variant="secondary" className="text-xs">
                      {tc("default") || "Default"}
                    </Badge>
                  )}
                </div>
                <Badge variant={reason.active ? "default" : "secondary"} className="text-xs">
                  {reason.active ? tc("active") || "Active" : tc("inactive") || "Inactive"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
