import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, isAdminOrManager } from "@/lib/auth";
import { getAccountingAdapter } from "@/lib/accounting/adapter";
import { decrypt } from "@/lib/accounting/encryption";
import type { AccountingCredentials, InvoiceWithLines } from "@/lib/accounting/types";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminOrManager(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const invoice = await db.invoice.findFirst({
      where: { id: params.id, companyId: user.companyId },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    });
    if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Idempotent: if already synced, don't duplicate
    if (invoice.externalId) {
      return NextResponse.json({
        error: "Invoice already synced",
        externalId: invoice.externalId,
        externalSystem: invoice.externalSystem,
      }, { status: 409 });
    }

    const company = await db.company.findUnique({
      where: { id: user.companyId },
      select: { accountingSystem: true, accountingCredentials: true },
    });

    if (!company?.accountingSystem || !company.accountingCredentials) {
      return NextResponse.json({ error: "No accounting system connected" }, { status: 400 });
    }

    // Decrypt credentials
    const credentials: AccountingCredentials = JSON.parse(decrypt(company.accountingCredentials));
    const adapter = getAccountingAdapter(credentials);

    // Find customer mapping for this invoice's client
    const mapping = await db.customerMapping.findFirst({
      where: { companyId: user.companyId, clientName: invoice.clientName },
    });
    if (!mapping) {
      return NextResponse.json({
        error: "No customer mapping found. Map this client to an accounting system customer first.",
      }, { status: 400 });
    }

    // Build invoice data for the adapter
    const invoiceData: InvoiceWithLines = {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: new Date(invoice.invoiceDate),
      dueDate: new Date(invoice.dueDate),
      currency: invoice.currency,
      paymentTermsDays: invoice.paymentTermsDays,
      clientName: invoice.clientName,
      clientCvr: invoice.clientCvr,
      note: invoice.note,
      subtotal: invoice.subtotal,
      vatRate: invoice.vatRate,
      vatAmount: invoice.vatAmount,
      total: invoice.total,
      lines: invoice.lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        amount: l.amount,
        type: l.type,
      })),
    };

    const result = await adapter.createInvoiceDraft(invoiceData, mapping.externalCustomerId);

    // Update invoice with external reference
    await db.invoice.update({
      where: { id: invoice.id },
      data: {
        externalId: result.externalId,
        externalSystem: company.accountingSystem,
        syncedAt: new Date(),
      },
    });

    await db.auditLog.create({
      data: {
        companyId: user.companyId,
        entityType: "Invoice",
        entityId: invoice.id,
        action: "INVOICE_SYNC",
        actorId: user.id,
        metadata: JSON.stringify({
          externalId: result.externalId,
          externalSystem: company.accountingSystem,
        }),
      },
    });

    return NextResponse.json({
      externalId: result.externalId,
      externalNumber: result.externalNumber,
      system: company.accountingSystem,
    });
  } catch (error) {
    console.error("[INVOICE_SYNC]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
