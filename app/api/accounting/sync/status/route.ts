import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, isAdminOrManager } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminOrManager(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Pending counts (approved but not synced)
    const [pendingTimeEntries, pendingExpenses] = await Promise.all([
      db.timeEntry.count({
        where: {
          companyId: user.companyId,
          approvalStatus: "approved",
          accountingSyncedAt: null,
        },
      }),
      db.expense.count({
        where: {
          companyId: user.companyId,
          approvalStatus: "approved",
          accountingSyncedAt: null,
          isDeleted: false,
        },
      }),
    ]);

    // Synced counts
    const [syncedTimeEntries, syncedExpenses] = await Promise.all([
      db.timeEntry.count({
        where: {
          companyId: user.companyId,
          accountingSyncedAt: { not: null },
        },
      }),
      db.expense.count({
        where: {
          companyId: user.companyId,
          accountingSyncedAt: { not: null },
        },
      }),
    ]);

    // Recent sync logs
    const recentLogs = await db.syncLog.findMany({
      where: { companyId: user.companyId },
      orderBy: { startedAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      pendingTimeEntries,
      pendingExpenses,
      syncedTimeEntries,
      syncedExpenses,
      recentLogs,
    });
  } catch (error) {
    console.error("[SYNC_STATUS]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
