"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { Receipt, Plus, Pencil, Trash2, Paperclip } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { PageGuide } from "@/components/ui/page-guide";
import { InfoTooltip } from "@/components/ui/info-tooltip";

interface Expense {
  id: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  projectId: string;
  project: { id: string; name: string; color: string };
  approvalStatus: string;
  rejectionReason: string | null;
  receiptUrl: string | null;
  receiptFileName: string | null;
  receiptFileSize: number | null;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  color: string;
}

export default function ExpensesPage() {
  const t = useTranslations("expenses");
  const tc = useTranslations("common");

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [projectId, setProjectId] = useState("");

  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null);
  const [receiptFileSize, setReceiptFileSize] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  // Currency state
  const [masterCurrency, setMasterCurrency] = useState("USD");
  const [displayCurrency, setDisplayCurrency] = useState("USD");

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/expenses");
      if (res.ok) {
        setExpenses(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch expenses:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        setProjects(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
    fetchProjects();
    fetch("/api/admin/economic")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.currency) {
          setMasterCurrency(data.currency || "USD");
          setDisplayCurrency(data.currency || "USD");
        }
      })
      .catch(() => {});
  }, [fetchExpenses, fetchProjects]);

  function getStatusBadge(status: string) {
    switch (status) {
      case "draft":
        return (
          <span className="inline-flex items-center gap-1">
            <Badge variant="secondary">{t("draft")}</Badge>
            <InfoTooltip textKey="draftStatus" size={12} />
          </span>
        );
      case "submitted":
        return (
          <span className="inline-flex items-center gap-1">
            <Badge
              variant="outline"
              className="border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400"
            >
              {t("submitted")}
            </Badge>
            <InfoTooltip textKey="submittedStatus" size={12} />
          </span>
        );
      case "approved":
        return (
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-900">
            {t("approved")}
          </Badge>
        );
      case "rejected":
        return <Badge variant="destructive">{t("rejected")}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  }

  function getCategoryLabel(cat: string) {
    switch (cat) {
      case "travel":
        return t("travel");
      case "materials":
        return t("materials");
      case "software":
        return t("software");
      case "meals":
        return t("meals");
      case "other":
        return t("other");
      default:
        return cat;
    }
  }

  function resetForm() {
    setAmount("");
    setDescription("");
    setCategory("other");
    setDate(format(new Date(), "yyyy-MM-dd"));
    setProjectId("");
    setEditingExpense(null);
    setReceiptFile(null);
    setReceiptUrl(null);
    setReceiptFileName(null);
    setReceiptFileSize(null);
  }

  function openCreateModal() {
    resetForm();
    setModalOpen(true);
  }

  function openEditModal(expense: Expense) {
    setEditingExpense(expense);
    setAmount(String(expense.amount));
    setDescription(expense.description);
    setCategory(expense.category);
    setDate(format(new Date(expense.date), "yyyy-MM-dd"));
    setProjectId(expense.projectId);
    setReceiptUrl(expense.receiptUrl);
    setReceiptFileName(expense.receiptFileName);
    setReceiptFileSize(expense.receiptFileSize);
    setModalOpen(true);
  }

  function openDeleteModal(expense: Expense) {
    setDeletingExpense(expense);
    setDeleteModalOpen(true);
  }

  async function handleSave() {
    if (!amount || !description || !projectId) return;
    setSaving(true);
    try {
      const payload = {
        amount: parseFloat(amount),
        description,
        category,
        date,
        projectId,
        receiptUrl,
        receiptFileName,
        receiptFileSize,
      };

      let res: Response;
      if (editingExpense) {
        res = await fetch(`/api/expenses/${editingExpense.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        setModalOpen(false);
        resetForm();
        fetchExpenses();
      }
    } catch (error) {
      console.error("Failed to save expense:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingExpense) return;
    try {
      const res = await fetch(`/api/expenses/${deletingExpense.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteModalOpen(false);
        setDeletingExpense(null);
        fetchExpenses();
      }
    } catch (error) {
      console.error("Failed to delete expense:", error);
    }
  }

  async function handleReceiptUpload(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t("fileTooLarge"));
      return;
    }
    const validTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      toast.error(t("invalidFileType"));
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload/receipt", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setReceiptUrl(data.url);
        setReceiptFileName(data.fileName);
        setReceiptFileSize(data.fileSize);
      }
    } catch (error) {
      console.error("Failed to upload receipt:", error);
    } finally {
      setUploading(false);
    }
  }

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
      <PageGuide pageId="expenses" titleKey="expensesTitle" descKey="expensesDesc" tips={["expensesTip1", "expensesTip2", "expensesTip3"]} />
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        <div className="flex items-center gap-2">
          <Button onClick={openCreateModal}>
            <Plus className="mr-2 h-4 w-4" />
            {t("addExpense")}
          </Button>
        </div>
      </div>

      {/* Expenses Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t("myExpenses")}</CardTitle>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Receipt className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                {t("noExpenses")}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("noExpensesDescription")}
              </p>
              <Button className="mt-4" onClick={openCreateModal}>
                <Plus className="mr-2 h-4 w-4" />
                {t("addExpense")}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tc("date")}</TableHead>
                  <TableHead>{tc("project")}</TableHead>
                  <TableHead>{t("category")}</TableHead>
                  <TableHead>{t("amount")}</TableHead>
                  <TableHead>{t("description")}</TableHead>
                  <TableHead>{tc("status")}</TableHead>
                  <TableHead>{t("receipt")}</TableHead>
                  <TableHead className="text-right">
                    {tc("actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(expense.date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{
                            backgroundColor: expense.project?.color || "#888",
                          }}
                        />
                        <span>{expense.project?.name || "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getCategoryLabel(expense.category)}</TableCell>
                    <TableCell className="whitespace-nowrap font-medium">
                      {convertAndFormat(
                        expense.amount,
                        masterCurrency,
                        displayCurrency
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {expense.description}
                      {expense.approvalStatus === "rejected" &&
                        expense.rejectionReason && (
                          <p className="mt-1 text-xs text-destructive">
                            {t("rejectionReason")}: {expense.rejectionReason}
                          </p>
                        )}
                    </TableCell>
                    <TableCell>{getStatusBadge(expense.approvalStatus)}</TableCell>
                    <TableCell>
                      {expense.receiptUrl && (
                        <a
                          href={expense.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-600 hover:text-brand-700"
                          title={t("viewReceipt")}
                        >
                          <Paperclip className="h-4 w-4" />
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {(expense.approvalStatus === "draft" ||
                          expense.approvalStatus === "submitted" ||
                          expense.approvalStatus === "rejected") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditModal(expense)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {(expense.approvalStatus === "draft" ||
                          expense.approvalStatus === "submitted") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteModal(expense)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingExpense ? t("editExpense") : t("addExpense")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("project")}</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder={tc("project")} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: project.color }}
                        />
                        {project.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("amount")}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("description")}</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("description")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("category")}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="travel">{t("travel")}</SelectItem>
                  <SelectItem value="materials">{t("materials")}</SelectItem>
                  <SelectItem value="software">{t("software")}</SelectItem>
                  <SelectItem value="meals">{t("meals")}</SelectItem>
                  <SelectItem value="other">{t("other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("date")}</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("receipt")}</Label>
              {receiptUrl ? (
                <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate text-sm">{receiptFileName}</span>
                  <a
                    href={receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-brand-600 hover:underline"
                  >
                    {t("viewReceipt")}
                  </a>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setReceiptUrl(null);
                      setReceiptFileName(null);
                      setReceiptFileSize(null);
                      setReceiptFile(null);
                    }}
                  >
                    {t("removeReceipt")}
                  </Button>
                </div>
              ) : (
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setReceiptFile(file);
                      handleReceiptUpload(file);
                    }
                  }}
                />
              )}
              {uploading && (
                <p className="text-sm text-muted-foreground">{t("uploading")}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setModalOpen(false);
                resetForm();
              }}
            >
              {tc("cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !amount || !description || !projectId}
            >
              {saving
                ? tc("saving")
                : editingExpense
                  ? tc("update")
                  : tc("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteExpense")}</DialogTitle>
          </DialogHeader>
          <p className="py-4 text-sm text-muted-foreground">
            {t("deleteConfirm")}
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteModalOpen(false);
                setDeletingExpense(null);
              }}
            >
              {tc("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
