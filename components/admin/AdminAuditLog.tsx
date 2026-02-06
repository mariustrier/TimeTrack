"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { ClipboardList, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations, useDateLocale } from "@/lib/i18n";

interface AuditLog {
  id: string;
  companyId: string;
  entityType: string;
  entityId: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorId: string;
  metadata: string | null;
  createdAt: string;
}

interface TeamMember {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

const ACTIONS = [
  "SUBMIT",
  "APPROVE",
  "REJECT",
  "LOCK",
  "REOPEN",
  "EDIT_BILLING",
  "AMEND",
  "VOID",
] as const;

const ENTITY_TYPES = ["TimeEntry", "Expense"] as const;

function getActionBadge(action: string, t: (key: string) => string) {
  const labelMap: Record<string, string> = {
    SUBMIT: t("actionSubmit"),
    APPROVE: t("actionApprove"),
    REJECT: t("actionReject"),
    LOCK: t("actionLock"),
    REOPEN: t("actionReopen"),
    EDIT_BILLING: t("actionEditBilling"),
    AMEND: t("actionAmend"),
    VOID: t("actionVoid"),
  };

  const colorMap: Record<string, string> = {
    SUBMIT: "bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-900",
    APPROVE: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-900",
    REJECT: "bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-900",
    LOCK: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-900",
    REOPEN: "bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900 dark:text-amber-300 dark:hover:bg-amber-900",
    EDIT_BILLING: "bg-purple-100 text-purple-700 hover:bg-purple-100 dark:bg-purple-900 dark:text-purple-300 dark:hover:bg-purple-900",
    AMEND: "bg-purple-100 text-purple-700 hover:bg-purple-100 dark:bg-purple-900 dark:text-purple-300 dark:hover:bg-purple-900",
    VOID: "bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-900",
  };

  return (
    <Badge className={colorMap[action] || ""}>
      {labelMap[action] || action}
    </Badge>
  );
}

function getEntityBadge(entityType: string, t: (key: string) => string) {
  if (entityType === "TimeEntry") {
    return <Badge variant="outline">{t("entityTimeEntry")}</Badge>;
  }
  return <Badge variant="outline">{t("entityExpense")}</Badge>;
}

function formatMetadata(metadata: string | null, t: (key: string) => string): string {
  if (!metadata) return "—";
  try {
    const data = JSON.parse(metadata);
    const parts: string[] = [];

    if (data.entryCount != null) parts.push(`${data.entryCount} ${t("entries")}`);
    if (data.totalHours != null) parts.push(`${data.totalHours} ${t("hours")}`);
    if (data.reason) parts.push(`${t("reason")}: ${data.reason}`);
    if (data.date) parts.push(data.date);
    if (data.weekStart && !data.date) parts.push(data.weekStart);
    if (data.entryDate) parts.push(data.entryDate);

    if (data.changes) {
      const changed = Object.keys(data.changes);
      if (changed.length > 0) parts.push(changed.join(", "));
    }

    return parts.length > 0 ? parts.join(" · ") : "—";
  } catch {
    return "—";
  }
}

export function AdminAuditLog() {
  const t = useTranslations("auditLog");
  const dateLocale = useDateLocale();
  const formatOpts = dateLocale ? { locale: dateLocale } : undefined;

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [actorFilter, setActorFilter] = useState("all");

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  const actorMap = useMemo(() => {
    const map = new Map<string, string>();
    teamMembers.forEach((m) => {
      const name = m.firstName || m.lastName
        ? `${m.firstName || ""} ${m.lastName || ""}`.trim()
        : m.email;
      map.set(m.id, name);
    });
    return map;
  }, [teamMembers]);

  useEffect(() => {
    fetch("/api/team")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setTeamMembers(data))
      .catch(() => {});
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: "50" });
      if (actionFilter !== "all") params.set("action", actionFilter);
      if (actorFilter !== "all") params.set("actorId", actorFilter);

      const res = await fetch(`/api/admin/audit-log?${params}`);
      if (res.ok) {
        const data = await res.json();
        let filtered = data.logs;
        // Client-side entity type filter (API doesn't support it)
        if (entityFilter !== "all") {
          filtered = filtered.filter((l: AuditLog) => l.entityType === entityFilter);
        }
        setLogs(filtered);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      }
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, actorFilter, entityFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [actionFilter, entityFilter, actorFilter]);

  if (loading && logs.length === 0) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder={t("filterAction")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allActions")}</SelectItem>
            {ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {t(`action${a.charAt(0)}${a.slice(1).toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase())}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t("filterEntity")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allEntities")}</SelectItem>
            {ENTITY_TYPES.map((e) => (
              <SelectItem key={e} value={e}>
                {e === "TimeEntry" ? t("entityTimeEntry") : t("entityExpense")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={actorFilter} onValueChange={setActorFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t("filterActor")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allActors")}</SelectItem>
            {teamMembers.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {actorMap.get(m.id) || m.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            {t("title")}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({total} {t("totalEntries")})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ClipboardList className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">{t("noLogsTitle")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("noLogsDescription")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("columnDate")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("columnActor")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("columnAction")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("columnEntity")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("columnStatus")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("columnDetails")}</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3 text-foreground whitespace-nowrap">
                        {format(new Date(log.createdAt), "MMM d, yyyy HH:mm", formatOpts)}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">
                            {actorMap.get(log.actorId) || log.actorId}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {getActionBadge(log.action, t)}
                      </td>
                      <td className="px-4 py-3">
                        {getEntityBadge(log.entityType, t)}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {log.fromStatus && log.toStatus ? (
                          <span className="flex items-center gap-1">
                            <Badge variant="secondary" className="text-xs">{log.fromStatus}</Badge>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <Badge variant="secondary" className="text-xs">{log.toStatus}</Badge>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[300px] truncate">
                        {formatMetadata(log.metadata, t)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t mt-4">
              <p className="text-sm text-muted-foreground">
                {t("page")} {page} {t("of")} {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  {t("previous")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  {t("next")}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
