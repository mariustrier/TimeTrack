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

const BASE_URL = "https://restapi.e-conomic.com";

export class EconomicAdapter implements AccountingAdapter {
  private appSecretToken: string;
  private agreementGrantToken: string;

  constructor(credentials: AccountingCredentials) {
    if (!credentials.appSecretToken || !credentials.agreementGrantToken) {
      throw new Error("e-conomic requires appSecretToken and agreementGrantToken");
    }
    this.appSecretToken = credentials.appSecretToken;
    this.agreementGrantToken = credentials.agreementGrantToken;
  }

  private headers() {
    return {
      "X-AppSecretToken": this.appSecretToken,
      "X-AgreementGrantToken": this.agreementGrantToken,
      "Content-Type": "application/json",
    };
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/self`, { headers: this.headers() });
      if (res.ok) return { ok: true };
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.message || `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Connection failed" };
    }
  }

  async listCustomers(): Promise<ExternalCustomer[]> {
    const res = await fetch(`${BASE_URL}/customers?pagesize=1000`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Failed to fetch customers: ${res.status}`);
    const data = await res.json();
    return (data.collection || []).map((c: Record<string, unknown>) => ({
      id: String(c.customerNumber),
      name: String(c.name || ""),
      cvr: c.corporateIdentificationNumber ? String(c.corporateIdentificationNumber) : undefined,
      email: c.email ? String(c.email) : undefined,
    }));
  }

  async createInvoiceDraft(invoice: InvoiceWithLines, customerRef: string): Promise<{
    externalId: string;
    externalNumber?: string;
  }> {
    const body = {
      date: invoice.invoiceDate.toISOString().split("T")[0],
      currency: invoice.currency,
      customer: {
        customerNumber: parseInt(customerRef, 10),
      },
      paymentTerms: {
        paymentTermsNumber: 1, // Default payment terms in e-conomic
      },
      layout: {
        layoutNumber: 1, // Default layout
      },
      notes: {
        heading: `Invoice #${invoice.invoiceNumber}`,
        textLine1: invoice.note || "",
      },
      lines: invoice.lines.map((line) => ({
        description: line.description,
        quantity: line.quantity,
        unitNetPrice: line.unitPrice,
      })),
    };

    const res = await fetch(`${BASE_URL}/invoices/drafts`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`e-conomic error: ${err.message || res.status}`);
    }

    const data = await res.json();
    return {
      externalId: String(data.draftInvoiceNumber),
      externalNumber: String(data.draftInvoiceNumber),
    };
  }

  // ─── SYNC CAPABILITIES ───

  supportsTimeEntryPush(): boolean {
    // Stubbed until e-conomic Projects API v2 endpoints are discovered
    return false;
  }

  supportsExpensePush(): boolean {
    return false;
  }

  async listProjects(): Promise<ExternalProject[]> {
    // TODO: Implement once Projects API v2 endpoints are confirmed
    // Try: GET https://apis.e-conomic.com/projectsapi/v2.0.0/projects
    return [];
  }

  async listEmployees(): Promise<ExternalEmployee[]> {
    const res = await fetch(`${BASE_URL}/employees?pagesize=1000`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Failed to fetch employees: ${res.status}`);
    const data = await res.json();
    return (data.collection || []).map((e: Record<string, unknown>) => ({
      id: String(e.employeeNumber),
      name: String(e.name || ""),
      number: String(e.employeeNumber),
    }));
  }

  async listAccounts(): Promise<ExternalAccount[]> {
    throw new Error("e-conomic: account listing not supported for expense sync");
  }

  async pushTimeEntry(_payload: TimeEntryPushPayload): Promise<SyncResult> {
    // TODO: Implement once Projects API v2 time entry endpoint is confirmed
    return { success: false, error: "e-conomic time entry push not yet implemented — waiting for Projects API v2 discovery" };
  }

  async pushExpense(_payload: ExpensePushPayload): Promise<SyncResult> {
    return { success: false, error: "e-conomic does not support expense/voucher push" };
  }
}
