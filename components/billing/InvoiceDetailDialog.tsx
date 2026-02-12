"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Send, XCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useTranslations, useDateLocale } from "@/lib/i18n";

interface InvoiceDetail {
  id: string;
  invoiceNumber: number;
  status: string;
  clientName: string;
  clientAddress: string | null;
  clientCvr: string | null;
  clientEan: string | null;
  invoiceDate: string;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  currency: string;
  paymentTermsDays: number;
  note: string | null;
  externalId: string | null;
  externalSystem: string | null;
  syncedAt: string | null;
  project: { id: string; name: string; color: string; client: string | null };
  lines: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    type: string;
    phaseName: string | null;
  }>;
  company: {
    name: string;
    companyAddress: string | null;
    companyCvr: string | null;
    companyBankAccount: string | null;
    companyBankReg: string | null;
    invoicePrefix: string | null;
  };
}

interface InvoiceDetailDialogProps {
  invoiceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvoiceDetailDialog({ invoiceId, open, onOpenChange }: InvoiceDetailDialogProps) {
  const t = useTranslations("billing");
  const dateLocale = useDateLocale();
  const formatOpts = dateLocale ? { locale: dateLocale } : undefined;
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!invoiceId) return;
    setLoading(true);
    fetch(`/api/invoices/${invoiceId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setInvoice(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [invoiceId]);

  async function handleStatusChange(status: string) {
    if (!invoice) return;
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast.success(t("statusUpdated"));
        // Refresh
        const updated = await fetch(`/api/invoices/${invoiceId}`);
        if (updated.ok) setInvoice(await updated.json());
      }
    } catch {
      toast.error(t("updateFailed"));
    }
  }

  async function handleDownloadPdf() {
    if (!invoice) return;
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/pdf`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `faktura-${invoice.invoiceNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("PDF download failed");
    }
  }

  async function handleSync() {
    if (!invoice) return;
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/sync`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(t("invoiceSynced", { system: data.system }));
        const updated = await fetch(`/api/invoices/${invoiceId}`);
        if (updated.ok) setInvoice(await updated.json());
      } else {
        toast.error(data.error || "Sync failed");
      }
    } catch {
      toast.error("Sync failed");
    }
  }

  if (loading || !invoice) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <Skeleton className="h-96" />
        </DialogContent>
      </Dialog>
    );
  }

  const prefix = invoice.company.invoicePrefix || "";
  const statusStyles: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    sent: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
    void: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle>
              {t("invoiceNumber")} {prefix}{invoice.invoiceNumber}
            </DialogTitle>
            <Badge className={statusStyles[invoice.status] || statusStyles.draft}>
              {t(invoice.status)}
            </Badge>
            {invoice.externalId && (
              <Badge variant="outline" className="text-emerald-600">
                {t("synced", { system: invoice.externalSystem || "" })}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Invoice Preview */}
        <div className="rounded-lg border p-6 space-y-4 bg-white dark:bg-card">
          {/* Seller / Buyer */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-medium">{t("from")}</p>
              <p className="font-semibold">{invoice.company.name}</p>
              {invoice.company.companyAddress && <p className="text-sm text-muted-foreground">{invoice.company.companyAddress}</p>}
              {invoice.company.companyCvr && <p className="text-sm text-muted-foreground">CVR: {invoice.company.companyCvr}</p>}
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-medium">{t("to")}</p>
              <p className="font-semibold">{invoice.clientName}</p>
              {invoice.clientAddress && <p className="text-sm text-muted-foreground">{invoice.clientAddress}</p>}
              {invoice.clientCvr && <p className="text-sm text-muted-foreground">CVR: {invoice.clientCvr}</p>}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">{t("invoiceDate")}</p>
              <p className="font-medium">{format(new Date(invoice.invoiceDate), "dd MMM yyyy", formatOpts)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t("dueDate")}</p>
              <p className="font-medium">{format(new Date(invoice.dueDate), "dd MMM yyyy", formatOpts)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t("period")}</p>
              <p className="font-medium">
                {format(new Date(invoice.periodStart), "dd MMM", formatOpts)} — {format(new Date(invoice.periodEnd), "dd MMM yyyy", formatOpts)}
              </p>
            </div>
          </div>

          {/* Lines */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("description")}</TableHead>
                <TableHead className="text-right">{t("quantity")}</TableHead>
                <TableHead className="text-right">{t("unitPrice")}</TableHead>
                <TableHead className="text-right">{t("lineAmount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>{line.description}</TableCell>
                  <TableCell className="text-right">{line.quantity.toLocaleString("da-DK", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right">{line.unitPrice.toLocaleString("da-DK", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right font-medium">{line.amount.toLocaleString("da-DK", { minimumFractionDigits: 2 })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Totals */}
          <div className="border-t pt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("subtotal")}</span>
              <span>{invoice.subtotal.toLocaleString("da-DK", { minimumFractionDigits: 2 })} {invoice.currency}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("vat")}</span>
              <span>{invoice.vatAmount.toLocaleString("da-DK", { minimumFractionDigits: 2 })} {invoice.currency}</span>
            </div>
            <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
              <span>{t("total")}</span>
              <span>{invoice.total.toLocaleString("da-DK", { minimumFractionDigits: 2 })} {invoice.currency}</span>
            </div>
          </div>

          {/* Bank + Note */}
          {(invoice.company.companyBankReg || invoice.company.companyBankAccount) && (
            <div className="text-sm text-muted-foreground border-t pt-3">
              <p className="font-medium text-foreground">{t("paymentInfo")}</p>
              {invoice.company.companyBankReg && <p>Reg.: {invoice.company.companyBankReg}</p>}
              {invoice.company.companyBankAccount && <p>Konto: {invoice.company.companyBankAccount}</p>}
            </div>
          )}

          {invoice.note && (
            <p className="text-xs text-muted-foreground border-t pt-3">{invoice.note}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <div>
            {invoice.status === "draft" && (
              <Select onValueChange={handleStatusChange}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder={t("changeStatus")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sent">
                    <div className="flex items-center gap-2"><Send className="h-3.5 w-3.5" /> {t("markSent")}</div>
                  </SelectItem>
                  <SelectItem value="paid">
                    <div className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5" /> {t("markAsPaid")}</div>
                  </SelectItem>
                  <SelectItem value="void">
                    <div className="flex items-center gap-2"><XCircle className="h-3.5 w-3.5" /> {t("voidInvoice")}</div>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
            {invoice.status === "sent" && (
              <Button variant="outline" onClick={() => handleStatusChange("paid")}>
                <CheckCircle className="mr-2 h-4 w-4" />
                {t("markAsPaid")}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDownloadPdf}>
              <Download className="mr-2 h-4 w-4" />
              {t("downloadPdf")}
            </Button>
            {!invoice.externalId && invoice.status !== "void" && (
              <Button onClick={handleSync}>
                <Send className="mr-2 h-4 w-4" />
                {t("syncToAccounting")}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
