import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { getWeekBounds } from "@/lib/week-helpers";

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
    const { userId, weekStart, reason } = body;

    if (!userId || !weekStart) {
      return NextResponse.json({ error: "userId and weekStart are required" }, { status: 400 });
    }
    if (!reason) {
      return NextResponse.json({ error: "A reason is required to reopen entries" }, { status: 400 });
    }

    const { weekStart: start, weekEnd: end } = getWeekBounds(weekStart);

    const entries = await db.timeEntry.findMany({
      where: {
        userId,
        companyId: user.companyId,
        date: { gte: start, lte: end },
        approvalStatus: { in: ["approved", "locked"] },
      },
    });

    if (entries.length === 0) {
      return NextResponse.json({ error: "No approved or locked entries found for this week" }, { status: 400 });
    }

    const previousStatus = entries[0].approvalStatus;

    await db.timeEntry.updateMany({
      where: { id: { in: entries.map((e) => e.id) } },
      data: {
        approvalStatus: "draft",
        submittedAt: null,
        submittedBy: null,
        approvedAt: null,
        approvedBy: null,
        lockedAt: null,
        lockedBy: null,
      },
    });

    await db.auditLog.create({
      data: {
        companyId: user.companyId,
        entityType: "TimeEntry",
        entityId: `user:${userId}|week:${weekStart}`,
        action: "REOPEN",
        fromStatus: previousStatus,
        toStatus: "draft",
        actorId: user.id,
        metadata: JSON.stringify({
          weekStart,
          userId,
          reason,
          previousStatus,
          entryCount: entries.length,
        }),
      },
    });

    return NextResponse.json({ success: true, entryCount: entries.length });
  } catch (error) {
    console.error("[APPROVALS_REOPEN]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
