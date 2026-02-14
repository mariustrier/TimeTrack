import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, isAdminOrManager } from "@/lib/auth";
import { endOfWeek, format } from "date-fns";

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const weekStartParam = searchParams.get("weekStart");
    const userIdParam = searchParams.get("userId");

    if (!weekStartParam) {
      return NextResponse.json({ error: "weekStart is required" }, { status: 400 });
    }

    // Determine target user (admin "view as" support)
    let targetUserId = user.id;
    if (userIdParam && userIdParam !== user.id) {
      if (!isAdminOrManager(user.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      targetUserId = userIdParam;
    }

    const weekStart = new Date(weekStartParam);
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

    // Fetch resource allocations that overlap with this week
    const allocations = await db.resourceAllocation.findMany({
      where: {
        companyId: user.companyId,
        userId: targetUserId,
        status: { in: ["tentative", "confirmed"] },
        startDate: { lte: weekEnd },
        endDate: { gte: weekStart },
      },
      include: {
        project: {
          select: { id: true, name: true, color: true },
        },
      },
    });

    // Fetch the target user's weekly target for Friday adjustment
    const targetUser = targetUserId === user.id
      ? user
      : await db.user.findUnique({ where: { id: targetUserId }, select: { weeklyTarget: true, isHourly: true } });
    const weeklyTarget = targetUser?.weeklyTarget ?? 37;
    const isSalaried = !targetUser?.isHourly;
    // Danish convention: Mon-Thu = ceil, Friday = remainder (e.g. 37h → 7.5×4 + 7)
    const monThuDaily = isSalaried ? Math.ceil((weeklyTarget / 5) * 2) / 2 : 0; // round up to nearest 0.5
    const fridayDaily = isSalaried ? weeklyTarget - monThuDaily * 4 : 0;
    const fridayScale = monThuDaily > 0 ? fridayDaily / monThuDaily : 1;

    // Calculate planned hours per project per day
    const byProject: Record<string, { planned: number; projectName: string; projectColor: string }> = {};
    const byProjectDay: Record<string, Record<string, number>> = {};

    for (const alloc of allocations) {
      const overlapStart = alloc.startDate > weekStart ? alloc.startDate : weekStart;
      const overlapEnd = alloc.endDate < weekEnd ? alloc.endDate : weekEnd;

      // Iterate through the overlap days
      const current = new Date(overlapStart);
      while (current <= overlapEnd) {
        const dayOfWeek = current.getDay();
        // Only count weekdays
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          const dateStr = format(current, "yyyy-MM-dd");
          // Friday (dayOfWeek=5): scale down to match Danish convention
          const hours = isSalaried && dayOfWeek === 5
            ? Math.round(alloc.hoursPerDay * fridayScale * 10) / 10
            : alloc.hoursPerDay;

          if (!byProject[alloc.projectId]) {
            byProject[alloc.projectId] = {
              planned: 0,
              projectName: alloc.project.name,
              projectColor: alloc.project.color,
            };
          }
          byProject[alloc.projectId].planned += hours;

          if (!byProjectDay[alloc.projectId]) {
            byProjectDay[alloc.projectId] = {};
          }
          byProjectDay[alloc.projectId][dateStr] =
            (byProjectDay[alloc.projectId][dateStr] || 0) + hours;
        }
        current.setDate(current.getDate() + 1);
      }
    }

    const totalPlanned = Object.values(byProject).reduce((sum, p) => sum + p.planned, 0);

    return NextResponse.json({
      totalPlanned: Math.round(totalPlanned * 10) / 10,
      byProject,
      byProjectDay,
    });
  } catch (error) {
    console.error("[USER_PLANNED_HOURS_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
