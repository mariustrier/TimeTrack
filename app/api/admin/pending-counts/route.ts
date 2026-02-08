import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { getDay } from "date-fns";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const counts: Record<string, number> = {};

    if (user.role === "admin") {
      // Only count submitted time entries where Friday (or later) is included
      // This prevents notifications for partial week submissions
      const submittedEntries = await db.timeEntry.findMany({
        where: { companyId: user.companyId, approvalStatus: "submitted" },
        select: { userId: true, date: true },
      });

      // Group by user+week and check if Friday is submitted
      const weeksByUser = new Map<string, Set<string>>();
      const fridaySubmittedWeeks = new Set<string>();

      for (const entry of submittedEntries) {
        const entryDate = new Date(entry.date);
        const dayOfWeek = getDay(entryDate); // 0=Sun, 5=Fri, 6=Sat

        // Get week start (Monday) for grouping
        const weekStart = new Date(entryDate);
        weekStart.setDate(entryDate.getDate() - ((dayOfWeek + 6) % 7));
        const weekKey = `${entry.userId}|${weekStart.toISOString().split("T")[0]}`;

        if (!weeksByUser.has(weekKey)) {
          weeksByUser.set(weekKey, new Set());
        }
        weeksByUser.get(weekKey)!.add(dayOfWeek.toString());

        // If Friday (5), Saturday (6), or Sunday (0) is submitted, count this week
        if (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) {
          fridaySubmittedWeeks.add(weekKey);
        }
      }

      // Count entries only from weeks where Friday+ is submitted
      let timeEntryCount = 0;
      for (const entry of submittedEntries) {
        const entryDate = new Date(entry.date);
        const dayOfWeek = getDay(entryDate);
        const weekStart = new Date(entryDate);
        weekStart.setDate(entryDate.getDate() - ((dayOfWeek + 6) % 7));
        const weekKey = `${entry.userId}|${weekStart.toISOString().split("T")[0]}`;

        if (fridaySubmittedWeeks.has(weekKey)) {
          timeEntryCount++;
        }
      }

      const [expenseCount, vacationCount, cancelledVacationCount] = await Promise.all([
        db.expense.count({
          where: { companyId: user.companyId, approvalStatus: "submitted" },
        }),
        db.vacationRequest.count({
          where: { companyId: user.companyId, status: "pending" },
        }),
        db.vacationRequest.count({
          where: { companyId: user.companyId, status: "cancelled" },
        }),
      ]);

      counts.approvals = timeEntryCount + expenseCount;
      counts.timeEntryApprovals = timeEntryCount;
      counts.expenseApprovals = expenseCount;
      counts.vacationManagement = vacationCount + cancelledVacationCount;
    }

    if (user.role === "admin" || user.role === "manager") {
      const insightCount = await db.contractInsight.count({
        where: { companyId: user.companyId, dismissed: false, seenAt: null },
      });
      counts.aiAssistant = insightCount;
    }

    return NextResponse.json({ counts });
  } catch (error) {
    console.error("[PENDING_COUNTS_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
