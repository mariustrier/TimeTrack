import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { getWeekBounds } from "@/lib/week-helpers";
import { validate } from "@/lib/validate";
import { approvalActionSchema } from "@/lib/schemas";

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
    const result = validate(approvalActionSchema, body);
    if (!result.success) return result.response;
    const { userId, weekStart } = result.data;

    const { weekStart: start, weekEnd: end } = getWeekBounds(weekStart);

    const entries = await db.timeEntry.findMany({
      where: {
        userId,
        companyId: user.companyId,
        date: { gte: start, lte: end },
        approvalStatus: "approved",
      },
    });

    if (entries.length === 0) {
      return NextResponse.json({ error: "No approved entries found for this week" }, { status: 400 });
    }

    const now = new Date();

    await db.timeEntry.updateMany({
      where: { id: { in: entries.map((e) => e.id) } },
      data: {
        approvalStatus: "locked",
        lockedAt: now,
        lockedBy: user.id,
      },
    });

    await db.auditLog.create({
      data: {
        companyId: user.companyId,
        entityType: "TimeEntry",
        entityId: `user:${userId}|week:${weekStart}`,
        action: "LOCK",
        fromStatus: "approved",
        toStatus: "locked",
        actorId: user.id,
        metadata: JSON.stringify({
          weekStart,
          userId,
          entryCount: entries.length,
        }),
      },
    });

    return NextResponse.json({ success: true, entryCount: entries.length });
  } catch (error) {
    console.error("[APPROVALS_LOCK]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
