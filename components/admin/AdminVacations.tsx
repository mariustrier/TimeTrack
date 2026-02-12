"use client";

import { useState, useEffect, useCallback } from "react";
import { format, differenceInBusinessDays } from "date-fns";
import { Palmtree, Check, X } from "lucide-react";
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

interface VacationRequest {
  id: string;
  startDate: string;
  endDate: string;
  type: string;
  status: string;
  note: string | null;
  createdAt: string;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    vacationTrackingUnit?: string;
    weeklyTarget?: number;
  };
}

function countBusinessDays(startDate: string, endDate: string): number {
  const days = differenceInBusinessDays(new Date(endDate), new Date(startDate)) + 1;
  return Math.max(days, 1);
}

export function AdminVacations() {
  const t = useTranslations("adminVacations");
  const tc = useTranslations("common");
  const tv = useTranslations("vacations");
  const dateLocale = useDateLocale();
  const formatOpts = dateLocale ? { locale: dateLocale } : undefined;

  const [requests, setRequests] = useState<VacationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [updating, setUpdating] = useState<string | null>(null);

  function getStatusBadge(status: string) {
    switch (status) {
      case "approved":
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-900">{tc("approved")}</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-900">{tc("rejected")}</Badge>;
      case "cancelled":
        return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 dark:bg-orange-900 dark:text-orange-300 dark:hover:bg-orange-900">{tc("cancelled")}</Badge>;
      default:
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900 dark:text-amber-300 dark:hover:bg-amber-900">{tc("pending")}</Badge>;
    }
  }

  function getTypeBadge(type: string) {
    switch (type) {
      case "sick":
        return <Badge variant="outline">{tv("sick")}</Badge>;
      case "personal":
        return <Badge variant="outline">{tv("personal")}</Badge>;
      default:
        return <Badge variant="outline">{tv("vacationType")}</Badge>;
    }
  }

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/vacations");
      if (res.ok) {
        setRequests(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch vacations:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  async function handleAction(id: string, status: "approved" | "rejected") {
    setUpdating(id);
    try {
      const res = await fetch(`/api/vacations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        fetchRequests();
      }
    } catch (error) {
      console.error("Failed to update request:", error);
    } finally {
      setUpdating(null);
    }
  }

  const filteredRequests = statusFilter === "all"
    ? requests
    : requests.filter((r) => r.status === statusFilter);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tc("all")}</SelectItem>
            <SelectItem value="pending">{tc("pending")}</SelectItem>
            <SelectItem value="approved">{tc("approved")}</SelectItem>
            <SelectItem value="rejected">{tc("rejected")}</SelectItem>
            <SelectItem value="cancelled">{tc("cancelled")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Requests Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            {statusFilter === "all" ? t("allRequests") : statusFilter === "pending" ? t("pendingRequests") : statusFilter === "approved" ? t("approvedRequests") : statusFilter === "cancelled" ? t("cancelledRequests") : t("rejectedRequests")}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({filteredRequests.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Palmtree className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">{t("noRequestsTitle")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("noRequestsDescription", { status: statusFilter !== "all" ? statusFilter : "" })}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("employee")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{tc("type")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("period")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("daysColumn")} / {t("hoursColumn")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{tc("status")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{tc("note")}</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">{tc("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((req) => (
                    <tr key={req.id} className="border-b hover:bg-muted/50/50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">
                            {req.user.firstName} {req.user.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">{req.user.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">{getTypeBadge(req.type)}</td>
                      <td className="px-4 py-3 text-foreground">
                        {format(new Date(req.startDate), "MMM d", formatOpts)} —{" "}
                        {format(new Date(req.endDate), "MMM d, yyyy", formatOpts)}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {req.user.vacationTrackingUnit === "hours" && req.user.weeklyTarget
                          ? `${(countBusinessDays(req.startDate, req.endDate) * (req.user.weeklyTarget / 5)).toFixed(1)}h`
                          : countBusinessDays(req.startDate, req.endDate)}
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(req.status)}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                        {req.note || "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {req.status === "pending" && (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:text-emerald-300 dark:hover:bg-emerald-950"
                              onClick={() => handleAction(req.id, "approved")}
                              disabled={updating === req.id}
                            >
                              <Check className="mr-1 h-4 w-4" />
                              {tc("approve")}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950"
                              onClick={() => handleAction(req.id, "rejected")}
                              disabled={updating === req.id}
                            >
                              <X className="mr-1 h-4 w-4" />
                              {tc("reject")}
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
