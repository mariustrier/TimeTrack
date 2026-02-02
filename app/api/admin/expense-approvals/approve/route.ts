import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { expenseIds } = body;

    if (!expenseIds || !Array.isArray(expenseIds) || expenseIds.length === 0) {
      return NextResponse.json({ error: "expenseIds array is required" }, { status: 400 });
    }

    const now = new Date();

    const result = await db.expense.updateMany({
      where: {
        id: { in: expenseIds },
        companyId: user.companyId,
        approvalStatus: "submitted",
      },
      data: {
        approvalStatus: "approved",
        approvedAt: now,
        approvedBy: user.id,
        isFinalized: true,
        finalizedAt: now,
      },
    });

    // Create audit log entries
    const approvedExpenses = await db.expense.findMany({
      where: {
        id: { in: expenseIds },
        companyId: user.companyId,
        approvalStatus: "approved",
        approvedAt: now,
      },
      select: { id: true },
    });

    for (const expense of approvedExpenses) {
      await db.auditLog.create({
        data: {
          companyId: user.companyId,
          entityType: "Expense",
          entityId: expense.id,
          action: "APPROVE",
          fromStatus: "submitted",
          toStatus: "approved",
          actorId: user.id,
        },
      });
    }

    return NextResponse.json({ count: result.count });
  } catch (error) {
    console.error("[EXPENSE_APPROVALS_APPROVE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
