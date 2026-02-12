import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, isAdminOrManager } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { invoicePreviewSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminOrManager(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const result = validate(invoicePreviewSchema, body);
    if (!result.success) return result.response;

    const { projectId, periodStart, periodEnd, groupBy, includeExpenses, phaseId, timeEntryIds, expenseIds } = result.data;

    const project = await db.project.findFirst({
      where: { id: projectId, companyId: user.companyId },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const company = await db.company.findUnique({ where: { id: user.companyId } });
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    // Fetch entries
    const timeWhere: Record<string, unknown> = {
      projectId,
      companyId: user.companyId,
      approvalStatus: "approved",
      billingStatus: "billable",
      invoiceId: null,
      date: { gte: new Date(periodStart), lte: new Date(periodEnd) },
    };
    if (phaseId) timeWhere.phaseId = phaseId;
    if (timeEntryIds && timeEntryIds.length > 0) timeWhere.id = { in: timeEntryIds };

    const entries = await db.timeEntry.findMany({
      where: timeWhere,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, hourlyRate: true } },
        phase: { select: { name: true } },
      },
    });

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
      if (expenseIds && expenseIds.length > 0) expWhere.id = { in: expenseIds };
      expenses = await db.expense.findMany({ where: expWhere });
    }

    const getBillRate = (entry: typeof entries[number]): number => {
      if (project.rateMode === "EMPLOYEE_RATES" && entry.user.hourlyRate) return entry.user.hourlyRate;
      if (project.rateMode === "PROJECT_RATE" && project.projectRate) return project.projectRate;
      return company.defaultHourlyRate || 0;
    }

    type PreviewLine = { description: string; quantity: number; unitPrice: number; amount: number; type: string; phaseName: string | null };
    const lines: PreviewLine[] = [];

    if (groupBy === "employee") {
      const byEmployee: Record<string, typeof entries> = {};
      for (const e of entries) {
        if (!byEmployee[e.userId]) byEmployee[e.userId] = [];
        byEmployee[e.userId].push(e);
      }
      Object.values(byEmployee).forEach((empEntries) => {
        const emp = empEntries[0].user;
        const name = [emp.firstName, emp.lastName].filter(Boolean).join(" ") || "Unknown";
        const totalHours = empEntries.reduce((s, e) => s + e.hours, 0);
        const rate = getBillRate(empEntries[0]);
        lines.push({ description: name, quantity: Math.round(totalHours * 100) / 100, unitPrice: rate, amount: Math.round(totalHours * rate * 100) / 100, type: "time", phaseName: null });
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
        lines.push({ description: phaseName, quantity: Math.round(totalHours * 100) / 100, unitPrice: rate, amount: Math.round(totalHours * rate * 100) / 100, type: "time", phaseName });
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
        lines.push({ description: desc, quantity: Math.round(totalHours * 100) / 100, unitPrice: rate, amount: Math.round(totalHours * rate * 100) / 100, type: "time", phaseName: null });
      });
    } else {
      const totalHours = entries.reduce((s, e) => s + e.hours, 0);
      const rate = entries.length > 0 ? getBillRate(entries[0]) : 0;
      if (totalHours > 0) {
        lines.push({ description: project.name, quantity: Math.round(totalHours * 100) / 100, unitPrice: rate, amount: Math.round(totalHours * rate * 100) / 100, type: "time", phaseName: null });
      }
    }

    for (const exp of expenses) {
      lines.push({ description: `${exp.description} (${exp.category})`, quantity: 1, unitPrice: exp.amount, amount: exp.amount, type: "expense", phaseName: null });
    }

    const subtotal = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
    const vatRate = 25;
    const vatAmount = Math.round(subtotal * vatRate / 100 * 100) / 100;
    const total = Math.round((subtotal + vatAmount) * 100) / 100;

    return NextResponse.json({
      lines,
      subtotal,
      vatRate,
      vatAmount,
      total,
      currency: company.currency || "DKK",
      entryCount: entries.length,
      expenseCount: expenses.length,
      totalHours: Math.round(entries.reduce((s, e) => s + e.hours, 0) * 100) / 100,
    });
  } catch (error) {
    console.error("[INVOICE_PREVIEW]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
