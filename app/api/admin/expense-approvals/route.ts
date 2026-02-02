import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const expenses = await db.expense.findMany({
      where: {
        companyId: user.companyId,
        approvalStatus: "submitted",
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        project: { select: { id: true, name: true, color: true } },
      },
      orderBy: { date: "desc" },
    });

    // Group by user
    const grouped: Record<string, { user: { id: string; firstName: string | null; lastName: string | null; email: string }; expenses: typeof expenses }> = {};

    for (const expense of expenses) {
      const uid = expense.userId;
      if (!grouped[uid]) {
        grouped[uid] = {
          user: expense.user,
          expenses: [],
        };
      }
      grouped[uid].expenses.push(expense);
    }

    return NextResponse.json(Object.values(grouped));
  } catch (error) {
    console.error("[EXPENSE_APPROVALS_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
