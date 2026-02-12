export interface AccountingAdapter {
  testConnection(): Promise<{ ok: boolean; error?: string }>;
  listCustomers(): Promise<ExternalCustomer[]>;
  createInvoiceDraft(invoice: InvoiceWithLines, customerRef: string): Promise<{
    externalId: string;
    externalNumber?: string;
  }>;
  getInvoiceStatus?(externalId: string): Promise<{ status: string }>;
}

export interface ExternalCustomer {
  id: string;
  name: string;
  cvr?: string;
  email?: string;
}

export interface InvoiceWithLines {
  invoiceNumber: number;
  invoiceDate: Date;
  dueDate: Date;
  currency: string;
  paymentTermsDays: number;
  clientName: string;
  clientCvr?: string | null;
  note?: string | null;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  lines: {
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    type: string;
  }[];
}

export interface AccountingCredentials {
  system: "e-conomic" | "billy" | "dinero";
  // e-conomic
  appSecretToken?: string;
  agreementGrantToken?: string;
  // Billy
  accessToken?: string;
  organizationId?: string;
  // Dinero (legacy: clientId+clientSecret, OAuth: accessToken+refreshToken)
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  tokenExpiresAt?: string; // ISO date string
}
