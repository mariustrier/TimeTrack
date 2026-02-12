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

          if (!byProject[alloc.projectId]) {
            byProject[alloc.projectId] = {
              planned: 0,
              projectName: alloc.project.name,
              projectColor: alloc.project.color,
            };
          }
          byProject[alloc.projectId].planned += alloc.hoursPerDay;

          if (!byProjectDay[alloc.projectId]) {
            byProjectDay[alloc.projectId] = {};
          }
          byProjectDay[alloc.projectId][dateStr] =
            (byProjectDay[alloc.projectId][dateStr] || 0) + alloc.hoursPerDay;
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
