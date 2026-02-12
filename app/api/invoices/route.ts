import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, isAdminOrManager } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { createInvoiceSchema } from "@/lib/schemas";

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminOrManager(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const projectId = searchParams.get("projectId");

    const where: Record<string, unknown> = { companyId: user.companyId };
    if (status) where.status = status;
    if (projectId) where.projectId = projectId;

    const invoices = await db.invoice.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, color: true, client: true } },
        lines: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(invoices);
  } catch (error) {
    console.error("[INVOICES_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminOrManager(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const result = validate(createInvoiceSchema, body);
    if (!result.success) return result.response;

    const {
      projectId, periodStart, periodEnd, clientName, clientAddress, clientCvr, clientEan,
      paymentTermsDays, note, groupBy, includeExpenses, phaseId, timeEntryIds, expenseIds,
    } = result.data;

    // Validate project
    const project = await db.project.findFirst({
      where: { id: projectId, companyId: user.companyId },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const company = await db.company.findUnique({ where: { id: user.companyId } });
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    // Fetch approved, billable, un-invoiced time entries
    const timeWhere: Record<string, unknown> = {
      projectId,
      companyId: user.companyId,
      approvalStatus: "approved",
      billingStatus: "billable",
      invoiceId: null,
      date: { gte: new Date(periodStart), lte: new Date(periodEnd) },
    };
    if (phaseId) {
      timeWhere.phaseId = phaseId;
    }
    if (timeEntryIds && timeEntryIds.length > 0) {
      timeWhere.id = { in: timeEntryIds };
    }

    const entries = await db.timeEntry.findMany({
      where: timeWhere,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, hourlyRate: true } },
        phase: { select: { name: true } },
      },
    });

    // Fetch approved, un-invoiced expenses
    let expenses: Array<{ id: string; description: string; amount: number; category: string }> = [];
    if (includeExpenses) {
      const expWhere: Record<string, unknown> = {
        projectId,
        companyId: user.companyId,
        approvalStatus: "approved",
        invoiceId: null,
        isDeleted: { not: true },
        date: { gte: new Date(periodStart), lte: new Date(periodEnd) },
      };
      if (expenseIds && expenseIds.length > 0) {
        expWhere.id = { in: expenseIds };
      }
      expenses = await db.expense.findMany({ where: expWhere });
    }

    // Determine bill rate for an entry
    const getBillRate = (entry: typeof entries[number]): number => {
      if (project.rateMode === "EMPLOYEE_RATES" && entry.user.hourlyRate) {
        return entry.user.hourlyRate;
      }
      if (project.rateMode === "PROJECT_RATE" && project.projectRate) {
        return project.projectRate;
      }
      return company.defaultHourlyRate || 0;
    }

    // Group entries into invoice lines
    type LineData = { description: string; quantity: number; unitPrice: number; amount: number; type: string; timeEntryIds: string[]; expenseIds: string[]; phaseName: string | null };
    const lines: LineData[] = [];

    if (groupBy === "employee") {
      const byEmployee: Record<string, typeof entries> = {};
      for (const e of entries) {
        const key = e.userId;
        if (!byEmployee[key]) byEmployee[key] = [];
        byEmployee[key].push(e);
      }
      Object.values(byEmployee).forEach((empEntries) => {
        const emp = empEntries[0].user;
        const name = [emp.firstName, emp.lastName].filter(Boolean).join(" ") || "Unknown";
        const totalHours = empEntries.reduce((s, e) => s + e.hours, 0);
        const rate = getBillRate(empEntries[0]);
        lines.push({
          description: name,
          quantity: Math.round(totalHours * 100) / 100,
          unitPrice: rate,
          amount: Math.round(totalHours * rate * 100) / 100,
          type: "time",
          timeEntryIds: empEntries.map((e) => e.id),
          expenseIds: [],
          phaseName: null,
        });
      });
    } else if (groupBy === "phase") {
      const byPhase: Record<string, typeof entries> = {};
      for (const e of entries) {
        const key = e.phaseName || e.phase?.name || "No Phase";
        if (!byPhase[key]) byPhase[key] = [];
        byPhase[key].push(e);
      }
      Object.keys(byPhase).forEach((phaseName) => {
        const phaseEntries = byPhase[phaseName];
        const totalHours = phaseEntries.reduce((s, e) => s + e.hours, 0);
        const rate = getBillRate(phaseEntries[0]);
        lines.push({
          description: phaseName,
          quantity: Math.round(totalHours * 100) / 100,
          unitPrice: rate,
          amount: Math.round(totalHours * rate * 100) / 100,
          type: "time",
          timeEntryIds: phaseEntries.map((e) => e.id),
          expenseIds: [],
          phaseName,
        });
      });
    } else if (groupBy === "description") {
      const byComment: Record<string, typeof entries> = {};
      for (const e of entries) {
        const key = e.comment || "Work";
        if (!byComment[key]) byComment[key] = [];
        byComment[key].push(e);
      }
      Object.keys(byComment).forEach((desc) => {
        const descEntries = byComment[desc];
        const totalHours = descEntries.reduce((s, e) => s + e.hours, 0);
        const rate = getBillRate(descEntries[0]);
        lines.push({
          description: desc,
          quantity: Math.round(totalHours * 100) / 100,
          unitPrice: rate,
          amount: Math.round(totalHours * rate * 100) / 100,
          type: "time",
          timeEntryIds: descEntries.map((e) => e.id),
          expenseIds: [],
          phaseName: null,
        });
      });
    } else {
      // flat
      const totalHours = entries.reduce((s, e) => s + e.hours, 0);
      const rate = getBillRate(entries[0] || { user: { hourlyRate: 0 } } as typeof entries[number]);
      if (totalHours > 0) {
        lines.push({
          description: project.name,
          quantity: Math.round(totalHours * 100) / 100,
          unitPrice: rate,
          amount: Math.round(totalHours * rate * 100) / 100,
          type: "time",
          timeEntryIds: entries.map((e) => e.id),
          expenseIds: [],
          phaseName: null,
        });
      }
    }

    // Add expense lines
    for (const exp of expenses) {
      lines.push({
        description: `${exp.description} (${exp.category})`,
        quantity: 1,
        unitPrice: exp.amount,
        amount: exp.amount,
        type: "expense",
        timeEntryIds: [],
        expenseIds: [exp.id],
        phaseName: null,
      });
    }

    if (lines.length === 0) {
      return NextResponse.json({ error: "No billable entries or expenses found for this period" }, { status: 400 });
    }

    const subtotal = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
    const vatRate = 25;
    const vatAmount = Math.round(subtotal * vatRate / 100 * 100) / 100;
    const total = Math.round((subtotal + vatAmount) * 100) / 100;

    const payDays = paymentTermsDays || company.defaultPaymentDays || 8;
    const invoiceDate = new Date();
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + payDays);

    // Atomically get and increment invoice number
    const updated = await db.company.update({
      where: { id: user.companyId },
      data: { nextInvoiceNumber: { increment: 1 } },
      select: { nextInvoiceNumber: true },
    });
    const invoiceNumber = updated.nextInvoiceNumber - 1;

    // Create invoice in transaction
    const invoice = await db.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          companyId: user.companyId,
          invoiceNumber,
          projectId,
          clientName: clientName || project.client || "Unknown Client",
          clientAddress: clientAddress || null,
          clientCvr: clientCvr || null,
          clientEan: clientEan || null,
          invoiceDate,
          dueDate,
          periodStart: new Date(periodStart),
          periodEnd: new Date(periodEnd),
          subtotal,
          vatRate,
          vatAmount,
          total,
          currency: company.currency || "DKK",
          paymentTermsDays: payDays,
          note: note || company.invoiceFooterNote || null,
          lines: {
            create: lines.map((l, i) => ({
              sortOrder: i,
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              amount: l.amount,
              type: l.type,
              timeEntryIds: l.timeEntryIds,
              expenseIds: l.expenseIds,
              phaseName: l.phaseName,
            })),
          },
        },
        include: { lines: true },
      });

      // Mark time entries as invoiced
      const allTimeEntryIds = lines.flatMap((l) => l.timeEntryIds);
      if (allTimeEntryIds.length > 0) {
        await tx.timeEntry.updateMany({
          where: { id: { in: allTimeEntryIds } },
          data: { invoiceId: inv.id, invoicedAt: new Date() },
        });
      }

      // Mark expenses as invoiced
      const allExpenseIds = lines.flatMap((l) => l.expenseIds);
      if (allExpenseIds.length > 0) {
        await tx.expense.updateMany({
          where: { id: { in: allExpenseIds } },
          data: { invoiceId: inv.id, invoicedAt: new Date() },
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          companyId: user.companyId,
          entityType: "Invoice",
          entityId: inv.id,
          action: "INVOICE_CREATE",
          actorId: user.id,
          metadata: JSON.stringify({
            invoiceNumber: inv.invoiceNumber,
            total: inv.total,
            lineCount: lines.length,
            timeEntryCount: allTimeEntryIds.length,
            expenseCount: allExpenseIds.length,
          }),
        },
      });

      return inv;
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error("[INVOICES_POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
