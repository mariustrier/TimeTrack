import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const counts: Record<string, number> = {};

    if (user.role === "admin") {
      const [timeEntryCount, expenseCount, vacationCount] = await Promise.all([
        db.timeEntry.count({
          where: { companyId: user.companyId, approvalStatus: "submitted" },
        }),
        db.expense.count({
          where: { companyId: user.companyId, approvalStatus: "submitted" },
        }),
        db.vacationRequest.count({
          where: { companyId: user.companyId, status: "pending" },
        }),
      ]);

      counts.approvals = timeEntryCount + expenseCount;
      counts.vacationManagement = vacationCount;
    }

    if (user.role === "admin" || user.role === "manager") {
      const insightCount = await db.contractInsight.count({
        where: { companyId: user.companyId, dismissed: false },
      });
      counts.aiAssistant = insightCount;
    }

    return NextResponse.json({ counts });
  } catch (error) {
    console.error("[PENDING_COUNTS_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
