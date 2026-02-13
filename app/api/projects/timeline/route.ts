import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { getEffectiveWeeklyCapacity } from "@/lib/calculations";
import {
  startOfWeek,
  endOfWeek,
  eachWeekOfInterval,
  format,
  isWithinInterval,
  eachDayOfInterval,
  isWeekend,
} from "date-fns";

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "admin" && user.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const includeParam = url.searchParams.get("include") || "";
    const clientFilter = url.searchParams.get("client") || "";
    const statusFilter = url.searchParams.get("status") || "active";
    const searchFilter = url.searchParams.get("search") || "";

    const includes = includeParam.split(",").filter(Boolean);
    const includePhases = includes.includes("phases");
    const includeAllocations = includes.includes("allocations");
    const includeBurndown = includes.includes("burndown");
    const includeConflicts = includes.includes("conflicts");

    // Build project filter
    const projectWhere: Record<string, unknown> = {
      companyId: user.companyId,
      systemManaged: false,
    };

    if (statusFilter === "active") {
      projectWhere.archived = false;
      projectWhere.locked = false;
    } else if (statusFilter === "locked") {
      projectWhere.locked = true;
    } else if (statusFilter === "archived") {
      projectWhere.archived = true;
    }
    // "all" = no status filter

    if (clientFilter) {
      projectWhere.client = clientFilter;
    }

    if (searchFilter) {
      projectWhere.name = { contains: searchFilter, mode: "insensitive" };
    }

    // Fetch projects with related data
    const [projects, hoursUsedAgg, companyPhases, activityCounts, activityCompletedCounts] = await Promise.all([
      db.project.findMany({
        where: projectWhere,
        include: {
          currentPhase: { select: { id: true, name: true, color: true } },
          milestones: {
            orderBy: [{ sortOrder: "asc" }, { dueDate: "asc" }],
          },
          projectPhases: {
            include: {
              phase: { select: { id: true, name: true, color: true, sortOrder: true } },
            },
            orderBy: { phase: { sortOrder: "asc" } },
          },
        },
        orderBy: { name: "asc" },
      }),

      // Total hours per project
      db.timeEntry.groupBy({
        by: ["projectId"],
        where: { companyId: user.companyId },
        _sum: { hours: true },
      }),

      // Company phase definitions
      db.phase.findMany({
        where: { companyId: user.companyId, active: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, color: true, sortOrder: true },
      }),

      // Activity counts per project
      db.projectActivity.groupBy({
        by: ["projectId"],
        where: { companyId: user.companyId },
        _count: { id: true },
      }),

      // Completed activity counts per project
      db.projectActivity.groupBy({
        by: ["projectId"],
        where: { companyId: user.companyId, status: "complete" },
        _count: { id: true },
      }),
    ]);

    const hoursMap: Record<string, number> = {};
    for (const entry of hoursUsedAgg) {
      hoursMap[entry.projectId] = entry._sum.hours || 0;
    }

    const activityCountMap: Record<string, number> = {};
    for (const entry of activityCounts) {
      activityCountMap[entry.projectId] = entry._count.id;
    }
    const activityCompletedMap: Record<string, number> = {};
    for (const entry of activityCompletedCounts) {
      activityCompletedMap[entry.projectId] = entry._count.id;
    }

    // Fetch allocations if needed
    let allocationsByProject: Record<string, Array<{
      id: string;
      userId: string;
      userName: string;
      userImageUrl: string | null;
      startDate: string;
      endDate: string;
      hoursPerDay: number;
      status: string;
    }>> = {};

    let allAllocations: Array<{
      id: string;
      userId: string;
      projectId: string;
      startDate: Date;
      endDate: Date;
      hoursPerDay: number;
      status: string;
      user: { id: string; firstName: string | null; lastName: string | null; imageUrl: string | null; weeklyTarget: number; isHourly: boolean };
    }> = [];

    if (includeAllocations || includeConflicts) {
      const projectIds = projects.map((p) => p.id);
      const dateFilter: Record<string, unknown> = {
        companyId: user.companyId,
        projectId: { in: projectIds },
      };
      if (startDate && endDate) {
        dateFilter.OR = [
          { startDate: { lte: new Date(endDate) }, endDate: { gte: new Date(startDate) } },
        ];
      }

      allAllocations = await db.resourceAllocation.findMany({
        where: dateFilter,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              imageUrl: true,
              weeklyTarget: true,
              isHourly: true,
            },
          },
        },
      });

      if (includeAllocations) {
        for (const alloc of allAllocations) {
          const userName = alloc.user.firstName && alloc.user.lastName
            ? `${alloc.user.firstName} ${alloc.user.lastName}`
            : alloc.user.firstName || "Unknown";

          if (!allocationsByProject[alloc.projectId]) {
            allocationsByProject[alloc.projectId] = [];
          }
          allocationsByProject[alloc.projectId].push({
            id: alloc.id,
            userId: alloc.userId,
            userName,
            userImageUrl: alloc.user.imageUrl,
            startDate: format(alloc.startDate, "yyyy-MM-dd"),
            endDate: format(alloc.endDate, "yyyy-MM-dd"),
            hoursPerDay: alloc.hoursPerDay,
            status: alloc.status,
          });
        }
      }
    }

    // Burndown data
    let burndownByProject: Record<string, Array<{ weekStart: string; plannedCumulative: number; actualCumulative: number }>> = {};

    if (includeBurndown && startDate && endDate) {
      const projectsWithBudget = projects.filter((p) => p.budgetHours && p.startDate && p.endDate);

      if (projectsWithBudget.length > 0) {
        // Get weekly time entries for these projects
        const entries = await db.timeEntry.findMany({
          where: {
            companyId: user.companyId,
            projectId: { in: projectsWithBudget.map((p) => p.id) },
            approvalStatus: { in: ["submitted", "approved", "locked"] },
          },
          select: { projectId: true, hours: true, date: true },
        });

        // Group entries by project and week
        const entryMap: Record<string, Record<string, number>> = {};
        for (const entry of entries) {
          const weekStart = format(startOfWeek(entry.date, { weekStartsOn: 1 }), "yyyy-MM-dd");
          if (!entryMap[entry.projectId]) entryMap[entry.projectId] = {};
          entryMap[entry.projectId][weekStart] = (entryMap[entry.projectId][weekStart] || 0) + entry.hours;
        }

        for (const project of projectsWithBudget) {
          if (!project.startDate || !project.endDate || !project.budgetHours) continue;

          const pStart = new Date(project.startDate);
          const pEnd = new Date(project.endDate);
          const totalWeeks = Math.max(1, Math.ceil((pEnd.getTime() - pStart.getTime()) / (7 * 24 * 60 * 60 * 1000)));
          const plannedPerWeek = project.budgetHours / totalWeeks;

          const weeks = eachWeekOfInterval({ start: pStart, end: pEnd }, { weekStartsOn: 1 });
          const projectEntries = entryMap[project.id] || {};

          let actualCumulative = 0;
          const points: Array<{ weekStart: string; plannedCumulative: number; actualCumulative: number }> = [];

          weeks.forEach((weekDate, i) => {
            const weekKey = format(weekDate, "yyyy-MM-dd");
            const weekActual = projectEntries[weekKey] || 0;
            actualCumulative += weekActual;

            points.push({
              weekStart: weekKey,
              plannedCumulative: Math.min(plannedPerWeek * (i + 1), project.budgetHours!),
              actualCumulative,
            });
          });

          burndownByProject[project.id] = points;
        }
      }
    }

    // Conflict detection
    let conflicts: Array<{
      userId: string;
      userName: string;
      date: string;
      totalHours: number;
      dailyCapacity: number;
      projects: Array<{ projectId: string; projectName: string; projectColor: string; hours: number }>;
    }> = [];

    if (includeConflicts && startDate && endDate && allAllocations.length > 0) {
      // Group allocations by user
      const allocsByUser: Record<string, typeof allAllocations> = {};
      for (const alloc of allAllocations) {
        if (!allocsByUser[alloc.userId]) allocsByUser[alloc.userId] = [];
        allocsByUser[alloc.userId].push(alloc);
      }

      const projectNameMap: Record<string, string> = {};
      const projectColorMap: Record<string, string> = {};
      for (const p of projects) {
        projectNameMap[p.id] = p.name;
        projectColorMap[p.id] = p.color;
      }

      // Check each user who has 2+ allocations
      for (const [userId, userAllocs] of Object.entries(allocsByUser)) {
        if (userAllocs.length < 2) continue;

        const userObj = userAllocs[0].user;
        const dailyCapacity = getEffectiveWeeklyCapacity(userObj) / 5;
        const userName = userObj.firstName && userObj.lastName
          ? `${userObj.firstName} ${userObj.lastName}`
          : userObj.firstName || "Unknown";

        // Find date range that covers all allocations
        const rangeStart = new Date(startDate);
        const rangeEnd = new Date(endDate);
        const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

        for (const day of days) {
          if (isWeekend(day)) continue;

          const dayStr = format(day, "yyyy-MM-dd");
          const activeAllocs = userAllocs.filter((a) => {
            const aStart = format(a.startDate, "yyyy-MM-dd");
            const aEnd = format(a.endDate, "yyyy-MM-dd");
            return dayStr >= aStart && dayStr <= aEnd;
          });

          if (activeAllocs.length < 2) continue;

          const totalHours = activeAllocs.reduce((sum, a) => sum + a.hoursPerDay, 0);
          if (totalHours <= dailyCapacity) continue;

          conflicts.push({
            userId,
            userName,
            date: dayStr,
            totalHours,
            dailyCapacity,
            projects: activeAllocs.map((a) => ({
              projectId: a.projectId,
              projectName: projectNameMap[a.projectId] || "Unknown",
              projectColor: projectColorMap[a.projectId] || "#888",
              hours: a.hoursPerDay,
            })),
          });
        }
      }

      // Consolidate consecutive days with same user+projects into ranges
      conflicts = consolidateConflicts(conflicts);
    }

    // Build response
    const enrichedProjects = projects.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      client: p.client,
      startDate: p.startDate ? format(p.startDate, "yyyy-MM-dd") : null,
      endDate: p.endDate ? format(p.endDate, "yyyy-MM-dd") : null,
      budgetHours: p.budgetHours,
      hoursUsed: hoursMap[p.id] || 0,
      archived: p.archived,
      locked: p.locked,
      currentPhase: p.currentPhase,
      activityCount: activityCountMap[p.id] || 0,
      activityCompletedCount: activityCompletedMap[p.id] || 0,
      ...(includePhases && p.projectPhases && {
        projectPhases: p.projectPhases.map((pp) => ({
          id: pp.id,
          phaseId: pp.phaseId,
          phaseName: pp.phase.name,
          phaseColor: pp.phase.color,
          startDate: format(pp.startDate, "yyyy-MM-dd"),
          endDate: format(pp.endDate, "yyyy-MM-dd"),
          status: pp.status,
        })),
      }),
      ...(includeAllocations && {
        allocations: allocationsByProject[p.id] || [],
      }),
      ...(includeBurndown && {
        burndown: burndownByProject[p.id] || [],
      }),
    }));

    // Extract all milestones
    const allMilestones = projects.flatMap((p) =>
      p.milestones.map((m) => ({
        id: m.id,
        projectId: m.projectId,
        title: m.title,
        dueDate: format(m.dueDate, "yyyy-MM-dd"),
        completed: m.completed,
        completedAt: m.completedAt ? m.completedAt.toISOString() : null,
        sortOrder: m.sortOrder,
      }))
    );

    return NextResponse.json({
      projects: enrichedProjects,
      milestones: allMilestones,
      phases: companyPhases,
      ...(includeConflicts && { conflicts }),
    });
  } catch (error) {
    console.error("[TIMELINE_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Consolidate consecutive-day conflicts for the same user+project set into single entries
function consolidateConflicts(
  conflicts: Array<{
    userId: string;
    userName: string;
    date: string;
    totalHours: number;
    dailyCapacity: number;
    projects: Array<{ projectId: string; projectName: string; projectColor: string; hours: number }>;
  }>
) {
  if (conflicts.length === 0) return conflicts;

  // Group by userId + project set
  const grouped: Record<string, typeof conflicts> = {};
  for (const c of conflicts) {
    const key = c.userId + "|" + c.projects.map((p) => p.projectId).sort().join(",");
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(c);
  }

  // For each group, just keep one representative entry per unique date
  // (don't over-consolidate — keep individual days so the panel can show date ranges)
  const result: typeof conflicts = [];
  for (const entries of Object.values(grouped)) {
    // Sort by date and take unique dates
    const sorted = entries.sort((a, b) => a.date.localeCompare(b.date));
    const seen = new Set<string>();
    for (const entry of sorted) {
      if (!seen.has(entry.date)) {
        seen.add(entry.date);
        result.push(entry);
      }
    }
  }

  return result;
}
