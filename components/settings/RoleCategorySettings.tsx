"use client";

import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AdminCategories } from "@/components/admin/AdminCategories";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function RoleCategorySettings() {
  const t = useTranslations("admin");
  const [loading, setLoading] = useState(true);
  const [rolesEnabled, setRolesEnabled] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/economic");
        if (res.ok) {
          const data = await res.json();
          setRolesEnabled(data.rolesEnabled ?? true);
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  const handleToggle = async () => {
    const newVal = !rolesEnabled;
    setRolesEnabled(newVal);
    try {
      await fetch("/api/admin/economic", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rolesEnabled: newVal }),
      });
    } catch {}
  };

  if (loading) return <Skeleton className="h-40" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          onClick={handleToggle}
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
            rolesEnabled ? "bg-primary" : "bg-muted-foreground/30"
          )}
        >
          <span className={cn(
            "inline-block h-4 w-4 rounded-full bg-white transition-transform",
            rolesEnabled ? "translate-x-6" : "translate-x-1"
          )} />
        </button>
        <Badge variant={rolesEnabled ? "default" : "secondary"}>
          {rolesEnabled ? t("rolesEnabled") : t("rolesDisabled")}
        </Badge>
      </div>
      <AdminCategories enabled={rolesEnabled} />
    </div>
  );
}
