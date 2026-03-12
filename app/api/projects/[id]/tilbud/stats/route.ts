import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { apiError } from "@/lib/api-error";
import { getToday } from "@/lib/demo-date";
import { startOfWeek, subWeeks } from "date-fns";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireManager();

    // Fetch tilbud with categories and their time entries
    const tilbud = await db.tilbudDocument.findFirst({
      where: {
        projectId: params.id,
        companyId: user.companyId,
        status: "ready",
      },
      include: {
        categories: {
          orderBy: { sortOrder: "asc" },
          include: {
            children: {
              orderBy: { sortOrder: "asc" },
              include: {
                timeEntries: {
                  select: { hours: true },
                },
              },
            },
            timeEntries: {
              select: { hours: true },
            },
          },
        },
      },
    });

    if (!tilbud) {
      return NextResponse.json({ error: "No active tilbud found" }, { status: 404 });
    }

    // Summary KPIs
    const parentCategories = tilbud.categories.filter((c: { parentId: string | null }) => !c.parentId);

    let totalQuotedHours = 0;
    let totalUsedHours = 0;
    let totalTimeloenHours = 0;

    // byPhase: parent categories with children
    const byPhase = parentCategories.map((parent) => {
      const parentUsed = parent.timeEntries.reduce(
        (sum: number, e: { hours: number }) => sum + (e.hours || 0),
        0
      );

      const children = parent.children.map((child) => {
        const childUsed = child.timeEntries.reduce(
          (sum: number, e: { hours: number }) => sum + (e.hours || 0),
          0
        );

        const childQuoted = child.quotedHours || 0;
        if (child.isTimeloen) {
          totalTimeloenHours += childUsed;
        } else {
          totalQuotedHours += childQuoted;
        }
        totalUsedHours += childUsed;

        const percentUsed = childQuoted > 0 ? (childUsed / childQuoted) * 100 : 0;

        return {
          id: child.id,
          name: child.name,
          quotedHours: childQuoted,
          usedHours: childUsed,
          isTimeloen: child.isTimeloen,
          timeloenEstimate: child.timeloenEstimate,
          percentUsed: Math.round(percentUsed * 10) / 10,
          status: getStatus(percentUsed, child.isTimeloen),
        };
      });

      // Parent-level aggregation
      const phaseQuoted = parent.quotedHours || children.reduce((s: number, c: { quotedHours: number }) => s + c.quotedHours, 0);
      const phaseUsed = parentUsed + children.reduce((s: number, c: { usedHours: number }) => s + c.usedHours, 0);

      // Add parent's own hours if it doesn't have children contributing
      if (parent.children.length === 0) {
        if (parent.isTimeloen) {
          totalTimeloenHours += parentUsed;
        } else {
          totalQuotedHours += (parent.quotedHours || 0);
        }
        totalUsedHours += parentUsed;
      }

      const phasePercent = phaseQuoted > 0 ? (phaseUsed / phaseQuoted) * 100 : 0;

      return {
        id: parent.id,
        faseNumber: parent.faseNumber,
        name: parent.name,
        quotedHours: phaseQuoted,
        usedHours: phaseUsed,
        isTimeloen: parent.isTimeloen,
        isRecurring: parent.isRecurring,
        recurringUnit: parent.recurringUnit,
        percentUsed: Math.round(phasePercent * 10) / 10,
        status: getStatus(phasePercent, parent.isTimeloen),
        children,
      };
    });

    // byEmployee: group time entries by user (filter deleted users)
    const timeEntries = await db.timeEntry.findMany({
      where: {
        projectId: params.id,
        companyId: user.companyId,
        tilbudCategoryId: { not: null },
        user: { deletedAt: null },
      },
      select: {
        hours: true,
        userId: true,
        tilbudCategoryId: true,
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const employeeMap: Record<
      string,
      {
        id: string;
        name: string;
        totalHours: number;
        byCategory: Record<string, number>;
      }
    > = {};

    for (const entry of timeEntries) {
      if (!employeeMap[entry.userId]) {
        employeeMap[entry.userId] = {
          id: entry.userId,
          name: `${entry.user.firstName || ""} ${entry.user.lastName || ""}`.trim(),
          totalHours: 0,
          byCategory: {},
        };
      }
      const emp = employeeMap[entry.userId];
      emp.totalHours += entry.hours || 0;
      const catId = entry.tilbudCategoryId!;
      emp.byCategory[catId] = (emp.byCategory[catId] || 0) + (entry.hours || 0);
    }

    const byEmployee = Object.values(employeeMap).sort(
      (a, b) => b.totalHours - a.totalHours
    );

    // weeklyBurn: last 8 weeks of time entries grouped by week start
    const today = getToday();
    const eightWeeksAgo = subWeeks(startOfWeek(today, { weekStartsOn: 1 }), 8);

    const weeklyEntries = await db.timeEntry.findMany({
      where: {
        projectId: params.id,
        companyId: user.companyId,
        tilbudCategoryId: { not: null },
        date: { gte: eightWeeksAgo },
      },
      select: { hours: true, date: true },
    });

    const weeklyBurnMap: Record<string, number> = {};
    for (const entry of weeklyEntries) {
      const ws = startOfWeek(new Date(entry.date), {
        weekStartsOn: 1,
      });
      const key = ws.toISOString().slice(0, 10);
      weeklyBurnMap[key] = (weeklyBurnMap[key] || 0) + (entry.hours || 0);
    }

    const weeklyBurn = Object.entries(weeklyBurnMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekStart, hours]) => ({ weekStart, hours }));

    // Burn rate: average of last 4 weeks
    const last4Weeks = weeklyBurn.slice(-4);
    const burnRatePerWeek =
      last4Weeks.length > 0
        ? last4Weeks.reduce((s, w) => s + w.hours, 0) / last4Weeks.length
        : 0;

    const remainingHours = Math.max(0, totalQuotedHours - totalUsedHours);
    const estimatedWeeksRemaining =
      burnRatePerWeek > 0
        ? Math.round((remainingHours / burnRatePerWeek) * 10) / 10
        : null;

    const percentUsed =
      totalQuotedHours > 0
        ? Math.round(((totalUsedHours / totalQuotedHours) * 100) * 10) / 10
        : 0;

    return NextResponse.json({
      summary: {
        totalQuotedHours,
        totalUsedHours: Math.round(totalUsedHours * 10) / 10,
        totalTimeloenHours: Math.round(totalTimeloenHours * 10) / 10,
        percentUsed,
        burnRatePerWeek: Math.round(burnRatePerWeek * 10) / 10,
        estimatedWeeksRemaining,
        hourlyRate: tilbud.hourlyRate,
        totalQuotedAmount: tilbud.totalQuotedAmount,
      },
      byPhase,
      byEmployee,
      weeklyBurn,
    });
  } catch (error) {
    return apiError(error, { label: "TILBUD_STATS_GET" });
  }
}

function getStatus(
  percentUsed: number,
  isTimeloen: boolean
): "ok" | "warning" | "danger" | "exceeded" | "timeloen" {
  if (isTimeloen) return "timeloen";
  if (percentUsed > 100) return "exceeded";
  if (percentUsed >= 90) return "danger";
  if (percentUsed >= 70) return "warning";
  return "ok";
}
