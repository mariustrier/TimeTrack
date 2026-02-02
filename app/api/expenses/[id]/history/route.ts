import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const expense = await db.expense.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });

    if (!expense) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const history = await db.auditLog.findMany({
      where: {
        entityType: "Expense",
        entityId: params.id,
        companyId: user.companyId,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(history);
  } catch (error) {
    console.error("[EXPENSE_HISTORY_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
