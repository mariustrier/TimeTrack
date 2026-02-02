"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  CheckSquare,
  Check,
  X,
  Lock,
  RotateCcw,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useTranslations, useDateLocale } from "@/lib/i18n";

interface Entry {
  id: string;
  hours: number;
  date: string;
  comment: string | null;
  billingStatus: string;
  project: { id: string; name: string; color: string };
}

interface WeekSubmission {
  userId: string;
  userName: string;
  userEmail: string;
  weekStart: string;
  totalHours: number;
  billableHours: number;
  entryCount: number;
  submittedAt: string | null;
  approvalStatus: string;
  entries: Entry[];
}

export function TimeEntryApprovals() {
  const t = useTranslations("approvals");
  const tc = useTranslations("common");
  const dateLocale = useDateLocale();
  const formatOpts = dateLocale ? { locale: dateLocale } : undefined;

  const STATUS_BADGE: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    submitted: { variant: "default", label: tc("pending") },
    approved: { variant: "secondary", label: tc("approved") },
    locked: { variant: "outline", label: t("locked") },
  };

  const BILLING_LABELS: Record<string, string> = {
    billable: tc("billable"),
    included: tc("included"),
    non_billable: tc("nonBillable"),
    internal: tc("internal"),
    presales: tc("preSales"),
  };

  const [submissions, setSubmissions] = useState<WeekSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("submitted");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pendingAction, setPendingAction] = useState<{
    action: "reject" | "reopen";
    userId: string;
    weekStart: string;
  } | null>(null);
  const [acting, setActing] = useState(false);

  async function fetchApprovals() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/approvals?status=${statusFilter}`);
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.weekSubmissions);
      }
    } catch (error) {
      console.error("Failed to fetch approvals:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchApprovals();
  }, [statusFilter]);

  async function handleApprove(userId: string, weekStart: string) {
    setActing(true);
    try {
      const res = await fetch("/api/admin/approvals/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, weekStart }),
      });
      if (res.ok) {
        toast.success(t("weekApproved"));
      } else {
        const data = await res.json();
        toast.error(data.error || t("failedToApprove"));
      }
      fetchApprovals();
    } catch (error) {
      console.error("Failed to approve:", error);
      toast.error(t("failedToApprove"));
    } finally {
      setActing(false);
    }
  }

  async function handleLock(userId: string, weekStart: string) {
    setActing(true);
    try {
      const res = await fetch("/api/admin/approvals/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, weekStart }),
      });
      if (res.ok) {
        toast.success(t("weekLocked"));
      } else {
        const data = await res.json();
        toast.error(data.error || t("failedToLock"));
      }
      fetchApprovals();
    } catch (error) {
      console.error("Failed to lock:", error);
      toast.error(t("failedToLock"));
    } finally {
      setActing(false);
    }
  }

  function openReasonDialog(action: "reject" | "reopen", userId: string, weekStart: string) {
    setPendingAction({ action, userId, weekStart });
    setReason("");
    setReasonDialogOpen(true);
  }

  async function handleReasonSubmit() {
    if (!pendingAction) return;
    if (pendingAction.action === "reopen" && !reason.trim()) return;

    setActing(true);
    try {
      const endpoint = pendingAction.action === "reject"
        ? "/api/admin/approvals/reject"
        : "/api/admin/approvals/reopen";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: pendingAction.userId,
          weekStart: pendingAction.weekStart,
          reason: reason.trim() || undefined,
        }),
      });

      if (res.ok) {
        toast.success(
          pendingAction.action === "reject"
            ? t("weekRejected")
            : t("weekReopened")
        );
      } else {
        const data = await res.json();
        toast.error(data.error || `Failed to ${pendingAction.action}`);
      }

      setReasonDialogOpen(false);
      setPendingAction(null);
      fetchApprovals();
    } catch (error) {
      console.error("Failed:", error);
      toast.error(`Failed to ${pendingAction.action}`);
    } finally {
      setActing(false);
    }
  }

  function toggleExpand(key: string) {
    setExpandedKey(expandedKey === key ? null : key);
  }

  if (loading) {
    return (
      <div className="space-y-4 pt-4">
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-end">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="submitted">{tc("pending")}</SelectItem>
            <SelectItem value="approved">{tc("approved")}</SelectItem>
            <SelectItem value="locked">{t("locked")}</SelectItem>
            <SelectItem value="all">{tc("all")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            {statusFilter === "submitted" ? t("pendingApprovals") :
             statusFilter === "approved" ? t("approvedWeeks") :
             statusFilter === "locked" ? t("lockedWeeks") : t("allSubmissions")}
            {" "}({submissions.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {submissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <CheckSquare className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">{t("noSubmissionsTitle")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {statusFilter === "submitted" ? t("noSubmissionsPending") : t("noSubmissionsFound")}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {submissions.map((sub) => {
                const key = `${sub.userId}|${sub.weekStart}`;
                const isExpanded = expandedKey === key;
                const weekEnd = new Date(sub.weekStart);
                weekEnd.setDate(weekEnd.getDate() + 6);

                return (
                  <div key={key}>
                    <div
                      className="flex items-center gap-4 px-6 py-4 hover:bg-muted/30 cursor-pointer"
                      onClick={() => toggleExpand(key)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">{sub.userName}</p>
                        <p className="text-xs text-muted-foreground">{sub.userEmail}</p>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(sub.weekStart), "MMM d", formatOpts)} - {format(weekEnd, "MMM d, yyyy", formatOpts)}
                      </div>
                      <div className="text-sm font-medium w-16 text-right">{sub.totalHours.toFixed(1)}h</div>
                      <div className="text-sm text-muted-foreground w-20 text-right">
                        {sub.billableHours.toFixed(1)}h {t("bill")}
                      </div>
                      <Badge variant={STATUS_BADGE[sub.approvalStatus]?.variant || "outline"}>
                        {STATUS_BADGE[sub.approvalStatus]?.label || sub.approvalStatus}
                      </Badge>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        {sub.approvalStatus === "submitted" && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleApprove(sub.userId, sub.weekStart)}
                              disabled={acting}
                            >
                              <Check className="mr-1 h-3.5 w-3.5" />
                              {tc("approve")}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => openReasonDialog("reject", sub.userId, sub.weekStart)}
                              disabled={acting}
                            >
                              <X className="mr-1 h-3.5 w-3.5" />
                              {tc("reject")}
                            </Button>
                          </>
                        )}
                        {sub.approvalStatus === "approved" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleLock(sub.userId, sub.weekStart)}
                              disabled={acting}
                            >
                              <Lock className="mr-1 h-3.5 w-3.5" />
                              {t("lock")}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openReasonDialog("reopen", sub.userId, sub.weekStart)}
                              disabled={acting}
                            >
                              <RotateCcw className="mr-1 h-3.5 w-3.5" />
                              {t("reopen")}
                            </Button>
                          </>
                        )}
                        {sub.approvalStatus === "locked" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openReasonDialog("reopen", sub.userId, sub.weekStart)}
                            disabled={acting}
                          >
                            <RotateCcw className="mr-1 h-3.5 w-3.5" />
                            {t("reopen")}
                          </Button>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="bg-muted/20 px-6 py-3 border-t">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-muted-foreground">
                              <th className="text-left py-1.5 font-medium">{tc("date")}</th>
                              <th className="text-left py-1.5 font-medium">{tc("project")}</th>
                              <th className="text-right py-1.5 font-medium">{tc("hours")}</th>
                              <th className="text-left py-1.5 font-medium pl-4">{tc("billable")}</th>
                              <th className="text-left py-1.5 font-medium pl-4">{tc("comment")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sub.entries.map((entry) => (
                              <tr key={entry.id} className="border-t border-border/50">
                                <td className="py-1.5 text-foreground">
                                  {format(new Date(entry.date), "EEE, MMM d", formatOpts)}
                                </td>
                                <td className="py-1.5">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="h-2.5 w-2.5 rounded-full"
                                      style={{ backgroundColor: entry.project.color }}
                                    />
                                    <span className="text-foreground">{entry.project.name}</span>
                                  </div>
                                </td>
                                <td className="py-1.5 text-right font-medium text-foreground">
                                  {entry.hours}h
                                </td>
                                <td className="py-1.5 pl-4">
                                  <Badge variant="outline" className="text-xs">
                                    {BILLING_LABELS[entry.billingStatus] || entry.billingStatus}
                                  </Badge>
                                </td>
                                <td className="py-1.5 pl-4 text-muted-foreground max-w-[300px] truncate">
                                  {entry.comment || "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reason Dialog */}
      <Dialog open={reasonDialogOpen} onOpenChange={setReasonDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction?.action === "reject" ? t("rejectSubmission") : t("reopenEntries")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>
                {pendingAction?.action === "reopen" ? t("reasonRequired") : t("reasonOptional")}
              </Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  pendingAction?.action === "reject"
                    ? t("rejectPlaceholder")
                    : t("reopenPlaceholder")
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonDialogOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              variant={pendingAction?.action === "reject" ? "destructive" : "default"}
              onClick={handleReasonSubmit}
              disabled={acting || (pendingAction?.action === "reopen" && !reason.trim())}
            >
              {acting
                ? tc("processing")
                : pendingAction?.action === "reject"
                ? tc("reject")
                : t("reopen")
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
