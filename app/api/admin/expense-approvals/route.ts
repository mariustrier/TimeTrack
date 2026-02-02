import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {
      companyId: user.companyId,
      isDeleted: { not: true },
    };

    if (status) {
      where.approvalStatus = status;
    }

    const expenses = await db.expense.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        project: { select: { id: true, name: true, color: true } },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ expenses });
  } catch (error) {
    console.error("[EXPENSE_APPROVALS_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
