import { db } from "@/lib/db";

// Types for the insight data package
export interface TeamMember {
  id: string;
  name: string;
  weeklyTarget: number;
  vacationDays: number;
  avgHoursLast4Weeks: number;
  utilizationPercent: number;
  totalHoursLast30Days: number;
}

export interface WeeklyUserHours {
  userId: string;
  userName: string;
  weekStart: string;
  hours: number;
  weeklyTarget: number;
}

export interface ProjectHealth {
  id: string;
  name: string;
  budgetHours: number | null;
  hoursUsed: number;
  percentUsed: number | null;
  weeklyBurnRate: number;
  teamMembers: { name: string; hours: number; percent: number }[];
}

export interface UpcomingVacation {
  userName: string;
  startDate: string;
  endDate: string;
  type: string;
  businessDays: number;
}

export interface ContractSummary {
  projectName: string;
  maxHours: number | null;
  maxBudget: number | null;
  deadline: string | null;
  scope: string | null;
  hoursUsed: number;
}

export interface ResourceAllocationSummary {
  userName: string;
  projectName: string;
  startDate: string;
  endDate: string;
  hoursPerDay: number;
  status: string;
}

export interface CapacityForecast {
  date: string;
  totalAllocatedHours: number;
  totalCapacityHours: number;
  utilizationPercent: number;
  overbookedUsers: string[];
  underbookedUsers: string[];
}

export interface InsightDataPackage {
  company: {
    id: string;
    name: string;
    currency: string;
  };
  team: {
    members: TeamMember[];
    totalCapacityHoursWeekly: number;
  };
  workloadMetrics: {
    weeklyHoursByUser: WeeklyUserHours[];
    usersOverworked: { name: string; avgHours: number; weeksOver40: number }[];
    usersUnderutilized: { name: string; avgUtilization: number }[];
    weekendWorkers: { name: string; weekendDays: number }[];
  };
  vacations: {
    upcoming: UpcomingVacation[];
    capacityReductions: { date: string; availablePercent: number }[];
  };
  projects: {
    active: ProjectHealth[];
    singlePersonRisks: { projectName: string; userName: string; percentOfWork: number }[];
  };
  productivity: {
    billablePercentByWeek: { weekStart: string; billablePercent: number }[];
    pendingApprovals: number;
    usersWithEntryGaps: { name: string; missedDays: number }[];
  };
  contracts: ContractSummary[];
  resourcePlanning: {
    allocations: ResourceAllocationSummary[];
    capacityForecast: CapacityForecast[];
    unassignedUsers: { name: string; weeklyTarget: number; availableHours: number }[];
    understaffedProjects: { projectName: string; allocatedHours: number; estimatedNeed: number }[];
  };
}

// Helper functions
function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function getBusinessDaysBetween(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    if (!isWeekend(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export async function gatherInsightData(companyId: string): Promise<InsightDataPackage> {
  const now = new Date();

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const fourWeeksAgo = new Date(now);
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  const fiveDaysAgo = new Date(now);
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

  const twoWeeksAhead = new Date(now);
  twoWeeksAhead.setDate(twoWeeksAhead.getDate() + 14);

  const fourWeeksAhead = new Date(now);
  fourWeeksAhead.setDate(fourWeeksAhead.getDate() + 28);

  // Parallel queries for all data
  const [
    company,
    users,
    timeEntries,
    upcomingVacations,
    approvedVacationsThisYear,
    projects,
    projectTotalHours,
    contracts,
    pendingApprovals,
    resourceAllocations,
  ] = await Promise.all([
    db.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, currency: true },
    }),
    db.user.findMany({
      where: { companyId, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        weeklyTarget: true,
        vacationDays: true,
      },
    }),
    db.timeEntry.findMany({
      where: { companyId, date: { gte: thirtyDaysAgo } },
      select: {
        id: true,
        hours: true,
        date: true,
        userId: true,
        projectId: true,
        billingStatus: true,
        user: { select: { firstName: true, lastName: true } },
        project: { select: { id: true, name: true, budgetHours: true } },
      },
    }),
    db.vacationRequest.findMany({
      where: {
        companyId,
        status: "approved",
        startDate: { lte: twoWeeksAhead },
        endDate: { gte: now },
      },
      select: {
        startDate: true,
        endDate: true,
        type: true,
        user: { select: { firstName: true, lastName: true } },
      },
    }),
    db.vacationRequest.findMany({
      where: {
        companyId,
        status: "approved",
        startDate: { gte: new Date(now.getFullYear(), 0, 1) },
      },
      select: {
        userId: true,
        startDate: true,
        endDate: true,
      },
    }),
    db.project.findMany({
      where: { companyId, active: true, systemManaged: false },
      select: {
        id: true,
        name: true,
        budgetHours: true,
        timeEntries: {
          where: { date: { gte: thirtyDaysAgo } },
          select: {
            hours: true,
            date: true,
            userId: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    // Get ALL-TIME billable+included hours per project for accurate budget tracking
    // This matches how the admin panel calculates budget usage
    db.timeEntry.groupBy({
      by: ["projectId"],
      where: {
        companyId,
        billingStatus: { in: ["billable", "included"] },
      },
      _sum: { hours: true },
    }),
    db.contract.findMany({
      where: {
        project: { companyId },
        extractedAt: { not: null },
      },
      include: {
        project: {
          include: {
            timeEntries: {
              where: { date: { gte: thirtyDaysAgo } },
              select: { hours: true },
            },
          },
        },
      },
    }),
    db.timeEntry.count({
      where: { companyId, approvalStatus: "submitted" },
    }),
    // Resource allocations for next 4 weeks
    db.resourceAllocation.findMany({
      where: {
        companyId,
        endDate: { gte: now },
        startDate: { lte: fourWeeksAhead },
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, weeklyTarget: true } },
        project: { select: { id: true, name: true } },
      },
    }),
  ]);

  if (!company) {
    throw new Error(`Company ${companyId} not found`);
  }

  // Process team members
  const userHoursMap = new Map<string, number>();
  const userWeeklyHours = new Map<string, Map<string, number>>();
  const userWeekendDays = new Map<string, Set<string>>();
  const userEntryDates = new Map<string, Set<string>>();

  for (const entry of timeEntries) {
    const userId = entry.userId;
    const weekStart = getWeekStart(entry.date);
    const dateStr = entry.date.toISOString().split("T")[0];

    // Total hours
    userHoursMap.set(userId, (userHoursMap.get(userId) || 0) + entry.hours);

    // Weekly hours
    if (!userWeeklyHours.has(userId)) {
      userWeeklyHours.set(userId, new Map());
    }
    const weekMap = userWeeklyHours.get(userId)!;
    weekMap.set(weekStart, (weekMap.get(weekStart) || 0) + entry.hours);

    // Weekend work tracking
    if (isWeekend(entry.date)) {
      if (!userWeekendDays.has(userId)) {
        userWeekendDays.set(userId, new Set());
      }
      userWeekendDays.get(userId)!.add(dateStr);
    }

    // Entry dates tracking
    if (!userEntryDates.has(userId)) {
      userEntryDates.set(userId, new Set());
    }
    userEntryDates.get(userId)!.add(dateStr);
  }

  // Build team members
  const teamMembers: TeamMember[] = users.map((user) => {
    const totalHours = userHoursMap.get(user.id) || 0;
    const weeklyHoursMap = userWeeklyHours.get(user.id) || new Map();
    const weekCount = Math.max(weeklyHoursMap.size, 1);
    const avgHours = totalHours / weekCount;
    const utilizationPercent = (avgHours / user.weeklyTarget) * 100;

    return {
      id: user.id,
      name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown",
      weeklyTarget: user.weeklyTarget,
      vacationDays: user.vacationDays,
      avgHoursLast4Weeks: Math.round(avgHours * 10) / 10,
      utilizationPercent: Math.round(utilizationPercent),
      totalHoursLast30Days: Math.round(totalHours * 10) / 10,
    };
  });

  // Build weekly hours by user
  const weeklyHoursByUser: WeeklyUserHours[] = [];
  for (const user of users) {
    const weekMap = userWeeklyHours.get(user.id) || new Map();
    const userName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown";
    for (const [weekStart, hours] of Array.from(weekMap.entries())) {
      weeklyHoursByUser.push({
        userId: user.id,
        userName,
        weekStart,
        hours,
        weeklyTarget: user.weeklyTarget,
      });
    }
  }

  // Detect overworked users (3+ weeks over 40h)
  const usersOverworked: { name: string; avgHours: number; weeksOver40: number }[] = [];
  for (const user of users) {
    const weekMap = userWeeklyHours.get(user.id) || new Map();
    const weeksOver40 = Array.from(weekMap.values()).filter((h) => h > 40).length;
    if (weeksOver40 >= 3) {
      const avgHours = Array.from(weekMap.values()).reduce((a, b) => a + b, 0) / weekMap.size;
      usersOverworked.push({
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        avgHours: Math.round(avgHours * 10) / 10,
        weeksOver40,
      });
    }
  }

  // Detect underutilized users (<70% for 3+ weeks)
  const usersUnderutilized: { name: string; avgUtilization: number }[] = [];
  for (const member of teamMembers) {
    if (member.utilizationPercent < 70 && (userWeeklyHours.get(member.id)?.size || 0) >= 3) {
      usersUnderutilized.push({
        name: member.name,
        avgUtilization: member.utilizationPercent,
      });
    }
  }

  // Detect weekend workers
  const weekendWorkers: { name: string; weekendDays: number }[] = [];
  for (const user of users) {
    const weekendDays = userWeekendDays.get(user.id)?.size || 0;
    if (weekendDays >= 3) {
      weekendWorkers.push({
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        weekendDays,
      });
    }
  }

  // Detect entry gaps (missed 3+ of last 5 business days)
  const usersWithEntryGaps: { name: string; missedDays: number }[] = [];
  for (const user of users) {
    const entryDates = userEntryDates.get(user.id) || new Set();
    let missedDays = 0;
    const checkDate = new Date(fiveDaysAgo);
    while (checkDate <= now) {
      if (!isWeekend(checkDate)) {
        const dateStr = checkDate.toISOString().split("T")[0];
        if (!entryDates.has(dateStr)) {
          missedDays++;
        }
      }
      checkDate.setDate(checkDate.getDate() + 1);
    }
    if (missedDays >= 3) {
      usersWithEntryGaps.push({
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        missedDays,
      });
    }
  }

  // Process vacations
  const upcomingVacationsList: UpcomingVacation[] = upcomingVacations.map((v) => ({
    userName: `${v.user.firstName || ""} ${v.user.lastName || ""}`.trim(),
    startDate: v.startDate.toISOString().split("T")[0],
    endDate: v.endDate.toISOString().split("T")[0],
    type: v.type,
    businessDays: getBusinessDaysBetween(v.startDate, v.endDate),
  }));

  // Calculate capacity reductions for next 14 days
  const capacityReductions: { date: string; availablePercent: number }[] = [];
  const checkDate = new Date(now);
  while (checkDate <= twoWeeksAhead) {
    if (!isWeekend(checkDate)) {
      const onVacation = upcomingVacations.filter(
        (v) => v.startDate <= checkDate && v.endDate >= checkDate
      ).length;
      const availablePercent = users.length > 0
        ? Math.round(((users.length - onVacation) / users.length) * 100)
        : 100;
      if (availablePercent < 80) {
        capacityReductions.push({
          date: checkDate.toISOString().split("T")[0],
          availablePercent,
        });
      }
    }
    checkDate.setDate(checkDate.getDate() + 1);
  }

  // Build map of all-time project hours for budget tracking
  const projectTotalHoursMap = new Map<string, number>();
  for (const entry of projectTotalHours) {
    projectTotalHoursMap.set(entry.projectId, entry._sum.hours || 0);
  }

  // Process projects
  const activeProjects: ProjectHealth[] = projects.map((project) => {
    // Use ALL-TIME hours for budget tracking (matches admin panel)
    const hoursUsed = projectTotalHoursMap.get(project.id) || 0;
    const percentUsed = project.budgetHours
      ? Math.round((hoursUsed / project.budgetHours) * 100)
      : null;

    // Calculate weekly burn rate from last 30 days
    const weeklyHours = new Map<string, number>();
    for (const entry of project.timeEntries) {
      const weekStart = getWeekStart(entry.date);
      weeklyHours.set(weekStart, (weeklyHours.get(weekStart) || 0) + entry.hours);
    }
    const weeklyBurnRate = weeklyHours.size > 0
      ? Array.from(weeklyHours.values()).reduce((a, b) => a + b, 0) / weeklyHours.size
      : 0;

    // Team distribution (from last 30 days)
    const recentHours = project.timeEntries.reduce((sum, e) => sum + e.hours, 0);
    const memberHours = new Map<string, { name: string; hours: number }>();
    for (const entry of project.timeEntries) {
      const name = `${entry.user.firstName || ""} ${entry.user.lastName || ""}`.trim();
      const current = memberHours.get(entry.userId) || { name, hours: 0 };
      current.hours += entry.hours;
      memberHours.set(entry.userId, current);
    }
    const teamMembers = Array.from(memberHours.values())
      .map((m) => ({
        name: m.name,
        hours: Math.round(m.hours * 10) / 10,
        percent: recentHours > 0 ? Math.round((m.hours / recentHours) * 100) : 0,
      }))
      .sort((a, b) => b.hours - a.hours);

    return {
      id: project.id,
      name: project.name,
      budgetHours: project.budgetHours,
      hoursUsed: Math.round(hoursUsed * 10) / 10,
      percentUsed,
      weeklyBurnRate: Math.round(weeklyBurnRate * 10) / 10,
      teamMembers,
    };
  });

  // Detect single-person dependency risks
  const singlePersonRisks: { projectName: string; userName: string; percentOfWork: number }[] = [];
  for (const project of activeProjects) {
    if (project.hoursUsed >= 20 && project.teamMembers.length > 0) {
      const topMember = project.teamMembers[0];
      if (topMember.percent > 80) {
        singlePersonRisks.push({
          projectName: project.name,
          userName: topMember.name,
          percentOfWork: topMember.percent,
        });
      }
    }
  }

  // Calculate billable percent by week
  const billableByWeek = new Map<string, { billable: number; total: number }>();
  for (const entry of timeEntries) {
    const weekStart = getWeekStart(entry.date);
    const current = billableByWeek.get(weekStart) || { billable: 0, total: 0 };
    current.total += entry.hours;
    if (entry.billingStatus === "billable") {
      current.billable += entry.hours;
    }
    billableByWeek.set(weekStart, current);
  }
  const billablePercentByWeek = Array.from(billableByWeek.entries())
    .map(([weekStart, data]) => ({
      weekStart,
      billablePercent: data.total > 0 ? Math.round((data.billable / data.total) * 100) : 0,
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  // Process contracts (optional) - don't include hoursUsed here since it's in projects section
  const contractSummaries: ContractSummary[] = contracts.map((c) => ({
    projectName: c.project.name,
    maxHours: c.maxHours,
    maxBudget: c.maxBudget,
    deadline: c.deadline?.toISOString().split("T")[0] ?? null,
    scope: c.scopeDescription,
    hoursUsed: 0, // Hours are already tracked in projects.active
  }));

  // Process resource allocations
  const allocationSummaries: ResourceAllocationSummary[] = resourceAllocations.map((a) => ({
    userName: `${a.user.firstName || ""} ${a.user.lastName || ""}`.trim() || "Unknown",
    projectName: a.project.name,
    startDate: a.startDate.toISOString().split("T")[0],
    endDate: a.endDate.toISOString().split("T")[0],
    hoursPerDay: a.hoursPerDay,
    status: a.status,
  }));

  // Calculate capacity forecast for next 2 weeks
  const capacityForecast: CapacityForecast[] = [];
  const forecastDate = new Date(now);
  while (forecastDate <= twoWeeksAhead) {
    if (!isWeekend(forecastDate)) {
      const dateStr = forecastDate.toISOString().split("T")[0];
      const dateObj = new Date(forecastDate);

      // Calculate hours allocated per user on this day
      const userAllocations = new Map<string, { name: string; allocated: number; target: number }>();
      for (const user of users) {
        userAllocations.set(user.id, {
          name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown",
          allocated: 0,
          target: user.weeklyTarget / 5, // Daily target
        });
      }

      for (const alloc of resourceAllocations) {
        if (alloc.startDate <= dateObj && alloc.endDate >= dateObj) {
          const userAlloc = userAllocations.get(alloc.userId);
          if (userAlloc) {
            userAlloc.allocated += alloc.hoursPerDay;
          }
        }
      }

      let totalAllocated = 0;
      let totalCapacity = 0;
      const overbookedUsers: string[] = [];
      const underbookedUsers: string[] = [];

      for (const [, data] of Array.from(userAllocations.entries())) {
        totalAllocated += data.allocated;
        totalCapacity += data.target;
        if (data.allocated > data.target) {
          overbookedUsers.push(data.name);
        } else if (data.allocated < data.target * 0.5 && data.target > 0) {
          underbookedUsers.push(data.name);
        }
      }

      const utilizationPercent = totalCapacity > 0
        ? Math.round((totalAllocated / totalCapacity) * 100)
        : 0;

      // Only include days with notable data
      if (overbookedUsers.length > 0 || underbookedUsers.length > 0 || utilizationPercent < 50 || utilizationPercent > 100) {
        capacityForecast.push({
          date: dateStr,
          totalAllocatedHours: Math.round(totalAllocated * 10) / 10,
          totalCapacityHours: Math.round(totalCapacity * 10) / 10,
          utilizationPercent,
          overbookedUsers,
          underbookedUsers,
        });
      }
    }
    forecastDate.setDate(forecastDate.getDate() + 1);
  }

  // Find users with low allocation (available capacity)
  const unassignedUsers: { name: string; weeklyTarget: number; availableHours: number }[] = [];
  for (const user of users) {
    const userName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown";
    let allocatedThisWeek = 0;

    // Sum allocations for current week
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 4); // Friday

    for (const alloc of resourceAllocations) {
      if (alloc.userId === user.id) {
        // Count overlapping days this week
        const allocStart = new Date(alloc.startDate);
        const allocEnd = new Date(alloc.endDate);
        const overlapStart = allocStart > weekStart ? allocStart : weekStart;
        const overlapEnd = allocEnd < weekEnd ? allocEnd : weekEnd;

        if (overlapStart <= overlapEnd) {
          const days = getBusinessDaysBetween(overlapStart, overlapEnd);
          allocatedThisWeek += days * alloc.hoursPerDay;
        }
      }
    }

    const availableHours = user.weeklyTarget - allocatedThisWeek;
    if (availableHours > user.weeklyTarget * 0.5) { // More than 50% capacity available
      unassignedUsers.push({
        name: userName,
        weeklyTarget: user.weeklyTarget,
        availableHours: Math.round(availableHours * 10) / 10,
      });
    }
  }

  // Find projects that might need more resources (based on burn rate vs allocation)
  const understaffedProjects: { projectName: string; allocatedHours: number; estimatedNeed: number }[] = [];
  for (const project of activeProjects) {
    if (project.weeklyBurnRate > 0) {
      // Calculate current weekly allocation for this project
      let weeklyAllocation = 0;
      for (const alloc of resourceAllocations) {
        if (alloc.projectId === project.id) {
          weeklyAllocation += alloc.hoursPerDay * 5; // Assuming 5 work days
        }
      }

      // If allocation is less than 70% of burn rate, flag it
      if (weeklyAllocation < project.weeklyBurnRate * 0.7 && project.weeklyBurnRate > 10) {
        understaffedProjects.push({
          projectName: project.name,
          allocatedHours: Math.round(weeklyAllocation * 10) / 10,
          estimatedNeed: Math.round(project.weeklyBurnRate * 10) / 10,
        });
      }
    }
  }

  return {
    company: {
      id: company.id,
      name: company.name,
      currency: company.currency,
    },
    team: {
      members: teamMembers,
      totalCapacityHoursWeekly: teamMembers.reduce((sum, m) => sum + m.weeklyTarget, 0),
    },
    workloadMetrics: {
      weeklyHoursByUser,
      usersOverworked,
      usersUnderutilized,
      weekendWorkers,
    },
    vacations: {
      upcoming: upcomingVacationsList,
      capacityReductions,
    },
    projects: {
      active: activeProjects,
      singlePersonRisks,
    },
    productivity: {
      billablePercentByWeek,
      pendingApprovals,
      usersWithEntryGaps,
    },
    contracts: contractSummaries,
    resourcePlanning: {
      allocations: allocationSummaries,
      capacityForecast,
      unassignedUsers,
      understaffedProjects,
    },
  };
}
