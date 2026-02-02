import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
        userId: user.id,
        companyId: user.companyId,
        approvalStatus: "draft",
      },
      data: {
        approvalStatus: "submitted",
        submittedAt: now,
      },
    });

    // Create audit log entries for each submitted expense
    const submittedExpenses = await db.expense.findMany({
      where: {
        id: { in: expenseIds },
        userId: user.id,
        companyId: user.companyId,
        approvalStatus: "submitted",
        submittedAt: now,
      },
      select: { id: true },
    });

    for (const expense of submittedExpenses) {
      await db.auditLog.create({
        data: {
          companyId: user.companyId,
          entityType: "Expense",
          entityId: expense.id,
          action: "SUBMIT",
          fromStatus: "draft",
          toStatus: "submitted",
          actorId: user.id,
        },
      });
    }

    return NextResponse.json({ count: result.count });
  } catch (error) {
    console.error("[EXPENSES_SUBMIT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
