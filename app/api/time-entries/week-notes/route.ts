import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { getWeekBounds } from "@/lib/week-helpers";
import { format } from "date-fns";

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const weekStartParam = searchParams.get("weekStart");

    if (!weekStartParam) {
      return NextResponse.json({ error: "weekStart is required" }, { status: 400 });
    }

    const { weekStart } = getWeekBounds(weekStartParam);
    const weekId = format(weekStart, "yyyy-MM-dd");

    const log = await db.auditLog.findFirst({
      where: {
        companyId: user.companyId,
        entityId: `user:${user.id}|week:${weekId}`,
        action: { in: ["REJECT", "REOPEN"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!log) {
      return NextResponse.json({ note: null });
    }

    const metadata = log.metadata ? JSON.parse(log.metadata) : {};

    return NextResponse.json({
      note: {
        action: log.action,
        reason: metadata.reason || null,
        createdAt: log.createdAt,
      },
    });
  } catch (error) {
    console.error("[WEEK_NOTES_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
