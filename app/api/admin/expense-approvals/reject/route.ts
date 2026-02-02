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
    const { expenseIds, reason } = body;

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
        approvalStatus: "rejected",
        rejectedAt: now,
        rejectedBy: user.id,
        rejectionReason: reason || null,
      },
    });

    // Create audit log entries
    const rejectedExpenses = await db.expense.findMany({
      where: {
        id: { in: expenseIds },
        companyId: user.companyId,
        approvalStatus: "rejected",
        rejectedAt: now,
      },
      select: { id: true },
    });

    for (const expense of rejectedExpenses) {
      await db.auditLog.create({
        data: {
          companyId: user.companyId,
          entityType: "Expense",
          entityId: expense.id,
          action: "REJECT",
          fromStatus: "submitted",
          toStatus: "rejected",
          actorId: user.id,
          metadata: JSON.stringify({ reason: reason || null }),
        },
      });
    }

    return NextResponse.json({ count: result.count });
  } catch (error) {
    console.error("[EXPENSE_APPROVALS_REJECT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
