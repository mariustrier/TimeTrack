import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { dayApprovalActionSchema } from "@/lib/schemas";
import { startOfDay, endOfDay } from "date-fns";

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
    const result = validate(dayApprovalActionSchema, body);
    if (!result.success) return result.response;
    const { userId, date, reason } = result.data;

    const dayDate = new Date(date);
    const start = startOfDay(dayDate);
    const end = endOfDay(dayDate);

    const entries = await db.timeEntry.findMany({
      where: {
        userId,
        companyId: user.companyId,
        date: { gte: start, lte: end },
        approvalStatus: "submitted",
      },
    });

    if (entries.length === 0) {
      return NextResponse.json(
        { error: "No submitted entries found for this day" },
        { status: 400 }
      );
    }

    await db.timeEntry.updateMany({
      where: { id: { in: entries.map((e) => e.id) } },
      data: {
        approvalStatus: "draft",
        rejectedAt: new Date(),
        rejectedBy: user.id,
        submittedAt: null,
        submittedBy: null,
      },
    });

    await db.auditLog.create({
      data: {
        companyId: user.companyId,
        entityType: "TimeEntry",
        entityId: `user:${userId}|day:${date}`,
        action: "REJECT",
        fromStatus: "submitted",
        toStatus: "draft",
        actorId: user.id,
        metadata: JSON.stringify({
          date,
          userId,
          reason,
          entryCount: entries.length,
        }),
      },
    });

    return NextResponse.json({ success: true, entryCount: entries.length });
  } catch (error) {
    console.error("[APPROVALS_REJECT_DAY]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
