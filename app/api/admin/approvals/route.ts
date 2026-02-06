import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { getWeekId } from "@/lib/week-helpers";
import { getDay } from "date-fns";

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status") || "submitted";

    const where: Record<string, unknown> = {
      companyId: user.companyId,
    };

    if (statusFilter !== "all") {
      where.approvalStatus = statusFilter;
    }

    const entries = await db.timeEntry.findMany({
      where,
      select: {
        id: true,
        date: true,
        hours: true,
        comment: true,
        userId: true,
        projectId: true,
        approvalStatus: true,
        billingStatus: true,
        submittedAt: true,
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        project: { select: { id: true, name: true, color: true, billable: true } },
      },
      orderBy: { date: "asc" },
    });

    // Group by userId + week
    const groups: Record<string, {
      userId: string;
      userName: string;
      userEmail: string;
      weekStart: string;
      totalHours: number;
      billableHours: number;
      entryCount: number;
      submittedAt: string | null;
      approvalStatus: string;
      entries: typeof entries;
    }> = {};

    for (const entry of entries) {
      const weekId = getWeekId(entry.date);
      const key = `${entry.userId}|${weekId}`;
      const name = `${entry.user.firstName || ""} ${entry.user.lastName || ""}`.trim() || entry.user.email;

      if (!groups[key]) {
        groups[key] = {
          userId: entry.userId,
          userName: name,
          userEmail: entry.user.email,
          weekStart: weekId,
          totalHours: 0,
          billableHours: 0,
          entryCount: 0,
          submittedAt: entry.submittedAt?.toISOString() || null,
          approvalStatus: "draft",
          entries: [],
        };
      }

      groups[key].totalHours += entry.hours;
      if (entry.billingStatus === "billable") {
        groups[key].billableHours += entry.hours;
      }
      groups[key].entryCount++;
      groups[key].entries.push(entry);
    }

    // Compute approvalStatus per week group from all entries (not just the first)
    for (const group of Object.values(groups)) {
      const statuses = new Set(group.entries.map((e) => e.approvalStatus));
      if (statuses.size === 1) {
        group.approvalStatus = Array.from(statuses)[0];
      } else if (statuses.has("locked") && !statuses.has("draft") && !statuses.has("submitted")) {
        group.approvalStatus = "locked";
      } else if (statuses.has("approved") && !statuses.has("draft") && !statuses.has("submitted")) {
        group.approvalStatus = "approved";
      } else if (statuses.has("submitted")) {
        // Mixed: has submitted entries that still need attention
        group.approvalStatus = "submitted";
      } else {
        group.approvalStatus = "draft";
      }
    }

    // Filter: only show weeks where Friday (or weekend) is submitted
    // This prevents partial week submissions from appearing until complete
    const filteredGroups = Object.values(groups).filter((group) => {
      // For non-submitted status filters (approved, locked, all), show everything
      if (statusFilter !== "submitted") return true;

      // Check if any entry in this week is Friday (5), Saturday (6), or Sunday (0)
      return group.entries.some((entry) => {
        const dayOfWeek = getDay(new Date(entry.date));
        return dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0;
      });
    });

    const weekSubmissions = filteredGroups.sort((a, b) => {
      // Sort by submittedAt ascending (oldest first)
      if (a.submittedAt && b.submittedAt) return a.submittedAt.localeCompare(b.submittedAt);
      return a.weekStart.localeCompare(b.weekStart);
    });

    return NextResponse.json({ weekSubmissions });
  } catch (error) {
    console.error("[APPROVALS_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
