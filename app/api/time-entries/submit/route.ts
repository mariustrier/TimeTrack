import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, isAdminOrManager } from "@/lib/auth";
import { getWeekBounds } from "@/lib/week-helpers";
import { startOfDay, endOfDay } from "date-fns";

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { weekStart, date, userId: targetUserId } = body;

    console.log("[SUBMIT] Received body:", JSON.stringify(body));
    console.log("[SUBMIT] weekStart:", weekStart, "date:", date);

    // Must have exactly one of weekStart or date
    if ((!weekStart && !date) || (weekStart && date)) {
      return NextResponse.json(
        { error: "Provide either weekStart (for week) or date (for day)" },
        { status: 400 }
      );
    }

    // Determine effective user (admin/manager can submit on behalf of employees)
    let effectiveUserId = user.id;
    if (targetUserId && targetUserId !== user.id) {
      if (!isAdminOrManager(user.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const targetUser = await db.user.findFirst({
        where: { id: targetUserId, companyId: user.companyId },
      });
      if (!targetUser) {
        return NextResponse.json({ error: "Target user not found" }, { status: 404 });
      }
      effectiveUserId = targetUserId;
    }

    let start: Date;
    let end: Date;
    let entityIdSuffix: string;
    let isDay = false;

    if (weekStart) {
      const bounds = getWeekBounds(weekStart);
      start = bounds.weekStart;
      end = bounds.weekEnd;
      entityIdSuffix = `week:${weekStart}`;
    } else {
      const dayDate = new Date(date);
      start = startOfDay(dayDate);
      end = endOfDay(dayDate);
      entityIdSuffix = `day:${date}`;
      isDay = true;
    }

    console.log("[SUBMIT] Date range:", { start: start.toISOString(), end: end.toISOString(), isDay });

    // Find all draft entries for this user+period
    const draftEntries = await db.timeEntry.findMany({
      where: {
        userId: effectiveUserId,
        companyId: user.companyId,
        date: { gte: start, lte: end },
        approvalStatus: "draft",
      },
    });

    console.log("[SUBMIT] Found draft entries:", draftEntries.length, "entries");
    if (draftEntries.length > 0) {
      console.log("[SUBMIT] Entry dates:", draftEntries.map(e => e.date.toISOString().split('T')[0]));
    }

    if (draftEntries.length === 0) {
      return NextResponse.json(
        { error: isDay ? "No draft entries to submit for this day" : "No draft entries to submit for this week" },
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
    const isOnBehalf = effectiveUserId !== user.id;
    const totalHours = draftEntries.reduce((sum, e) => sum + e.hours, 0);
    await db.auditLog.create({
      data: {
        companyId: user.companyId,
        entityType: "TimeEntry",
        entityId: `user:${effectiveUserId}|${entityIdSuffix}`,
        action: "SUBMIT",
        fromStatus: "draft",
        toStatus: "submitted",
        actorId: user.id,
        metadata: JSON.stringify({
          ...(isDay ? { date } : { weekStart }),
          entryCount: draftEntries.length,
          totalHours,
          ...(isOnBehalf && { onBehalfOf: effectiveUserId }),
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
