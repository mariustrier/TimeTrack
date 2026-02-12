import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, isAdminOrManager } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { updateInvoiceSchema } from "@/lib/schemas";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminOrManager(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const invoice = await db.invoice.findFirst({
      where: { id: params.id, companyId: user.companyId },
      include: {
        project: { select: { id: true, name: true, color: true, client: true } },
        lines: { orderBy: { sortOrder: "asc" } },
        company: {
          select: {
            name: true, companyAddress: true, companyCvr: true,
            companyBankAccount: true, companyBankReg: true, invoicePrefix: true,
          },
        },
      },
    });

    if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(invoice);
  } catch (error) {
    console.error("[INVOICE_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminOrManager(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const invoice = await db.invoice.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });
    if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const result = validate(updateInvoiceSchema, body);
    if (!result.success) return result.response;

    const { lines, status, ...fields } = result.data;

    // Only allow editing draft invoices (except status changes)
    if (invoice.status !== "draft" && !status) {
      return NextResponse.json({ error: "Can only edit draft invoices" }, { status: 400 });
    }

    // Status change: void clears invoiced marks
    if (status === "void" && invoice.status !== "void") {
      await db.$transaction(async (tx) => {
        await tx.timeEntry.updateMany({
          where: { invoiceId: invoice.id },
          data: { invoiceId: null, invoicedAt: null },
        });
        await tx.expense.updateMany({
          where: { invoiceId: invoice.id },
          data: { invoiceId: null, invoicedAt: null },
        });
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: "void" },
        });
        await tx.auditLog.create({
          data: {
            companyId: user.companyId,
            entityType: "Invoice",
            entityId: invoice.id,
            action: "INVOICE_VOID",
            actorId: user.id,
            fromStatus: invoice.status,
            toStatus: "void",
          },
        });
      });
      return NextResponse.json({ success: true });
    }

    // Update lines if provided
    if (lines && invoice.status === "draft") {
      await db.invoiceLine.deleteMany({ where: { invoiceId: invoice.id } });
      const subtotal = Math.round(lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0) * 100) / 100;
      const vatAmount = Math.round(subtotal * invoice.vatRate / 100 * 100) / 100;
      await db.invoice.update({
        where: { id: invoice.id },
        data: {
          ...fields,
          subtotal,
          vatAmount,
          total: Math.round((subtotal + vatAmount) * 100) / 100,
          lines: {
            create: lines.map((l, i) => ({
              sortOrder: i,
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              amount: Math.round(l.quantity * l.unitPrice * 100) / 100,
              type: l.type || "manual",
              timeEntryIds: [],
              expenseIds: [],
              phaseName: l.phaseName || null,
            })),
          },
        },
      });
    } else {
      const updateData: Record<string, unknown> = { ...fields };
      if (status) {
        updateData.status = status;
        if (status !== invoice.status) {
          await db.auditLog.create({
            data: {
              companyId: user.companyId,
              entityType: "Invoice",
              entityId: invoice.id,
              action: "INVOICE_STATUS",
              actorId: user.id,
              fromStatus: invoice.status,
              toStatus: status,
            },
          });
        }
      }
      await db.invoice.update({ where: { id: invoice.id }, data: updateData });
    }

    const updated = await db.invoice.findUnique({
      where: { id: invoice.id },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[INVOICE_PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminOrManager(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const invoice = await db.invoice.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });
    if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (invoice.status !== "draft") {
      return NextResponse.json({ error: "Can only delete draft invoices" }, { status: 400 });
    }

    await db.$transaction(async (tx) => {
      // Clear invoiced marks on time entries and expenses
      await tx.timeEntry.updateMany({
        where: { invoiceId: invoice.id },
        data: { invoiceId: null, invoicedAt: null },
      });
      await tx.expense.updateMany({
        where: { invoiceId: invoice.id },
        data: { invoiceId: null, invoicedAt: null },
      });
      await tx.invoice.delete({ where: { id: invoice.id } });
      await tx.auditLog.create({
        data: {
          companyId: user.companyId,
          entityType: "Invoice",
          entityId: invoice.id,
          action: "INVOICE_DELETE",
          actorId: user.id,
          metadata: JSON.stringify({ invoiceNumber: invoice.invoiceNumber }),
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[INVOICE_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
