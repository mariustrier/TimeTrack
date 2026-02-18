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

type CredentialUpdateCallback = (credentials: AccountingCredentials) => Promise<void>;

export class DineroAdapter implements AccountingAdapter {
  private organizationId: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken?: string;
  private refreshToken?: string;
  private tokenExpiresAt?: Date;
  private onCredentialUpdate?: CredentialUpdateCallback;

  constructor(credentials: AccountingCredentials, onCredentialUpdate?: CredentialUpdateCallback) {
    if (!credentials.organizationId) {
      throw new Error("Dinero requires organizationId");
    }
    this.organizationId = credentials.organizationId;
    this.clientId = credentials.clientId || "";
    this.clientSecret = credentials.clientSecret || "";
    this.accessToken = credentials.accessToken;
    this.refreshToken = credentials.refreshToken;
    this.tokenExpiresAt = credentials.tokenExpiresAt ? new Date(credentials.tokenExpiresAt) : undefined;
    this.onCredentialUpdate = onCredentialUpdate;

    // Must have either OAuth tokens or client credentials
    if (!this.accessToken && (!this.clientId || !this.clientSecret)) {
      throw new Error("Dinero requires either OAuth tokens or clientId + clientSecret");
    }
  }

  private async getAccessToken(): Promise<string> {
    // If we have an OAuth access token, check if it needs refreshing
    if (this.accessToken && this.refreshToken) {
      const bufferMs = 5 * 60 * 1000; // 5 minute buffer
      const isExpired = this.tokenExpiresAt && this.tokenExpiresAt.getTime() - bufferMs < Date.now();

      if (!isExpired) {
        return this.accessToken;
      }

      // Refresh the token
      return this.refreshAccessToken();
    }

    // If we have an OAuth access token without refresh (shouldn't happen, but handle it)
    if (this.accessToken) {
      return this.accessToken;
    }

    // Fall back to client_credentials flow (legacy)
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

  private async refreshAccessToken(): Promise<string> {
    if (!this.refreshToken || !this.clientId || !this.clientSecret) {
      throw new Error("Cannot refresh: missing refreshToken or client credentials");
    }

    const res = await fetch("https://connect.visma.com/connect/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!res.ok) {
      throw new Error(`Dinero token refresh failed: ${res.status}`);
    }

    const data = await res.json();
    this.accessToken = data.access_token;
    if (data.refresh_token) {
      this.refreshToken = data.refresh_token;
    }
    const expiresIn = data.expires_in || 3600;
    this.tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    // Persist the refreshed tokens
    if (this.onCredentialUpdate) {
      await this.onCredentialUpdate({
        system: "dinero",
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        tokenExpiresAt: this.tokenExpiresAt.toISOString(),
        organizationId: this.organizationId,
        clientId: this.clientId,
        clientSecret: this.clientSecret,
      });
    }

    return this.accessToken!;
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
    const hdrs = await this.headers();
    const res = await fetch(
      `https://api.dinero.dk/v1/${this.organizationId}/accounts/entry`,
      { headers: hdrs }
    );
    if (!res.ok) throw new Error(`Failed to fetch accounts: ${res.status}`);
    const data = await res.json();
    return (data || []).map((a: Record<string, unknown>) => ({
      id: String(a.accountNumber),
      name: String(a.name || ""),
      number: String(a.accountNumber),
    }));
  }

  async pushTimeEntry(_payload: TimeEntryPushPayload): Promise<SyncResult> {
    return { success: false, error: "Dinero does not support time entry push" };
  }

  async pushExpense(payload: ExpensePushPayload): Promise<SyncResult> {
    try {
      const hdrs = await this.headers();

      // Step 1: Upload receipt if available
      let fileGuid: string | undefined;
      if (payload.receiptUrl) {
        const receiptRes = await fetch(payload.receiptUrl);
        if (!receiptRes.ok) throw new Error("Failed to download receipt");
        const receiptBuffer = await receiptRes.arrayBuffer();

        const uploadRes = await fetch(
          `https://api.dinero.dk/v1/${this.organizationId}/files`,
          {
            method: "POST",
            headers: {
              ...hdrs,
              "Content-Type": "application/octet-stream",
              "X-Filename": payload.receiptFileName || "receipt.pdf",
            },
            body: receiptBuffer,
          }
        );
        if (!uploadRes.ok) throw new Error(`Receipt upload failed: ${uploadRes.status}`);
        const uploadData = await uploadRes.json();
        fileGuid = uploadData.fileGuid || uploadData.guid;
      }

      // Step 2: Create manual voucher
      const voucherBody = {
        voucherDate: payload.date,
        description: payload.description,
        lines: [
          {
            accountNumber: parseInt(payload.categoryAccountId, 10),
            amount: payload.amount,
            description: payload.description,
          },
        ],
      };

      const voucherRes = await fetch(
        `https://api.dinero.dk/v1/${this.organizationId}/vouchers/manuel`,
        {
          method: "POST",
          headers: hdrs,
          body: JSON.stringify(voucherBody),
        }
      );
      if (!voucherRes.ok) {
        const err = await voucherRes.json().catch(() => ({}));
        throw new Error(`Voucher creation failed: ${(err as Record<string, string>).message || voucherRes.status}`);
      }
      const voucherData = await voucherRes.json();
      const docGuid = voucherData.guid || voucherData.voucherGuid;

      // Step 3: Bind receipt to voucher
      if (fileGuid && docGuid) {
        const fileName = payload.receiptFileName || "receipt.pdf";
        await fetch(
          `https://api.dinero.dk/v1/${this.organizationId}/attachments/${docGuid}/${fileGuid}/${encodeURIComponent(fileName)}`,
          {
            method: "POST",
            headers: hdrs,
          }
        );
      }

      return { success: true, externalId: docGuid };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Dinero expense push failed",
      };
    }
  }
}
