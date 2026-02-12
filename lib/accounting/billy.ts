import type { AccountingAdapter, AccountingCredentials, ExternalCustomer, InvoiceWithLines } from "./types";

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
}
