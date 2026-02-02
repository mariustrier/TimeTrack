"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Receipt, Check, X, Paperclip } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useTranslations } from "@/lib/i18n";
import { convertAndFormat } from "@/lib/currency";

interface PendingExpense {
  id: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  approvalStatus: string;
  receiptUrl: string | null;
  receiptFileName: string | null;
  user: { firstName: string | null; lastName: string | null; email: string };
  project: { name: string; color: string } | null;
}

export function ExpenseApprovals() {
  const t = useTranslations("admin");
  const te = useTranslations("expenses");
  const tc = useTranslations("common");

  const [expenses, setExpenses] = useState<PendingExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"submitted" | "all">("submitted");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [pendingRejectIds, setPendingRejectIds] = useState<string[]>([]);
  const [acting, setActing] = useState(false);
  const [currency, setCurrency] = useState("DKK");
  const [masterCurrency, setMasterCurrency] = useState("DKK");

  const STATUS_BADGE: Record<string, { className: string; label: string }> = {
    submitted: { className: "bg-amber-100 text-amber-800 hover:bg-amber-100", label: tc("pending") },
    approved: { className: "bg-green-100 text-green-800 hover:bg-green-100", label: tc("approved") },
    rejected: { className: "bg-red-100 text-red-800 hover:bg-red-100", label: tc("rejected") },
  };

  const CATEGORY_LABELS: Record<string, string> = {
    travel: te("travel"),
    materials: te("materials"),
    software: te("software"),
    meals: te("meals"),
    other: te("other"),
  };

  async function fetchCurrency() {
    try {
      const res = await fetch("/api/admin/economic");
      if (res.ok) {
        const data = await res.json();
        if (data.masterCurrency) {
          setCurrency(data.masterCurrency);
          setMasterCurrency(data.masterCurrency);
        }
      }
    } catch (error) {
      console.error("Failed to fetch currency:", error);
    }
  }

  async function fetchExpenses() {
    setLoading(true);
    try {
      const url =
        statusFilter === "submitted"
          ? "/api/admin/expense-approvals?status=submitted"
          : "/api/admin/expense-approvals";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setExpenses(data.expenses ?? data);
      }
    } catch (error) {
      console.error("Failed to fetch expense approvals:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCurrency();
  }, []);

  useEffect(() => {
    fetchExpenses();
    setSelectedIds(new Set());
  }, [statusFilter]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === expenses.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(expenses.map((e) => e.id)));
    }
  }

  async function handleApprove(ids: string[]) {
    if (ids.length === 0) return;
    setActing(true);
    try {
      const res = await fetch("/api/admin/expense-approvals/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenseIds: ids }),
      });
      if (res.ok) {
        toast.success(tc("approved"));
        setSelectedIds(new Set());
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to approve");
      }
      fetchExpenses();
    } catch (error) {
      console.error("Failed to approve expenses:", error);
      toast.error("Failed to approve");
    } finally {
      setActing(false);
    }
  }

  function openRejectDialog(ids: string[]) {
    if (ids.length === 0) return;
    setPendingRejectIds(ids);
    setRejectReason("");
    setRejectDialogOpen(true);
  }

  async function handleRejectSubmit() {
    if (pendingRejectIds.length === 0) return;
    setActing(true);
    try {
      const res = await fetch("/api/admin/expense-approvals/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseIds: pendingRejectIds,
          reason: rejectReason.trim() || undefined,
        }),
      });
      if (res.ok) {
        toast.success(tc("rejected"));
        setSelectedIds(new Set());
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to reject");
      }
      setRejectDialogOpen(false);
      setPendingRejectIds([]);
      fetchExpenses();
    } catch (error) {
      console.error("Failed to reject expenses:", error);
      toast.error("Failed to reject");
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 pt-4">
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const submittedExpenses = expenses.filter((e) => e.approvalStatus === "submitted");
  const selectableExpenses = statusFilter === "submitted" ? expenses : submittedExpenses;

  return (
    <div className="space-y-4 pt-4">
      {/* Filter */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant={statusFilter === "submitted" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("submitted")}
        >
          {tc("pending")}
        </Button>
        <Button
          variant={statusFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("all")}
        >
          {tc("all")}
        </Button>
      </div>

      {/* Batch actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
          <span className="text-sm font-medium text-foreground">
            {selectedIds.size} selected
          </span>
          <Button
            size="sm"
            onClick={() => handleApprove(Array.from(selectedIds))}
            disabled={acting}
          >
            <Check className="mr-1 h-3.5 w-3.5" />
            {t("approveSelected")}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => openRejectDialog(Array.from(selectedIds))}
            disabled={acting}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            {t("rejectSelected")}
          </Button>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            {statusFilter === "submitted" ? t("pendingExpenses") : t("expenseApprovals")}
            {" "}({expenses.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {expenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Receipt className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                {statusFilter === "submitted" ? t("pendingExpenses") : t("expenseApprovals")}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {statusFilter === "submitted"
                  ? "No expenses waiting for approval."
                  : "No expenses found."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 accent-primary cursor-pointer"
                      checked={
                        selectableExpenses.length > 0 &&
                        selectableExpenses.every((e) => selectedIds.has(e.id))
                      }
                      onChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>{tc("name")}</TableHead>
                  <TableHead>{tc("project")}</TableHead>
                  <TableHead>{te("category")}</TableHead>
                  <TableHead className="text-right">{te("amount")}</TableHead>
                  <TableHead>{te("description")}</TableHead>
                  <TableHead>{te("receipt")}</TableHead>
                  <TableHead>{tc("date")}</TableHead>
                  <TableHead>{tc("status")}</TableHead>
                  <TableHead className="text-right">{tc("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => {
                  const userName = [expense.user.firstName, expense.user.lastName]
                    .filter(Boolean)
                    .join(" ") || expense.user.email;
                  const badge = STATUS_BADGE[expense.approvalStatus];

                  return (
                    <TableRow key={expense.id}>
                      <TableCell>
                        {expense.approvalStatus === "submitted" && (
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 accent-primary cursor-pointer"
                            checked={selectedIds.has(expense.id)}
                            onChange={() => toggleSelect(expense.id)}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{userName}</p>
                          <p className="text-xs text-muted-foreground">{expense.user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: expense.project?.color || "#94a3b8" }}
                          />
                          <span className="text-foreground">{expense.project?.name || "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {CATEGORY_LABELS[expense.category] || expense.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {convertAndFormat(expense.amount, masterCurrency, currency)}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {expense.description || "-"}
                      </TableCell>
                      <TableCell>
                        {expense.receiptUrl && (
                          <a
                            href={expense.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-600 hover:text-brand-700"
                            title={expense.receiptFileName || te("receipt")}
                          >
                            <Paperclip className="h-4 w-4" />
                          </a>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(expense.date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        {badge && (
                          <Badge className={badge.className}>
                            {badge.label}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {expense.approvalStatus === "submitted" && (
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              onClick={() => handleApprove([expense.id])}
                              disabled={acting}
                            >
                              <Check className="mr-1 h-3.5 w-3.5" />
                              {tc("approve")}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => openRejectDialog([expense.id])}
                              disabled={acting}
                            >
                              <X className="mr-1 h-3.5 w-3.5" />
                              {tc("reject")}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tc("reject")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{te("rejectionReason")}</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for rejection..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectSubmit}
              disabled={acting}
            >
              {acting ? tc("processing") : tc("reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
