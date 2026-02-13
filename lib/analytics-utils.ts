import { format, startOfMonth, eachMonthOfInterval, eachWeekOfInterval, startOfWeek, differenceInDays } from "date-fns";
import { getEffectiveWeeklyCapacity } from "@/lib/calculations";

// --- Types ---

interface Entry {
  id: string;
  hours: number;
  date: string | Date;
  billingStatus: string;
  approvalStatus: string;
  userId: string;
  projectId: string;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    hourlyRate: number;
    costRate: number;
    weeklyTarget: number;
  };
  project: {
    id: string;
    name: string;
    client: string | null;
    color: string;
    billable: boolean;
    budgetHours: number | null;
  };
}

interface Member {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  hourlyRate: number;
  costRate: number;
  weeklyTarget: number;
}

interface Project {
  id: string;
  name: string;
  client: string | null;
  color: string;
  billable: boolean;
  budgetHours: number | null;
}

// --- Helpers ---

function memberName(m: { firstName: string | null; lastName: string | null; email: string }) {
  const name = `${m.firstName || ""} ${m.lastName || ""}`.trim();
  return name || m.email;
}

function periodKey(date: Date | string, granularity: "monthly" | "weekly"): string {
  const d = new Date(date);
  if (granularity === "weekly") {
    const w = startOfWeek(d, { weekStartsOn: 1 });
    return format(w, "yyyy-MM-dd");
  }
  return format(startOfMonth(d), "yyyy-MM");
}

function periodLabel(key: string, granularity: "monthly" | "weekly"): string {
  if (granularity === "weekly") {
    return format(new Date(key), "MMM d");
  }
  return format(new Date(key + "-01"), "MMM yyyy");
}

function getPeriodKeys(from: Date, to: Date, granularity: "monthly" | "weekly"): string[] {
  if (granularity === "weekly") {
    return eachWeekOfInterval({ start: from, end: to }, { weekStartsOn: 1 }).map(
      (d) => format(d, "yyyy-MM-dd")
    );
  }
  return eachMonthOfInterval({ start: from, end: to }).map(
    (d) => format(d, "yyyy-MM")
  );
}

function weeksInPeriod(periodKeyStr: string, granularity: "monthly" | "weekly"): number {
  if (granularity === "weekly") return 1;
  // Approximate weeks in a month
  const d = new Date(periodKeyStr + "-01");
  const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const days = differenceInDays(nextMonth, d);
  return days / 7;
}

// --- Employee Insights ---

export function aggregateEmployeeTimeDistribution(entries: Entry[]) {
  const groups: Record<string, number> = {};
  for (const e of entries) {
    const key = e.billingStatus;
    groups[key] = (groups[key] || 0) + e.hours;
  }
  return Object.entries(groups).map(([status, hours]) => ({
    status,
    hours: Math.round(hours * 10) / 10,
  }));
}

export function aggregateEmployeeUtilizationTrend(
  entries: Entry[],
  member: Member,
  from: Date,
  to: Date,
  granularity: "monthly" | "weekly"
) {
  const periods = getPeriodKeys(from, to, granularity);
  const grouped: Record<string, Entry[]> = {};
  for (const e of entries) {
    const key = periodKey(e.date, granularity);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  }

  return periods.map((key) => {
    const periodEntries = grouped[key] || [];
    const totalHours = periodEntries.reduce((s, e) => s + e.hours, 0);
    const billableHours = periodEntries
      .filter((e) => e.billingStatus === "billable")
      .reduce((s, e) => s + e.hours, 0);
    const weeks = weeksInPeriod(key, granularity);
    const expected = getEffectiveWeeklyCapacity(member) * weeks;

    return {
      period: periodLabel(key, granularity),
      billableUtil: expected > 0 ? Math.round((billableHours / expected) * 1000) / 10 : 0,
      totalUtil: expected > 0 ? Math.round((totalHours / expected) * 1000) / 10 : 0,
      target: 100,
    };
  });
}

export function aggregateEmployeeProfitability(
  entries: Entry[],
  member: Member,
  from: Date,
  to: Date,
  granularity: "monthly" | "weekly"
) {
  const periods = getPeriodKeys(from, to, granularity);
  const grouped: Record<string, Entry[]> = {};
  for (const e of entries) {
    const key = periodKey(e.date, granularity);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  }

  return periods.map((key) => {
    const periodEntries = grouped[key] || [];
    const billableHours = periodEntries
      .filter((e) => e.billingStatus === "billable")
      .reduce((s, e) => s + e.hours, 0);
    const totalHours = periodEntries.reduce((s, e) => s + e.hours, 0);
    const revenue = Math.round(billableHours * member.hourlyRate);
    const cost = Math.round(totalHours * member.costRate);

    return {
      period: periodLabel(key, granularity),
      revenue,
      cost,
      profit: revenue - cost,
    };
  });
}

// --- Team Insights ---

export function aggregateTeamUtilization(
  entries: Entry[],
  members: Member[],
  from: Date,
  to: Date,
  granularity: "monthly" | "weekly"
) {
  const periods = getPeriodKeys(from, to, granularity);
  const totalWeeks = periods.reduce((s, k) => s + weeksInPeriod(k, granularity), 0);

  return members.map((member) => {
    const memberEntries = entries.filter((e) => e.userId === member.id);
    const totalHours = memberEntries.reduce((s, e) => s + e.hours, 0);
    const billableHours = memberEntries
      .filter((e) => e.billingStatus === "billable")
      .reduce((s, e) => s + e.hours, 0);
    const expected = getEffectiveWeeklyCapacity(member) * totalWeeks;

    return {
      name: memberName(member),
      billableUtil: expected > 0 ? Math.round((billableHours / expected) * 1000) / 10 : 0,
      totalUtil: expected > 0 ? Math.round((totalHours / expected) * 1000) / 10 : 0,
    };
  });
}

export function aggregateTeamProfitability(entries: Entry[], members: Member[]) {
  return members.map((member) => {
    const memberEntries = entries.filter((e) => e.userId === member.id);
    const billableHours = memberEntries
      .filter((e) => e.billingStatus === "billable")
      .reduce((s, e) => s + e.hours, 0);
    const totalHours = memberEntries.reduce((s, e) => s + e.hours, 0);
    const revenue = Math.round(billableHours * member.hourlyRate);
    const cost = Math.round(totalHours * member.costRate);
    const margin = revenue > 0 ? Math.round(((revenue - cost) / revenue) * 1000) / 10 : 0;

    return {
      name: memberName(member),
      revenue,
      cost,
      margin,
    };
  });
}

export function aggregateTeamTimeMix(entries: Entry[], members: Member[]) {
  return members.map((member) => {
    const memberEntries = entries.filter((e) => e.userId === member.id);
    const mix: Record<string, number> = {
      billable: 0,
      included: 0,
      non_billable: 0,
      internal: 0,
      presales: 0,
    };
    for (const e of memberEntries) {
      mix[e.billingStatus] = (mix[e.billingStatus] || 0) + e.hours;
    }

    return {
      name: memberName(member),
      billable: Math.round(mix.billable * 10) / 10,
      included: Math.round(mix.included * 10) / 10,
      non_billable: Math.round(mix.non_billable * 10) / 10,
      internal: Math.round(mix.internal * 10) / 10,
      presales: Math.round(mix.presales * 10) / 10,
    };
  });
}

// --- Project Insights ---

export function aggregateProjectBurndown(
  entries: Entry[],
  project: Project,
  from: Date,
  to: Date,
  granularity: "monthly" | "weekly"
) {
  if (!project.budgetHours) return [];

  const periods = getPeriodKeys(from, to, granularity);
  const projectEntries = entries
    .filter((e) => e.projectId === project.id)
    .filter((e) => e.billingStatus === "billable" || e.billingStatus === "included");

  const grouped: Record<string, number> = {};
  for (const e of projectEntries) {
    const key = periodKey(e.date, granularity);
    grouped[key] = (grouped[key] || 0) + e.hours;
  }

  let cumulative = 0;
  const idealStep = project.budgetHours / Math.max(periods.length, 1);

  return periods.map((key, i) => {
    cumulative += grouped[key] || 0;
    return {
      period: periodLabel(key, granularity),
      hoursUsed: Math.round(cumulative * 10) / 10,
      hoursRemaining: Math.round((project.budgetHours! - cumulative) * 10) / 10,
      idealBurn: Math.round((project.budgetHours! - idealStep * (i + 1)) * 10) / 10,
    };
  });
}

export function aggregateProjectProfitability(
  entries: Entry[],
  projectId: string,
  from: Date,
  to: Date,
  granularity: "monthly" | "weekly",
  estimatedNonBillableMap?: Record<string, number>
) {
  const periods = getPeriodKeys(from, to, granularity);
  const projectEntries = entries.filter((e) => e.projectId === projectId);
  const nbPercent = estimatedNonBillableMap?.[projectId] || 0;

  const grouped: Record<string, Entry[]> = {};
  for (const e of projectEntries) {
    const key = periodKey(e.date, granularity);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  }

  return periods.map((key) => {
    const periodEntries = grouped[key] || [];
    const revenue = periodEntries
      .filter((e) => e.billingStatus === "billable")
      .reduce((s, e) => s + Math.round(e.hours * e.user.hourlyRate), 0);
    const baseCost = periodEntries.reduce(
      (s, e) => s + Math.round(e.hours * e.user.costRate),
      0
    );

    // Add estimated non-billable cost: nbPercent% of billable hours at cost rate
    let estimatedNbCost = 0;
    if (nbPercent > 0) {
      const billableHours = periodEntries
        .filter((e) => e.billingStatus === "billable")
        .reduce((s, e) => s + e.hours, 0);
      const avgCostRate = periodEntries.length > 0
        ? periodEntries.reduce((s, e) => s + e.user.costRate, 0) / periodEntries.length
        : 0;
      estimatedNbCost = Math.round(billableHours * (nbPercent / 100) * avgCostRate);
    }

    const cost = baseCost + estimatedNbCost;

    return {
      period: periodLabel(key, granularity),
      revenue,
      cost,
      profit: revenue - cost,
    };
  });
}

export function aggregateProjectBillableMix(
  entries: Entry[],
  projects: Project[],
  estimatedNonBillableMap?: Record<string, number>
) {
  return projects.map((project) => {
    const projectEntries = entries.filter((e) => e.projectId === project.id);
    const mix: Record<string, number> = {
      billable: 0,
      included: 0,
      non_billable: 0,
      internal: 0,
      presales: 0,
    };
    for (const e of projectEntries) {
      mix[e.billingStatus] = (mix[e.billingStatus] || 0) + e.hours;
    }

    // Add estimated non-billable hours from billable hours
    const nbPercent = estimatedNonBillableMap?.[project.id] || 0;
    let estimatedNbHours = 0;
    if (nbPercent > 0) {
      estimatedNbHours = mix.billable * (nbPercent / 100);
      mix.non_billable += estimatedNbHours;
    }

    return {
      name: project.name,
      color: project.color,
      billable: Math.round(mix.billable * 10) / 10,
      included: Math.round(mix.included * 10) / 10,
      non_billable: Math.round(mix.non_billable * 10) / 10,
      internal: Math.round(mix.internal * 10) / 10,
      presales: Math.round(mix.presales * 10) / 10,
    };
  }).filter((p) => p.billable + p.included + p.non_billable + p.internal + p.presales > 0);
}

// --- Phase Analytics ---

interface PhaseEntry extends Entry {
  phaseName?: string | null;
}

export function aggregatePhaseDistribution(entries: PhaseEntry[]) {
  const groups: Record<string, { hours: number; revenue: number; cost: number }> = {};
  for (const e of entries) {
    const key = e.phaseName || "Unassigned";
    if (!groups[key]) groups[key] = { hours: 0, revenue: 0, cost: 0 };
    groups[key].hours += e.hours;
    if (e.billingStatus === "billable") {
      groups[key].revenue += e.hours * e.user.hourlyRate;
    }
    groups[key].cost += e.hours * e.user.costRate;
  }
  return Object.entries(groups).map(([phaseName, data]) => ({
    phaseName,
    hours: Math.round(data.hours * 10) / 10,
    revenue: Math.round(data.revenue),
    cost: Math.round(data.cost),
    margin: data.revenue > 0 ? Math.round(((data.revenue - data.cost) / data.revenue) * 1000) / 10 : 0,
  }));
}

export function aggregatePhaseVelocity(
  entries: PhaseEntry[],
  from: Date,
  to: Date,
  granularity: "monthly" | "weekly"
) {
  const periods = getPeriodKeys(from, to, granularity);
  const phaseNames = new Set<string>();
  const grouped: Record<string, Record<string, number>> = {};

  for (const e of entries) {
    const pName = e.phaseName || "Unassigned";
    phaseNames.add(pName);
    const key = periodKey(e.date, granularity);
    if (!grouped[key]) grouped[key] = {};
    grouped[key][pName] = (grouped[key][pName] || 0) + e.hours;
  }

  return periods.map((key) => {
    const result: Record<string, unknown> = { period: periodLabel(key, granularity) };
    for (const pName of Array.from(phaseNames)) {
      result[pName] = Math.round((grouped[key]?.[pName] || 0) * 10) / 10;
    }
    return result;
  });
}

// --- Expense types for analytics ---

interface ExpenseEntry {
  amount: number;
  date: string | Date;
  category: string;
  description: string;
}

// --- Company Insights ---

export function aggregateCompanyRevenueOverhead(
  entries: Entry[],
  from: Date,
  to: Date,
  granularity: "monthly" | "weekly",
  projectExpenses: ExpenseEntry[] = [],
  companyExpenses: ExpenseEntry[] = [],
  estimatedNonBillableMap?: Record<string, number>
) {
  const periods = getPeriodKeys(from, to, granularity);
  const grouped: Record<string, Entry[]> = {};
  for (const e of entries) {
    const key = periodKey(e.date, granularity);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  }

  // Group expenses by period
  const projExpByPeriod: Record<string, number> = {};
  for (const e of projectExpenses) {
    const key = periodKey(e.date, granularity);
    projExpByPeriod[key] = (projExpByPeriod[key] || 0) + e.amount;
  }
  const compExpByPeriod: Record<string, number> = {};
  for (const e of companyExpenses) {
    const key = periodKey(e.date, granularity);
    compExpByPeriod[key] = (compExpByPeriod[key] || 0) + e.amount;
  }

  return periods.map((key) => {
    const periodEntries = grouped[key] || [];
    const revenue = periodEntries
      .filter((e) => e.billingStatus === "billable")
      .reduce((s, e) => s + Math.round(e.hours * e.user.hourlyRate), 0);
    const laborCost = periodEntries.reduce(
      (s, e) => s + Math.round(e.hours * e.user.costRate),
      0
    );
    const laborOverhead = periodEntries
      .filter((e) => e.billingStatus !== "billable")
      .reduce((s, e) => s + Math.round(e.hours * e.user.costRate), 0);

    // Add estimated non-billable overhead from project estimates
    let estimatedNbOverhead = 0;
    if (estimatedNonBillableMap) {
      const byProject: Record<string, { billableHours: number; avgCostRate: number; count: number }> = {};
      for (const e of periodEntries) {
        if (e.billingStatus === "billable" && estimatedNonBillableMap[e.projectId]) {
          if (!byProject[e.projectId]) byProject[e.projectId] = { billableHours: 0, avgCostRate: 0, count: 0 };
          byProject[e.projectId].billableHours += e.hours;
          byProject[e.projectId].avgCostRate += e.user.costRate;
          byProject[e.projectId].count += 1;
        }
      }
      Object.entries(byProject).forEach(([pid, data]) => {
        const pct = estimatedNonBillableMap[pid] || 0;
        const avgRate = data.count > 0 ? data.avgCostRate / data.count : 0;
        estimatedNbOverhead += Math.round(data.billableHours * (pct / 100) * avgRate);
      });
    }

    const periodProjExp = Math.round((projExpByPeriod[key] || 0) * 100) / 100;
    const periodCompExp = Math.round((compExpByPeriod[key] || 0) * 100) / 100;
    const totalExpenses = periodProjExp + periodCompExp;
    const totalCost = laborCost + estimatedNbOverhead + totalExpenses;
    const overhead = laborOverhead + estimatedNbOverhead + totalExpenses;

    return {
      period: periodLabel(key, granularity),
      revenue,
      overhead,
      totalCost,
      contributionMargin: revenue - totalCost,
      projectExpenses: periodProjExp,
      companyExpenses: periodCompExp,
    };
  });
}

export function aggregateExpenseBreakdown(
  projectExpenses: ExpenseEntry[],
  companyExpenses: ExpenseEntry[],
  from: Date,
  to: Date,
  granularity: "monthly" | "weekly"
) {
  const periods = getPeriodKeys(from, to, granularity);

  const categories = [
    "travel",
    "materials",
    "software",
    "meals",
    "rent",
    "insurance",
    "utilities",
    "salaries",
    "other",
  ];

  const grouped: Record<string, Record<string, number>> = {};
  for (const key of periods) {
    grouped[key] = {};
    for (const cat of categories) {
      grouped[key][cat] = 0;
    }
  }

  for (const e of projectExpenses) {
    const key = periodKey(e.date, granularity);
    if (grouped[key]) {
      const cat = categories.includes(e.category) ? e.category : "other";
      grouped[key][cat] += e.amount;
    }
  }

  for (const e of companyExpenses) {
    const key = periodKey(e.date, granularity);
    if (grouped[key]) {
      const cat = categories.includes(e.category) ? e.category : "other";
      grouped[key][cat] += e.amount;
    }
  }

  return periods.map((key) => {
    const cats = grouped[key];
    const result: Record<string, any> = { period: periodLabel(key, granularity) };
    for (const cat of categories) {
      result[cat] = Math.round((cats[cat] || 0) * 100) / 100;
    }
    return result;
  });
}

export function aggregateNonBillableTrend(
  entries: Entry[],
  from: Date,
  to: Date,
  granularity: "monthly" | "weekly"
) {
  const periods = getPeriodKeys(from, to, granularity);
  const grouped: Record<string, Entry[]> = {};
  for (const e of entries) {
    const key = periodKey(e.date, granularity);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  }

  return periods.map((key) => {
    const periodEntries = grouped[key] || [];
    const total = periodEntries.reduce((s, e) => s + e.hours, 0);
    if (total === 0) {
      return { period: periodLabel(key, granularity), totalPercent: 0, internal: 0, presales: 0, nonBillable: 0 };
    }

    const internalHours = periodEntries.filter((e) => e.billingStatus === "internal").reduce((s, e) => s + e.hours, 0);
    const presalesHours = periodEntries.filter((e) => e.billingStatus === "presales").reduce((s, e) => s + e.hours, 0);
    const nbHours = periodEntries.filter((e) => e.billingStatus === "non_billable").reduce((s, e) => s + e.hours, 0);
    const allNonBillable = internalHours + presalesHours + nbHours;

    return {
      period: periodLabel(key, granularity),
      totalPercent: Math.round((allNonBillable / total) * 1000) / 10,
      internal: Math.round((internalHours / total) * 1000) / 10,
      presales: Math.round((presalesHours / total) * 1000) / 10,
      nonBillable: Math.round((nbHours / total) * 1000) / 10,
    };
  });
}

export function aggregateUnbilledWork(entries: Entry[]) {
  // Approved + billable but NOT locked = not yet invoiced
  const unbilled = entries.filter(
    (e) => e.billingStatus === "billable" && e.approvalStatus === "approved"
  );

  const byProject: Record<string, {
    projectName: string;
    entries: Entry[];
  }> = {};

  for (const e of unbilled) {
    if (!byProject[e.projectId]) {
      byProject[e.projectId] = { projectName: e.project.name, entries: [] };
    }
    byProject[e.projectId].entries.push(e);
  }

  return Object.values(byProject).map((group) => {
    const hours = group.entries.reduce((s, e) => s + e.hours, 0);
    const estimatedRevenue = group.entries.reduce(
      (s, e) => s + e.hours * e.user.hourlyRate,
      0
    );
    const dates = group.entries.map((e) => new Date(e.date).getTime());
    const oldestDate = new Date(Math.min(...dates));
    const ageInDays = differenceInDays(new Date(), oldestDate);

    return {
      projectName: group.projectName,
      hours: Math.round(hours * 10) / 10,
      estimatedRevenue: Math.round(estimatedRevenue),
      oldestEntryDate: format(oldestDate, "yyyy-MM-dd"),
      ageInDays,
      entryCount: group.entries.length,
    };
  }).sort((a, b) => b.estimatedRevenue - a.estimatedRevenue);
}

// --- Forecast ---

export function calculateForecast(
  data: { period: string; revenue: number; totalCost: number; contributionMargin: number }[],
  monthsForward: number
) {
  if (data.length < 3) return [];

  const last3 = data.slice(-3);
  const avgRevenue = Math.round(last3.reduce((s, d) => s + d.revenue, 0) / 3);
  const avgCost = Math.round(last3.reduce((s, d) => s + d.totalCost, 0) / 3);
  const avgMargin = avgRevenue - avgCost;

  const forecast = [];
  const lastDate = new Date(data[data.length - 1].period + " 01");

  for (let i = 1; i <= monthsForward; i++) {
    const d = new Date(lastDate.getFullYear(), lastDate.getMonth() + i, 1);
    forecast.push({
      period: format(d, "MMM yyyy"),
      revenue: avgRevenue,
      totalCost: avgCost,
      contributionMargin: avgMargin,
      isForecast: true,
    });
  }

  return forecast;
}
