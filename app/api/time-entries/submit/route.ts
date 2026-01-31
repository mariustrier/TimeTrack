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

    const body = await req.json();
    const { weekStart } = body;

    if (!weekStart) {
      return NextResponse.json({ error: "weekStart is required" }, { status: 400 });
    }

    const { weekStart: start, weekEnd: end } = getWeekBounds(weekStart);

    // Find all draft entries for this user+week
    const draftEntries = await db.timeEntry.findMany({
      where: {
        userId: user.id,
        companyId: user.companyId,
        date: { gte: start, lte: end },
        approvalStatus: "draft",
      },
    });

    if (draftEntries.length === 0) {
      return NextResponse.json(
        { error: "No draft entries to submit for this week" },
        { status: 400 }
      );
    }

    const now = new Date();

    // Batch update to submitted
    await db.timeEntry.updateMany({
      where: {
        id: { in: draftEntries.map((e) => e.id) },
      },
      data: {
        approvalStatus: "submitted",
        submittedAt: now,
        submittedBy: user.id,
      },
    });

    // Audit log
    const totalHours = draftEntries.reduce((sum, e) => sum + e.hours, 0);
    await db.auditLog.create({
      data: {
        companyId: user.companyId,
        entityType: "TimeEntry",
        entityId: `user:${user.id}|week:${weekStart}`,
        action: "SUBMIT",
        fromStatus: "draft",
        toStatus: "submitted",
        actorId: user.id,
        metadata: JSON.stringify({
          weekStart,
          entryCount: draftEntries.length,
          totalHours,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      entryCount: draftEntries.length,
      totalHours,
    });
  } catch (error) {
    console.error("[TIME_ENTRIES_SUBMIT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
