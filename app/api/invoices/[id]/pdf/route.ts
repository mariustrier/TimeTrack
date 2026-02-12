import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, isAdminOrManager } from "@/lib/auth";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import { format } from "date-fns";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminOrManager(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const invoice = await db.invoice.findFirst({
      where: { id: params.id, companyId: user.companyId },
      include: {
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

    const prefix = invoice.company.invoicePrefix || "";
    const pdfBytes = await generateInvoicePdf({
      companyName: invoice.company.name,
      companyAddress: invoice.company.companyAddress,
      companyCvr: invoice.company.companyCvr,
      companyBankAccount: invoice.company.companyBankAccount,
      companyBankReg: invoice.company.companyBankReg,
      invoiceNumber: `${prefix}${invoice.invoiceNumber}`,
      invoiceDate: format(new Date(invoice.invoiceDate), "dd-MM-yyyy"),
      dueDate: format(new Date(invoice.dueDate), "dd-MM-yyyy"),
      paymentTermsDays: invoice.paymentTermsDays,
      currency: invoice.currency,
      note: invoice.note,
      clientName: invoice.clientName,
      clientAddress: invoice.clientAddress,
      clientCvr: invoice.clientCvr,
      clientEan: invoice.clientEan,
      lines: invoice.lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        amount: l.amount,
      })),
      subtotal: invoice.subtotal,
      vatRate: invoice.vatRate,
      vatAmount: invoice.vatAmount,
      total: invoice.total,
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="invoice-${prefix}${invoice.invoiceNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error("[INVOICE_PDF]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
