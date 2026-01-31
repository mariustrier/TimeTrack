"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  CheckSquare,
  Clock,
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

const STATUS_BADGE: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  submitted: { variant: "default", label: "Pending" },
  approved: { variant: "secondary", label: "Approved" },
  locked: { variant: "outline", label: "Locked" },
};

const BILLING_LABELS: Record<string, string> = {
  billable: "Billable",
  included: "Included",
  non_billable: "Non-Billable",
  internal: "Internal",
  presales: "Pre-Sales",
};

export default function ApprovalsPage() {
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
        toast.success("Week approved");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to approve");
      }
      fetchApprovals();
    } catch (error) {
      console.error("Failed to approve:", error);
      toast.error("Failed to approve");
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
        toast.success("Week locked");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to lock");
      }
      fetchApprovals();
    } catch (error) {
      console.error("Failed to lock:", error);
      toast.error("Failed to lock");
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
            ? "Week rejected — returned to draft"
            : "Week reopened — returned to draft"
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-36" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Time Approvals</h1>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="submitted">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="locked">Locked</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            {statusFilter === "submitted" ? "Pending Approvals" :
             statusFilter === "approved" ? "Approved Weeks" :
             statusFilter === "locked" ? "Locked Weeks" : "All Submissions"}
            {" "}({submissions.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {submissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <CheckSquare className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">No Submissions</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {statusFilter === "submitted" ? "No weeks waiting for approval." : "No submissions found."}
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
                    {/* Summary row */}
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
                        {format(new Date(sub.weekStart), "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
                      </div>
                      <div className="text-sm font-medium w-16 text-right">{sub.totalHours.toFixed(1)}h</div>
                      <div className="text-sm text-muted-foreground w-20 text-right">
                        {sub.billableHours.toFixed(1)}h bill
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
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => openReasonDialog("reject", sub.userId, sub.weekStart)}
                              disabled={acting}
                            >
                              <X className="mr-1 h-3.5 w-3.5" />
                              Reject
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
                              Lock
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openReasonDialog("reopen", sub.userId, sub.weekStart)}
                              disabled={acting}
                            >
                              <RotateCcw className="mr-1 h-3.5 w-3.5" />
                              Reopen
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
                            Reopen
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Expanded entry details */}
                    {isExpanded && (
                      <div className="bg-muted/20 px-6 py-3 border-t">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-muted-foreground">
                              <th className="text-left py-1.5 font-medium">Date</th>
                              <th className="text-left py-1.5 font-medium">Project</th>
                              <th className="text-right py-1.5 font-medium">Hours</th>
                              <th className="text-left py-1.5 font-medium pl-4">Billing</th>
                              <th className="text-left py-1.5 font-medium pl-4">Comment</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sub.entries.map((entry) => (
                              <tr key={entry.id} className="border-t border-border/50">
                                <td className="py-1.5 text-foreground">
                                  {format(new Date(entry.date), "EEE, MMM d")}
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
              {pendingAction?.action === "reject" ? "Reject Submission" : "Reopen Entries"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>
                Reason {pendingAction?.action === "reopen" ? "(required)" : "(optional)"}
              </Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  pendingAction?.action === "reject"
                    ? "Let the employee know what needs to be changed..."
                    : "Explain why these entries are being reopened..."
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={pendingAction?.action === "reject" ? "destructive" : "default"}
              onClick={handleReasonSubmit}
              disabled={acting || (pendingAction?.action === "reopen" && !reason.trim())}
            >
              {acting
                ? "Processing..."
                : pendingAction?.action === "reject"
                ? "Reject"
                : "Reopen"
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
