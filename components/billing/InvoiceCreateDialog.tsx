"use client";

import { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { ArrowRight, ArrowLeft, FileText, Eye, Trash2, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "@/lib/i18n";

interface PreviewLine {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  type: string;
  phaseName: string | null;
}

interface InvoiceCreateDialogProps {
  projectId: string;
  projectName: string;
  clientName: string;
  oldestEntryDate?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvoiceCreateDialog({
  projectId,
  projectName,
  clientName: defaultClientName,
  oldestEntryDate,
  open,
  onOpenChange,
}: InvoiceCreateDialogProps) {
  const t = useTranslations("billing");
  const now = new Date();
  const lastMonth = subMonths(now, 1);

  // Default period: from oldest uninvoiced entry (or start of last month) to end of last month
  const defaultStart = oldestEntryDate
    ? format(startOfMonth(new Date(oldestEntryDate)), "yyyy-MM-dd")
    : format(startOfMonth(lastMonth), "yyyy-MM-dd");

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Scope
  const [periodStart, setPeriodStart] = useState(defaultStart);
  const [periodEnd, setPeriodEnd] = useState(format(endOfMonth(lastMonth), "yyyy-MM-dd"));
  const [groupBy, setGroupBy] = useState<"employee" | "phase" | "description" | "flat">("employee");
  const [includeExpenses, setIncludeExpenses] = useState(true);
  const [phaseId, setPhaseId] = useState<string | null>(null);
  const [phases, setPhases] = useState<{ id: string; name: string; color: string | null }[]>([]);

  // Step 2: Preview lines
  const [lines, setLines] = useState<PreviewLine[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [vatAmount, setVatAmount] = useState(0);
  const [total, setTotal] = useState(0);
  const [currency, setCurrency] = useState("DKK");

  // Step 3: Client info
  const [clientName, setClientName] = useState(defaultClientName);
  const [clientAddress, setClientAddress] = useState("");
  const [clientCvr, setClientCvr] = useState("");
  const [paymentDays, setPaymentDays] = useState("8");
  const [defaultPaymentDays, setDefaultPaymentDays] = useState(8);
  const [savingDefault, setSavingDefault] = useState(false);
  const [note, setNote] = useState("");

  // Fetch company default payment days and project phases on open
  useEffect(() => {
    if (!open) return;
    fetch("/api/billing/settings")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.defaultPaymentDays) {
          setPaymentDays(String(data.defaultPaymentDays));
          setDefaultPaymentDays(data.defaultPaymentDays);
        }
      })
      .catch(() => {});
    fetch(`/api/admin/phases`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (Array.isArray(data)) setPhases(data);
      })
      .catch(() => {});
  }, [open]);

  async function handlePreview() {
    setLoading(true);
    try {
      const res = await fetch("/api/invoices/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          periodStart,
          periodEnd,
          groupBy,
          includeExpenses,
          phaseId: phaseId || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Preview failed");
        return;
      }

      const data = await res.json();
      setLines(data.lines);
      setSubtotal(data.subtotal);
      setVatAmount(data.vatAmount);
      setTotal(data.total);
      setCurrency(data.currency);
      setStep(2);
    } catch {
      toast.error("Preview failed");
    } finally {
      setLoading(false);
    }
  }

  function removeLine(index: number) {
    const newLines = lines.filter((_, i) => i !== index);
    setLines(newLines);
    const newSubtotal = Math.round(newLines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
    const newVat = Math.round(newSubtotal * 25 / 100 * 100) / 100;
    setSubtotal(newSubtotal);
    setVatAmount(newVat);
    setTotal(Math.round((newSubtotal + newVat) * 100) / 100);
  }

  function addManualLine() {
    const newLine: PreviewLine = {
      description: "",
      quantity: 1,
      unitPrice: 0,
      amount: 0,
      type: "manual",
      phaseName: null,
    };
    setLines([...lines, newLine]);
  }

  function updateLine(index: number, field: string, value: string | number) {
    const newLines = [...lines];
    const line = { ...newLines[index] };
    if (field === "description") line.description = value as string;
    if (field === "quantity") {
      line.quantity = Number(value);
      line.amount = Math.round(line.quantity * line.unitPrice * 100) / 100;
    }
    if (field === "unitPrice") {
      line.unitPrice = Number(value);
      line.amount = Math.round(line.quantity * line.unitPrice * 100) / 100;
    }
    newLines[index] = line;
    setLines(newLines);
    const newSubtotal = Math.round(newLines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
    const newVat = Math.round(newSubtotal * 25 / 100 * 100) / 100;
    setSubtotal(newSubtotal);
    setVatAmount(newVat);
    setTotal(Math.round((newSubtotal + newVat) * 100) / 100);
  }

  async function handleSetDefaultPayment() {
    const days = parseInt(paymentDays);
    if (!days || days < 1) return;
    setSavingDefault(true);
    try {
      const res = await fetch("/api/billing/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultPaymentDays: days }),
      });
      if (res.ok) {
        setDefaultPaymentDays(days);
        toast.success(t("defaultPaymentSaved", { days: String(days) }));
      }
    } catch {
      toast.error(t("saveFailed"));
    } finally {
      setSavingDefault(false);
    }
  }

  async function handleCreate() {
    setLoading(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          periodStart,
          periodEnd,
          groupBy,
          includeExpenses,
          phaseId: phaseId || undefined,
          clientName,
          clientAddress: clientAddress || undefined,
          clientCvr: clientCvr || undefined,
          paymentTermsDays: parseInt(paymentDays) || 8,
          note: note || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to create invoice");
        return;
      }

      const data = await res.json();
      toast.success(t("invoiceCreated", { number: String(data.invoiceNumber) }));
      onOpenChange(false);
    } catch {
      toast.error("Failed to create invoice");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t("createInvoice")} — {projectName}
          </DialogTitle>
        </DialogHeader>

        {/* Step Indicators */}
        <div className="flex items-center gap-2 text-sm">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                step >= s ? "bg-brand-500 text-white" : "bg-muted text-muted-foreground"
              }`}>
                {s}
              </div>
              <span className={step >= s ? "text-foreground" : "text-muted-foreground"}>
                {s === 1 ? t("selectScope") : s === 2 ? t("reviewLines") : t("confirmCreate")}
              </span>
              {s < 3 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {/* Step 1: Scope */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>{t("periodStart")}</Label>
                <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
              </div>
              <div>
                <Label>{t("periodEnd")}</Label>
                <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>{t("groupBy")}</Label>
              <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">{t("groupByEmployee")}</SelectItem>
                  <SelectItem value="phase">{t("groupByPhase")}</SelectItem>
                  <SelectItem value="description">{t("groupByDescription")}</SelectItem>
                  <SelectItem value="flat">{t("groupByFlat")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {phases.length > 0 && (
              <div>
                <Label>{t("filterByPhase")}</Label>
                <Select value={phaseId || "all"} onValueChange={(v) => setPhaseId(v === "all" ? null : v)}>
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allPhases")}</SelectItem>
                    {phases.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="flex items-center gap-2">
                          {p.color && <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />}
                          {p.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <label className="flex items-center gap-3 cursor-pointer rounded-lg border p-3 hover:bg-muted/50 transition-colors">
              <input
                type="checkbox"
                checked={includeExpenses}
                onChange={(e) => setIncludeExpenses(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-brand-500"
              />
              <div>
                <span className="text-sm font-medium">{t("includeExpenses")}</span>
                <p className="text-xs text-muted-foreground">{t("includeExpensesHint")}</p>
              </div>
            </label>
          </div>
        )}

        {/* Step 2: Review Lines */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">{t("description")}</TableHead>
                    <TableHead className="text-right">{t("quantity")}</TableHead>
                    <TableHead className="text-right">{t("unitPrice")}</TableHead>
                    <TableHead className="text-right">{t("lineAmount")}</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Input
                          value={line.description}
                          onChange={(e) => updateLine(i, "description", e.target.value)}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          value={line.quantity}
                          onChange={(e) => updateLine(i, "quantity", e.target.value)}
                          className="h-8 w-20 text-right ml-auto"
                          step="1"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          value={line.unitPrice}
                          onChange={(e) => updateLine(i, "unitPrice", e.target.value)}
                          className="h-8 w-24 text-right ml-auto"
                          step="1"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {line.amount.toLocaleString("da-DK", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => removeLine(i)}>
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button variant="outline" size="sm" onClick={addManualLine}>
              <Plus className="mr-1 h-4 w-4" />
              {t("addLine")}
            </Button>

            <div className="border-t pt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("subtotal")}</span>
                <span>{subtotal.toLocaleString("da-DK", { minimumFractionDigits: 2 })} {currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("vat")}</span>
                <span>{vatAmount.toLocaleString("da-DK", { minimumFractionDigits: 2 })} {currency}</span>
              </div>
              <div className="flex justify-between font-bold text-base">
                <span>{t("total")}</span>
                <span>{total.toLocaleString("da-DK", { minimumFractionDigits: 2 })} {currency}</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>{t("client")}</Label>
                <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
              </div>
              <div>
                <Label>{t("clientCvr")}</Label>
                <Input value={clientCvr} onChange={(e) => setClientCvr(e.target.value)} placeholder="12345678" />
              </div>
              <div className="sm:col-span-2">
                <Label>{t("clientAddress")}</Label>
                <Input value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} />
              </div>
              <div>
                <Label>{t("paymentTerms")}</Label>
                <div className="flex gap-2">
                  <Input type="number" value={paymentDays} onChange={(e) => setPaymentDays(e.target.value)} min={1} className="flex-1" />
                  {parseInt(paymentDays) !== defaultPaymentDays && parseInt(paymentDays) > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSetDefaultPayment}
                      disabled={savingDefault}
                      className="whitespace-nowrap text-xs h-9"
                    >
                      <Star className="mr-1 h-3.5 w-3.5" />
                      {savingDefault ? t("saving") : t("setAsDefault")}
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <div>
              <Label>{t("invoiceNote")}</Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <div className="rounded-lg border p-4 bg-muted/50">
              <div className="flex justify-between text-sm">
                <span>{t("linesCount")}</span>
                <span className="font-medium">{lines.length}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span>{t("subtotal")}</span>
                <span>{subtotal.toLocaleString("da-DK", { minimumFractionDigits: 2 })} {currency}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span>{t("vat")}</span>
                <span>{vatAmount.toLocaleString("da-DK", { minimumFractionDigits: 2 })} {currency}</span>
              </div>
              <div className="flex justify-between font-bold mt-2 pt-2 border-t">
                <span>{t("total")}</span>
                <span>{total.toLocaleString("da-DK", { minimumFractionDigits: 2 })} {currency}</span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between">
          <div>
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("back")}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            {step === 1 && (
              <Button onClick={handlePreview} disabled={loading}>
                <Eye className="mr-2 h-4 w-4" />
                {loading ? t("loading") : t("preview")}
              </Button>
            )}
            {step === 2 && (
              <Button onClick={() => setStep(3)} disabled={lines.length === 0}>
                {t("next")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
            {step === 3 && (
              <Button onClick={handleCreate} disabled={loading || !clientName}>
                <FileText className="mr-2 h-4 w-4" />
                {loading ? t("creating") : t("confirm")}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
