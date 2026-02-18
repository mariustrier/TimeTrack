import { db } from "@/lib/db";
import { getAccountingAdapter } from "./adapter";
import { decrypt } from "./encryption";
import type { AccountingCredentials, TimeEntryPushPayload, ExpensePushPayload } from "./types";

export interface SyncSummary {
  synced: number;
  errors: { id: string; error: string }[];
  skipped: number;
}

/**
 * Get the accounting adapter for a company, decrypting credentials.
 */
async function getCompanyAdapter(companyId: string) {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      accountingSystem: true,
      accountingCredentials: true,
    },
  });

  if (!company?.accountingSystem || !company.accountingCredentials) {
    throw new Error("No accounting system connected");
  }

  const credentials: AccountingCredentials = JSON.parse(decrypt(company.accountingCredentials));
  return { adapter: getAccountingAdapter(credentials), system: company.accountingSystem };
}

/**
 * Push approved time entries to the connected accounting system.
 */
export async function pushApprovedTimeEntries(
  companyId: string,
  triggeredBy: string,
  entryIds?: string[]
): Promise<SyncSummary> {
  const { adapter, system } = await getCompanyAdapter(companyId);

  if (!adapter.supportsTimeEntryPush()) {
    throw new Error(`${system} does not support time entry push`);
  }

  // Load mappings
  const projectMappings = await db.projectMapping.findMany({
    where: { companyId },
  });
  const employeeMappings = await db.employeeMapping.findMany({
    where: { companyId },
  });

  const projectMap: Record<string, string> = {};
  projectMappings.forEach((m) => { projectMap[m.projectId] = m.externalProjectId; });
  const employeeMap: Record<string, string> = {};
  employeeMappings.forEach((m) => { employeeMap[m.userId] = m.externalEmployeeId; });

  // Query approved entries not yet synced
  const where: Record<string, unknown> = {
    companyId,
    approvalStatus: "approved",
    accountingSyncedAt: null,
  };
  if (entryIds && entryIds.length > 0) {
    where.id = { in: entryIds };
  }

  const entries = await db.timeEntry.findMany({
    where,
    include: {
      user: { select: { firstName: true, lastName: true } },
      project: { select: { name: true } },
    },
    orderBy: { date: "asc" },
  });

  const summary: SyncSummary = { synced: 0, errors: [], skipped: 0 };

  for (const entry of entries) {
    const extProject = projectMap[entry.projectId];
    const extEmployee = employeeMap[entry.userId];

    if (!extProject || !extEmployee) {
      summary.skipped++;
      continue;
    }

    const payload: TimeEntryPushPayload = {
      entryId: entry.id,
      date: entry.date.toISOString().split("T")[0],
      hours: entry.hours,
      employeeExternalId: extEmployee,
      projectExternalId: extProject,
      description: entry.comment || `${entry.user.firstName || ""} ${entry.user.lastName || ""} — ${entry.project.name}`.trim(),
    };

    const result = await adapter.pushTimeEntry(payload);
    if (result.success) {
      await db.timeEntry.update({
        where: { id: entry.id },
        data: {
          accountingSyncedAt: new Date(),
          accountingSyncId: result.externalId || null,
        },
      });
      summary.synced++;
    } else {
      summary.errors.push({ id: entry.id, error: result.error || "Unknown error" });
    }
  }

  // Create sync log
  await db.syncLog.create({
    data: {
      companyId,
      syncType: "time_entries",
      direction: "push",
      system,
      status: summary.errors.length === 0 ? "success" : summary.synced > 0 ? "partial" : "error",
      itemCount: summary.synced,
      errorCount: summary.errors.length,
      errors: summary.errors.length > 0 ? JSON.stringify(summary.errors) : null,
      triggeredBy,
      completedAt: new Date(),
    },
  });

  return summary;
}

/**
 * Push approved expenses to the connected accounting system.
 */
export async function pushApprovedExpenses(
  companyId: string,
  triggeredBy: string,
  expenseIds?: string[]
): Promise<SyncSummary> {
  const { adapter, system } = await getCompanyAdapter(companyId);

  if (!adapter.supportsExpensePush()) {
    throw new Error(`${system} does not support expense push`);
  }

  // Load category mappings
  const categoryMappings = await db.expenseCategoryMapping.findMany({
    where: { companyId },
  });
  const categoryMap: Record<string, string> = {};
  categoryMappings.forEach((m) => { categoryMap[m.category] = m.externalAccountId; });

  // Query approved expenses not yet synced
  const where: Record<string, unknown> = {
    companyId,
    approvalStatus: "approved",
    accountingSyncedAt: null,
    isDeleted: false,
  };
  if (expenseIds && expenseIds.length > 0) {
    where.id = { in: expenseIds };
  }

  const expenses = await db.expense.findMany({
    where,
    orderBy: { date: "asc" },
  });

  const summary: SyncSummary = { synced: 0, errors: [], skipped: 0 };

  for (const expense of expenses) {
    const extAccount = categoryMap[expense.category];
    if (!extAccount) {
      summary.skipped++;
      continue;
    }

    const payload: ExpensePushPayload = {
      expenseId: expense.id,
      date: expense.date.toISOString().split("T")[0],
      amount: expense.amount,
      description: expense.description,
      categoryAccountId: extAccount,
      receiptUrl: expense.receiptUrl || undefined,
      receiptFileName: expense.receiptFileName || undefined,
    };

    const result = await adapter.pushExpense(payload);
    if (result.success) {
      await db.expense.update({
        where: { id: expense.id },
        data: {
          accountingSyncedAt: new Date(),
          accountingSyncId: result.externalId || null,
        },
      });
      summary.synced++;
    } else {
      summary.errors.push({ id: expense.id, error: result.error || "Unknown error" });
    }
  }

  // Create sync log
  await db.syncLog.create({
    data: {
      companyId,
      syncType: "expenses",
      direction: "push",
      system,
      status: summary.errors.length === 0 ? "success" : summary.synced > 0 ? "partial" : "error",
      itemCount: summary.synced,
      errorCount: summary.errors.length,
      errors: summary.errors.length > 0 ? JSON.stringify(summary.errors) : null,
      triggeredBy,
      completedAt: new Date(),
    },
  });

  return summary;
}
