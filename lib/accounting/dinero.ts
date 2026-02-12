import type { AccountingAdapter, AccountingCredentials, ExternalCustomer, InvoiceWithLines } from "./types";

export class DineroAdapter implements AccountingAdapter {
  private organizationId: string;
  private clientId: string;
  private clientSecret: string;

  constructor(credentials: AccountingCredentials) {
    if (!credentials.clientId || !credentials.clientSecret || !credentials.organizationId) {
      throw new Error("Dinero requires clientId, clientSecret, and organizationId");
    }
    this.organizationId = credentials.organizationId;
    this.clientId = credentials.clientId;
    this.clientSecret = credentials.clientSecret;
  }

  private async getAccessToken(): Promise<string> {
    // Dinero uses Visma Connect OAuth2
    const res = await fetch("https://connect.visma.com/connect/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.clientId,
        client_secret: this.clientSecret,
        scope: "dineropublicapi:read dineropublicapi:write",
      }),
    });
    if (!res.ok) throw new Error(`Dinero OAuth failed: ${res.status}`);
    const data = await res.json();
    return data.access_token;
  }

  private async headers() {
    const token = await this.getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      const hdrs = await this.headers();
      const res = await fetch(
        `https://api.dinero.dk/v1/${this.organizationId}/organizations`,
        { headers: hdrs }
      );
      if (res.ok) return { ok: true };
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.message || `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Connection failed" };
    }
  }

  async listCustomers(): Promise<ExternalCustomer[]> {
    const hdrs = await this.headers();
    const res = await fetch(
      `https://api.dinero.dk/v1/${this.organizationId}/contacts?page=0&pageSize=1000`,
      { headers: hdrs }
    );
    if (!res.ok) throw new Error(`Failed to fetch contacts: ${res.status}`);
    const data = await res.json();
    return (data.collection || []).map((c: Record<string, unknown>) => ({
      id: String(c.contactGuid || c.id),
      name: String(c.name || ""),
      cvr: c.vatNumber ? String(c.vatNumber) : undefined,
      email: c.email ? String(c.email) : undefined,
    }));
  }

  async createInvoiceDraft(invoice: InvoiceWithLines, customerRef: string): Promise<{
    externalId: string;
    externalNumber?: string;
  }> {
    const hdrs = await this.headers();
    const body = {
      contactGuid: customerRef,
      date: invoice.invoiceDate.toISOString().split("T")[0],
      currency: invoice.currency,
      description: invoice.note || "",
      paymentConditionType: "nettoDays",
      paymentConditionNumberOfDays: invoice.paymentTermsDays,
      productLines: invoice.lines.map((line) => ({
        description: line.description,
        quantity: line.quantity,
        accountNumber: 1000, // Default revenue account
        unit: line.type === "time" ? "hours" : "pieces",
        totalExclVat: line.amount,
      })),
    };

    const res = await fetch(
      `https://api.dinero.dk/v1/${this.organizationId}/invoices`,
      {
        method: "POST",
        headers: hdrs,
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Dinero error: ${err.message || res.status}`);
    }

    const data = await res.json();
    return {
      externalId: String(data.guid || data.id),
      externalNumber: data.number ? String(data.number) : undefined,
    };
  }
}
