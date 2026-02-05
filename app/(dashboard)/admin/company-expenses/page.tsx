"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { Building2, Plus, Pencil, Trash2, Paperclip, ArrowLeft } from "lucide-react";
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

interface CompanyExpenseItem {
  id: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  recurring: boolean;
  frequency: string | null;
  receiptUrl: string | null;
  receiptFileName: string | null;
  receiptFileSize: number | null;
  createdAt: string;
}

const CATEGORIES = ["rent", "insurance", "utilities", "software", "salaries", "other"] as const;
const FREQUENCIES = ["monthly", "quarterly", "yearly"] as const;

export default function CompanyExpensesPage() {
  const t = useTranslations("companyExpenses");
  const te = useTranslations("expenses");
  const tc = useTranslations("common");

  const [expenses, setExpenses] = useState<CompanyExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState("DKK");
  const [masterCurrency, setMasterCurrency] = useState("DKK");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<CompanyExpenseItem | null>(null);
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState<string>("other");
  const [formAmount, setFormAmount] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formRecurring, setFormRecurring] = useState(false);
  const [formFrequency, setFormFrequency] = useState<string>("monthly");
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [formReceiptUrl, setFormReceiptUrl] = useState<string | null>(null);
  const [formReceiptFileName, setFormReceiptFileName] = useState<string | null>(null);
  const [formReceiptFileSize, setFormReceiptFileSize] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const CATEGORY_LABELS: Record<string, string> = {
    rent: t("rent"),
    insurance: t("insurance"),
    utilities: t("utilities"),
    software: t("software"),
    salaries: t("salaries"),
    other: t("other"),
  };

  const FREQUENCY_LABELS: Record<string, string> = {
    monthly: t("monthly"),
    quarterly: t("quarterly"),
    yearly: t("yearly"),
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
      const res = await fetch("/api/admin/company-expenses");
      if (res.ok) {
        const data = await res.json();
        setExpenses(data.expenses ?? data);
      }
    } catch (error) {
      console.error("Failed to fetch company expenses:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCurrency();
    fetchExpenses();
  }, []);

  // Compute summary values
  const monthlyOverhead = expenses
    .filter((e) => e.recurring && e.frequency === "monthly")
    .reduce((sum, e) => sum + e.amount, 0);

  const quarterlyAsMonthly = expenses
    .filter((e) => e.recurring && e.frequency === "quarterly")
    .reduce((sum, e) => sum + e.amount / 3, 0);

  const yearlyAsMonthly = expenses
    .filter((e) => e.recurring && e.frequency === "yearly")
    .reduce((sum, e) => sum + e.amount / 12, 0);

  const totalMonthlyOverhead = monthlyOverhead + quarterlyAsMonthly + yearlyAsMonthly;

  const oneTimeTotal = expenses
    .filter((e) => !e.recurring)
    .reduce((sum, e) => sum + e.amount, 0);

  // Filter expenses by category
  const filteredExpenses =
    categoryFilter === "all"
      ? expenses
      : expenses.filter((e) => e.category === categoryFilter);

  async function handleReceiptUpload(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error(te("fileTooLarge"));
      return;
    }
    const validTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      toast.error(te("invalidFileType"));
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload/receipt", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setFormReceiptUrl(data.url);
        setFormReceiptFileName(data.fileName);
        setFormReceiptFileSize(data.fileSize);
      }
    } catch (error) {
      console.error("Failed to upload receipt:", error);
    } finally {
      setUploading(false);
    }
  }

  function openAddDialog() {
    setEditingExpense(null);
    setFormDescription("");
    setFormCategory("other");
    setFormAmount("");
    setFormDate(format(new Date(), "yyyy-MM-dd"));
    setFormRecurring(false);
    setFormFrequency("monthly");
    setReceiptFile(null);
    setFormReceiptUrl(null);
    setFormReceiptFileName(null);
    setFormReceiptFileSize(null);
    setDialogOpen(true);
  }

  function openEditDialog(expense: CompanyExpenseItem) {
    setEditingExpense(expense);
    setFormDescription(expense.description);
    setFormCategory(expense.category);
    setFormAmount(String(expense.amount));
    setFormDate(expense.date.slice(0, 10));
    setFormRecurring(expense.recurring);
    setFormFrequency(expense.frequency || "monthly");
    setFormReceiptUrl(expense.receiptUrl);
    setFormReceiptFileName(expense.receiptFileName);
    setFormReceiptFileSize(expense.receiptFileSize);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formDescription.trim() || !formAmount || !formDate) return;
    setSaving(true);
    try {
      const body = {
        description: formDescription.trim(),
        category: formCategory,
        amount: parseFloat(formAmount),
        date: formDate,
        recurring: formRecurring,
        frequency: formRecurring ? formFrequency : null,
        receiptUrl: formReceiptUrl,
        receiptFileName: formReceiptFileName,
        receiptFileSize: formReceiptFileSize,
      };

      const url = editingExpense
        ? `/api/admin/company-expenses/${editingExpense.id}`
        : "/api/admin/company-expenses";
      const method = editingExpense ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success(t("expenseSaved"));
        setDialogOpen(false);
        setEditingExpense(null);
        fetchExpenses();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save");
      }
    } catch (error) {
      console.error("Failed to save company expense:", error);
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function openDeleteDialog(id: string) {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!deletingId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/company-expenses/${deletingId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(t("expenseDeleted"));
        setDeleteDialogOpen(false);
        setDeletingId(null);
        fetchExpenses();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete");
      }
    } catch (error) {
      console.error("Failed to delete company expense:", error);
      toast.error("Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageGuide pageId="companyExpenses" titleKey="companyExpensesTitle" descKey="companyExpensesDesc" tips={["companyExpensesTip1", "companyExpensesTip2", "companyExpensesTip3"]} />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="flex items-center justify-center h-8 w-8 rounded-md border border-border bg-background hover:bg-muted transition-colors"
            title={tc("back")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="mr-1 h-4 w-4" />
          {t("addExpense")}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("monthlyOverhead")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {convertAndFormat(totalMonthlyOverhead, masterCurrency, currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("oneTimeExpenses")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {convertAndFormat(oneTimeTotal, masterCurrency, currency)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-2">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tc("all")}</SelectItem>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            {t("title")} ({filteredExpenses.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredExpenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Building2 className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                {t("noExpenses")}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("noExpensesDescription")}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{te("description")}</TableHead>
                  <TableHead><span className="flex items-center gap-1">{te("category")} <InfoTooltip textKey="expenseCategories" size={13} /></span></TableHead>
                  <TableHead className="text-right">{te("amount")}</TableHead>
                  <TableHead>{tc("date")}</TableHead>
                  <TableHead>{tc("type")}</TableHead>
                  <TableHead>{t("frequency")}</TableHead>
                  <TableHead>{te("receipt")}</TableHead>
                  <TableHead className="text-right">{tc("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="font-medium text-foreground">
                      {expense.description}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {CATEGORY_LABELS[expense.category] || expense.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {convertAndFormat(expense.amount, masterCurrency, currency)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(expense.date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {expense.recurring ? (
                        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                          {t("recurring")}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          {t("oneTime")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {expense.recurring && expense.frequency
                        ? FREQUENCY_LABELS[expense.frequency] || expense.frequency
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {expense.receiptUrl && (
                        <a
                          href={expense.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-600 hover:text-brand-700"
                          title={te("viewReceipt")}
                        >
                          <Paperclip className="h-4 w-4" />
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(expense)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openDeleteDialog(expense.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingExpense ? t("editExpense") : t("addExpense")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Description */}
            <div className="space-y-2">
              <Label>{te("description")}</Label>
              <Input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="e.g. Office rent"
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>{te("category")}</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label>{te("amount")}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label>{tc("date")}</Label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </div>

            {/* Recurring toggle */}
            <div className="flex items-center justify-between">
              <Label>{t("recurring")}</Label>
              <button
                type="button"
                role="switch"
                aria-checked={formRecurring}
                onClick={() => setFormRecurring(!formRecurring)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  formRecurring ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formRecurring ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Frequency (only when recurring) */}
            {formRecurring && (
              <div className="space-y-2">
                <Label>{t("frequency")}</Label>
                <Select value={formFrequency} onValueChange={setFormFrequency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((freq) => (
                      <SelectItem key={freq} value={freq}>
                        {FREQUENCY_LABELS[freq]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>{te("receipt")}</Label>
              {formReceiptUrl ? (
                <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate text-sm">{formReceiptFileName}</span>
                  <a
                    href={formReceiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-brand-600 hover:underline"
                  >
                    {te("viewReceipt")}
                  </a>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFormReceiptUrl(null);
                      setFormReceiptFileName(null);
                      setFormReceiptFileSize(null);
                      setReceiptFile(null);
                    }}
                  >
                    {te("removeReceipt")}
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
                <p className="text-sm text-muted-foreground">{te("uploading")}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formDescription.trim() || !formAmount || !formDate}
            >
              {saving ? tc("saving") : editingExpense ? tc("update") : tc("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tc("delete")}</DialogTitle>
          </DialogHeader>
          <p className="py-4 text-sm text-muted-foreground">
            Are you sure you want to delete this expense? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? tc("deleting") : tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
