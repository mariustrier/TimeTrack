import type {
  AccountingAdapter,
  AccountingCredentials,
  ExternalCustomer,
  ExternalProject,
  ExternalEmployee,
  ExternalAccount,
  InvoiceWithLines,
  TimeEntryPushPayload,
  ExpensePushPayload,
  SyncResult,
} from "./types";

const BASE_URL = "https://api.billysbilling.com/v2";

export class BillyAdapter implements AccountingAdapter {
  private accessToken: string;
  private organizationId: string;

  constructor(credentials: AccountingCredentials) {
    if (!credentials.accessToken || !credentials.organizationId) {
      throw new Error("Billy requires accessToken and organizationId");
    }
    this.accessToken = credentials.accessToken;
    this.organizationId = credentials.organizationId;
  }

  private headers() {
    return {
      "X-Access-Token": this.accessToken,
      "Content-Type": "application/json",
    };
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/organization`, { headers: this.headers() });
      if (res.ok) return { ok: true };
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.errorMessage || `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Connection failed" };
    }
  }

  async listCustomers(): Promise<ExternalCustomer[]> {
    const res = await fetch(
      `${BASE_URL}/contacts?organizationId=${this.organizationId}&isCustomer=true`,
      { headers: this.headers() }
    );
    if (!res.ok) throw new Error(`Failed to fetch contacts: ${res.status}`);
    const data = await res.json();
    return (data.contacts || []).map((c: Record<string, unknown>) => ({
      id: String(c.id),
      name: String(c.name || ""),
      cvr: c.registrationNo ? String(c.registrationNo) : undefined,
      email: c.email ? String(c.email) : undefined,
    }));
  }

  async createInvoiceDraft(invoice: InvoiceWithLines, customerRef: string): Promise<{
    externalId: string;
    externalNumber?: string;
  }> {
    const body = {
      invoice: {
        organizationId: this.organizationId,
        contactId: customerRef,
        entryDate: invoice.invoiceDate.toISOString().split("T")[0],
        paymentTermsDays: invoice.paymentTermsDays,
        currencyId: invoice.currency,
        lines: invoice.lines.map((line) => ({
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
        })),
      },
    };

    const res = await fetch(`${BASE_URL}/invoices`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Billy error: ${err.errorMessage || res.status}`);
    }

    const data = await res.json();
    return {
      externalId: String(data.invoices?.[0]?.id || data.id),
      externalNumber: data.invoices?.[0]?.invoiceNo ? String(data.invoices[0].invoiceNo) : undefined,
    };
  }

  // ─── SYNC CAPABILITIES ───

  supportsTimeEntryPush(): boolean {
    return false;
  }

  supportsExpensePush(): boolean {
    return true;
  }

  async listProjects(): Promise<ExternalProject[]> {
    return [];
  }

  async listEmployees(): Promise<ExternalEmployee[]> {
    return [];
  }

  async listAccounts(): Promise<ExternalAccount[]> {
    const res = await fetch(
      `${BASE_URL}/accounts?organizationId=${this.organizationId}`,
      { headers: this.headers() }
    );
    if (!res.ok) throw new Error(`Failed to fetch accounts: ${res.status}`);
    const data = await res.json();
    return (data.accounts || []).map((a: Record<string, unknown>) => ({
      id: String(a.id),
      name: String(a.name || ""),
      number: a.accountNo ? String(a.accountNo) : undefined,
    }));
  }

  async pushTimeEntry(_payload: TimeEntryPushPayload): Promise<SyncResult> {
    return { success: false, error: "Billy does not support time entry push" };
  }

  async pushExpense(payload: ExpensePushPayload): Promise<SyncResult> {
    try {
      // Step 1: Upload receipt if available
      let fileId: string | undefined;
      if (payload.receiptUrl) {
        const receiptRes = await fetch(payload.receiptUrl);
        if (!receiptRes.ok) throw new Error("Failed to download receipt");
        const receiptBuffer = await receiptRes.arrayBuffer();

        const uploadRes = await fetch(`${BASE_URL}/files`, {
          method: "POST",
          headers: {
            "X-Access-Token": this.accessToken,
            "Content-Type": "application/octet-stream",
            "X-Filename": payload.receiptFileName || "receipt.pdf",
          },
          body: receiptBuffer,
        });
        if (!uploadRes.ok) throw new Error(`Receipt upload failed: ${uploadRes.status}`);
        const uploadData = await uploadRes.json();
        fileId = uploadData.files?.[0]?.id || uploadData.id;
      }

      // Step 2: Create bill with lines + optional attachment
      const billBody: Record<string, unknown> = {
        bill: {
          organizationId: this.organizationId,
          entryDate: payload.date,
          state: "approved",
          lines: [
            {
              accountId: payload.categoryAccountId,
              amount: payload.amount,
              description: payload.description,
            },
          ],
          ...(fileId ? { attachmentIds: [fileId] } : {}),
        },
      };

      const billRes = await fetch(`${BASE_URL}/bills`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(billBody),
      });
      if (!billRes.ok) {
        const err = await billRes.json().catch(() => ({}));
        throw new Error(`Bill creation failed: ${(err as Record<string, string>).errorMessage || billRes.status}`);
      }
      const billData = await billRes.json();
      const billId = billData.bills?.[0]?.id || billData.id;

      return { success: true, externalId: billId };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Billy expense push failed",
      };
    }
  }
}
