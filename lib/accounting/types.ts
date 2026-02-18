export interface AccountingAdapter {
  testConnection(): Promise<{ ok: boolean; error?: string }>;
  listCustomers(): Promise<ExternalCustomer[]>;
  createInvoiceDraft(invoice: InvoiceWithLines, customerRef: string): Promise<{
    externalId: string;
    externalNumber?: string;
  }>;
  getInvoiceStatus?(externalId: string): Promise<{ status: string }>;

  // Sync capabilities
  supportsTimeEntryPush(): boolean;
  supportsExpensePush(): boolean;

  // External data for mappings
  listProjects(): Promise<ExternalProject[]>;
  listEmployees(): Promise<ExternalEmployee[]>;
  listAccounts(): Promise<ExternalAccount[]>;

  // Sync operations
  pushTimeEntry(payload: TimeEntryPushPayload): Promise<SyncResult>;
  pushExpense(payload: ExpensePushPayload): Promise<SyncResult>;
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

// External entity types for mapping dropdowns
export interface ExternalProject {
  id: string;
  name: string;
  number?: string;
}

export interface ExternalEmployee {
  id: string;
  name: string;
  number?: string;
}

export interface ExternalAccount {
  id: string;
  name: string;
  number?: string;
}

// Sync payloads
export interface TimeEntryPushPayload {
  entryId: string;
  date: string; // YYYY-MM-DD
  hours: number;
  employeeExternalId: string;
  projectExternalId: string;
  description: string;
}

export interface ExpensePushPayload {
  expenseId: string;
  date: string; // YYYY-MM-DD
  amount: number;
  description: string;
  categoryAccountId: string;
  receiptUrl?: string;
  receiptFileName?: string;
}

export interface SyncResult {
  success: boolean;
  externalId?: string;
  error?: string;
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
