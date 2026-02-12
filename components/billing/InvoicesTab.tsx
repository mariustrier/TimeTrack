"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { FileText, Download, Send, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations, useDateLocale } from "@/lib/i18n";
import { InvoiceDetailDialog } from "./InvoiceDetailDialog";

interface Invoice {
  id: string;
  invoiceNumber: number;
  status: string;
  clientName: string;
  invoiceDate: string;
  dueDate: string;
  subtotal: number;
  vatAmount: number;
  total: number;
  currency: string;
  externalId: string | null;
  externalSystem: string | null;
  syncedAt: string | null;
  project: { id: string; name: string; color: string; client: string | null };
  lines: Array<{ id: string; description: string; quantity: number; unitPrice: number; amount: number }>;
}

function StatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  const styles: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    sent: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
    void: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  };
  return (
    <Badge className={`${styles[status] || styles.draft} hover:${styles[status] || styles.draft}`}>
      {t(status)}
    </Badge>
  );
}

export function InvoicesTab() {
  const t = useTranslations("billing");
  const dateLocale = useDateLocale();
  const formatOpts = dateLocale ? { locale: dateLocale } : undefined;
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const res = await fetch(`/api/invoices${params}`);
      if (res.ok) setInvoices(await res.json());
    } catch (error) {
      console.error("Failed to fetch invoices:", error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  async function handleDelete(id: string) {
    if (!confirm(t("confirmDelete"))) return;
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(t("invoiceDeleted"));
        fetchInvoices();
      } else {
        toast.error(t("deleteFailed"));
      }
    } catch {
      toast.error(t("deleteFailed"));
    }
  }

  async function handleDownloadPdf(id: string, invoiceNumber: number) {
    try {
      const res = await fetch(`/api/invoices/${id}/pdf`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `faktura-${invoiceNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("PDF download failed");
    }
  }

  async function handleSync(id: string) {
    try {
      const res = await fetch(`/api/invoices/${id}/sync`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(t("invoiceSynced", { system: data.system }));
        fetchInvoices();
      } else {
        toast.error(data.error || "Sync failed");
      }
    } catch {
      toast.error("Sync failed");
    }
  }

  if (loading) {
    return <Skeleton className="h-64" />;
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {t("invoices")}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({invoices.length})
              </span>
            </CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allStatuses")}</SelectItem>
                <SelectItem value="draft">{t("draft")}</SelectItem>
                <SelectItem value="sent">{t("sent")}</SelectItem>
                <SelectItem value="paid">{t("paid")}</SelectItem>
                <SelectItem value="void">{t("void")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">{t("noInvoices")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("noInvoicesDesc")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("invoiceNumber")}</TableHead>
                    <TableHead>{t("client")}</TableHead>
                    <TableHead>{t("invoiceDate")}</TableHead>
                    <TableHead className="text-right">{t("total")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead>{t("syncStatus")}</TableHead>
                    <TableHead className="text-right">{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium">#{inv.invoiceNumber}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{inv.clientName}</p>
                          <p className="text-xs text-muted-foreground">{inv.project.name}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(inv.invoiceDate), "dd MMM yyyy", formatOpts)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {inv.total.toLocaleString("da-DK", { minimumFractionDigits: 2 })} {inv.currency}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={inv.status} t={t} />
                      </TableCell>
                      <TableCell>
                        {inv.externalId ? (
                          <Badge variant="outline" className="text-emerald-600">
                            {t("synced", { system: inv.externalSystem || "" })}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">{t("notSynced")}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedInvoice(inv.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDownloadPdf(inv.id, inv.invoiceNumber)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {!inv.externalId && inv.status === "draft" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSync(inv.id)}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                          {inv.status === "draft" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleDelete(inv.id)}
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
            </div>
          )}
        </CardContent>
      </Card>

      {selectedInvoice && (
        <InvoiceDetailDialog
          invoiceId={selectedInvoice}
          open={!!selectedInvoice}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedInvoice(null);
              fetchInvoices();
            }
          }}
        />
      )}
    </>
  );
}
