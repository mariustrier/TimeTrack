import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { getDay } from "date-fns";

interface PendingItem {
  id: string;
  type: "timeEntry" | "expense" | "vacation";
  date: string;
  employeeName: string;
  projectName: string | null;
  amount: number | null;
  hours: number | null;
  status: string;
  createdAt: string;
}

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "admin" && user.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ─── Time Entries ───
    const submittedEntries = await db.timeEntry.findMany({
      where: { companyId: user.companyId, approvalStatus: "submitted" },
      select: {
        id: true,
        userId: true,
        date: true,
        hours: true,
        approvalStatus: true,
        createdAt: true,
        project: { select: { name: true } },
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    // Filter to only include entries from weeks where Friday+ is submitted
    // (same logic as pending-counts)
    const fridaySubmittedWeeks = new Set<string>();
    for (const entry of submittedEntries) {
      const entryDate = new Date(entry.date);
      const dayOfWeek = getDay(entryDate);
      const weekStart = new Date(entryDate);
      weekStart.setDate(entryDate.getDate() - ((dayOfWeek + 6) % 7));
      const weekKey = `${entry.userId}|${weekStart.toISOString().split("T")[0]}`;

      if (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) {
        fridaySubmittedWeeks.add(weekKey);
      }
    }

    const timeEntryItems: PendingItem[] = [];
    for (const entry of submittedEntries) {
      const entryDate = new Date(entry.date);
      const dayOfWeek = getDay(entryDate);
      const weekStart = new Date(entryDate);
      weekStart.setDate(entryDate.getDate() - ((dayOfWeek + 6) % 7));
      const weekKey = `${entry.userId}|${weekStart.toISOString().split("T")[0]}`;

      if (fridaySubmittedWeeks.has(weekKey)) {
        const employeeName =
          `${entry.user.firstName || ""} ${entry.user.lastName || ""}`.trim() ||
          entry.user.email;
        timeEntryItems.push({
          id: entry.id,
          type: "timeEntry",
          date: new Date(entry.date).toISOString().split("T")[0],
          employeeName,
          projectName: entry.project.name,
          amount: null,
          hours: entry.hours,
          status: entry.approvalStatus,
          createdAt: entry.createdAt.toISOString(),
        });
      }
    }

    // ─── Expenses ───
    const submittedExpenses = await db.expense.findMany({
      where: { companyId: user.companyId, approvalStatus: "submitted" },
      select: {
        id: true,
        date: true,
        amount: true,
        approvalStatus: true,
        createdAt: true,
        project: { select: { name: true } },
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    const expenseItems: PendingItem[] = submittedExpenses.map((exp) => {
      const employeeName =
        `${exp.user.firstName || ""} ${exp.user.lastName || ""}`.trim() ||
        exp.user.email;
      return {
        id: exp.id,
        type: "expense",
        date: new Date(exp.date).toISOString().split("T")[0],
        employeeName,
        projectName: exp.project?.name || null,
        amount: exp.amount,
        hours: null,
        status: exp.approvalStatus,
        createdAt: exp.createdAt.toISOString(),
      };
    });

    // ─── Vacations ───
    const pendingVacations = await db.vacationRequest.findMany({
      where: {
        companyId: user.companyId,
        status: { in: ["pending", "cancelled"] },
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        type: true,
        status: true,
        createdAt: true,
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    const vacationItems: PendingItem[] = pendingVacations.map((vac) => {
      const employeeName =
        `${vac.user.firstName || ""} ${vac.user.lastName || ""}`.trim() ||
        vac.user.email;
      return {
        id: vac.id,
        type: "vacation",
        date: new Date(vac.startDate).toISOString().split("T")[0],
        employeeName,
        projectName: null,
        amount: null,
        hours: null,
        status: vac.status,
        createdAt: vac.createdAt.toISOString(),
      };
    });

    // ─── Aggregate ───
    const items = [...timeEntryItems, ...expenseItems, ...vacationItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const counts = {
      timeEntries: timeEntryItems.length,
      expenses: expenseItems.length,
      vacations: vacationItems.length,
      total: items.length,
    };

    return NextResponse.json({ items, counts });
  } catch (error) {
    console.error("[APPROVALS_PENDING_GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
