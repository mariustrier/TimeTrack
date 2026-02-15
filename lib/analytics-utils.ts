import { format, startOfMonth, eachMonthOfInterval, eachWeekOfInterval, startOfWeek, differenceInDays, eachDayOfInterval, isWeekend, addWeeks } from "date-fns";
import { getEffectiveWeeklyCapacity } from "@/lib/calculations";
import { getToday } from "@/lib/demo-date";

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

function workingDaysInPeriod(periodKeyStr: string, granularity: "monthly" | "weekly"): number {
  const today = getToday();
  let start: Date, end: Date;
  if (granularity === "weekly") {
    const [y, m, d] = periodKeyStr.split("-").map(Number);
    start = new Date(y, m - 1, d);
    end = new Date(y, m - 1, d + 6);
  } else {
    const [y, m] = periodKeyStr.split("-").map(Number);
    start = new Date(y, m - 1, 1);
    end = new Date(y, m, 0); // last day of month
  }
  // Cap at today for partial periods
  if (end > today) end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (start > today) return 0;
  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return Math.max(count, 1);
}

function totalWorkingDays(from: Date, to: Date): number {
  const today = getToday();
  const cappedEnd = to > today ? today : to;
  const effectiveEnd = new Date(cappedEnd.getFullYear(), cappedEnd.getMonth(), cappedEnd.getDate());
  const effectiveStart = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  if (effectiveStart > effectiveEnd) return 1;
  let count = 0;
  const cursor = new Date(effectiveStart);
  while (cursor <= effectiveEnd) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return Math.max(count, 1);
}

// --- Employee Insights ---

const BILLING_STATUS_COLORS: Record<string, string> = {
  billable: "#10B981",
  included: "#6366F1",
  nonBillable: "#F59E0B",
  non_billable: "#F59E0B",
  internal: "#8B5CF6",
  presales: "#3B82F6",
};

export function aggregateEmployeeTimeDistribution(entries: Entry[]) {
  const groups: Record<string, number> = {};
  for (const e of entries) {
    const key = e.billingStatus;
    groups[key] = (groups[key] || 0) + e.hours;
  }
  return Object.entries(groups).map(([status, hours]) => ({
    status,
    hours: Math.round(hours * 10) / 10,
    fill: BILLING_STATUS_COLORS[status] || "#9CA3AF",
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
    const wd = workingDaysInPeriod(key, granularity);
    const expected = (getEffectiveWeeklyCapacity(member) / 5) * wd;

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
  const wd = totalWorkingDays(from, to);

  return members.map((member) => {
    const memberEntries = entries.filter((e) => e.userId === member.id);
    const totalHours = memberEntries.reduce((s, e) => s + e.hours, 0);
    const billableHours = memberEntries
      .filter((e) => e.billingStatus === "billable")
      .reduce((s, e) => s + e.hours, 0);
    const expected = (getEffectiveWeeklyCapacity(member) / 5) * wd;

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

export function aggregatePhaseDistribution(
  entries: PhaseEntry[],
  phaseColorMap?: Record<string, string>
) {
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
    name: phaseName,
    hours: Math.round(data.hours * 10) / 10,
    revenue: Math.round(data.revenue),
    cost: Math.round(data.cost),
    margin: data.revenue > 0 ? Math.round(((data.revenue - data.cost) / data.revenue) * 1000) / 10 : 0,
    color: phaseColorMap?.[phaseName] || DEFAULT_PHASE_COLOR,
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

export function aggregateUnbilledWork(entries: Entry[], today?: Date) {
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

  const now = today || getToday();

  return Object.values(byProject).map((group) => {
    const hours = group.entries.reduce((s, e) => s + e.hours, 0);
    const estimatedRevenue = group.entries.reduce(
      (s, e) => s + e.hours * e.user.hourlyRate,
      0
    );
    const dates = group.entries.map((e) => new Date(e.date).getTime());
    const oldestDate = new Date(Math.min(...dates));
    const ageInDays = differenceInDays(now, oldestDate);

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

// --- Current-period projection ---

/**
 * Adds `proj_*` fields to time-series chart data so the current (incomplete) period
 * shows a dotted projection line instead of dropping to 0.
 *
 * For the second-to-last data point: proj_* = actual value (connection point).
 * For the last data point: proj_* = actual / elapsed_ratio (projected full period).
 * All other points: proj_* fields are undefined (Recharts ignores them).
 *
 * Usage in Recharts: add `<Line dataKey="proj_revenue" strokeDasharray="6 3" ... />`
 */
export function withProjection<T extends object>(
  data: T[],
  today: Date,
  granularity: "monthly" | "weekly",
  numericKeys: string[]
): T[] {
  if (data.length < 2) return data;

  let ratio: number;
  if (granularity === "weekly") {
    const dow = today.getDay();
    ratio = (dow === 0 ? 5 : Math.min(dow, 5)) / 5;
  } else {
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    ratio = today.getDate() / daysInMonth;
  }

  if (ratio >= 0.95) return data; // Period almost complete, no projection needed

  const lastIdx = data.length - 1;
  const prevItem = data[lastIdx - 1] as Record<string, unknown>;
  const lastItem = data[lastIdx] as Record<string, unknown>;

  // Check if current period data is mostly empty (e.g. approved-only filter)
  // If so, use previous period's values as the projection instead
  const lastSum = numericKeys.reduce((s, k) => {
    const v = lastItem[k];
    return s + (typeof v === "number" ? Math.abs(v) : 0);
  }, 0);
  const prevSum = numericKeys.reduce((s, k) => {
    const v = prevItem[k];
    return s + (typeof v === "number" ? Math.abs(v) : 0);
  }, 0);
  const usePrevAsFallback = lastSum < prevSum * 0.1; // current < 10% of previous → likely empty

  return data.map((item, i) => {
    if (i === lastIdx - 1) {
      // Connection point: projected = actual (for dashed line start)
      const result = { ...item } as Record<string, unknown>;
      for (const key of numericKeys) {
        result[`proj_${key}`] = (item as Record<string, unknown>)[key];
      }
      return result as T;
    }
    if (i === lastIdx) {
      const result = { ...item } as Record<string, unknown>;
      for (const key of numericKeys) {
        if (usePrevAsFallback) {
          const prevVal = prevItem[key];
          if (typeof prevVal === "number") {
            result[`proj_${key}`] = prevVal;
          }
        } else {
          const val = (item as Record<string, unknown>)[key];
          if (typeof val === "number") {
            result[`proj_${key}`] = Math.round((val / ratio) * 10) / 10;
          }
        }
        // Hide actual value so solid line stops at previous month
        result[key] = null;
      }
      return result as T;
    }
    return item;
  });
}

// --- Extended Types for New Functions ---

interface MemberFull extends Member {
  isHourly: boolean;
  vacationDays: number;
  vacationTrackingUnit: string;
  vacationHoursPerYear: number | null;
}

interface ResourceAlloc {
  userId: string;
  startDate: Date;
  endDate: Date;
  hoursPerDay: number;
  status: string;
}

interface ProjectFull extends Project {
  startDate?: string | null;
  endDate?: string | null;
  rateMode: string;
  projectRate: number | null;
}

interface InvoiceData {
  status: string;
  totalAmount: number;
  invoiceDate: string;
}

interface InvoicedEntry {
  date: string;
  invoicedAt: string;
}

// --- Phase Color Map ---

const DEFAULT_PHASE_COLOR = "#94A3B8";

// --- Helper: working days in an interval ---

function workingDaysInInterval(start: Date, end: Date): number {
  if (start > end) return 0;
  const days = eachDayOfInterval({ start, end });
  return days.filter((d) => !isWeekend(d)).length;
}

// --- 1. Employee Phase Breakdown ---

export function aggregateEmployeePhaseBreakdown(
  entries: (Entry & { phaseName?: string | null })[],
  phaseColorMap?: Record<string, string>
) {
  const groups: Record<string, number> = {};
  for (const e of entries) {
    const key = e.phaseName || "Unassigned";
    groups[key] = (groups[key] || 0) + e.hours;
  }
  return Object.entries(groups).map(([name, hours]) => ({
    name,
    hours: Math.round(hours * 10) / 10,
    color: phaseColorMap?.[name] || DEFAULT_PHASE_COLOR,
  }));
}

// --- 2. Employee Flex Trend ---

export function aggregateEmployeeFlexTrend(
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

  const dailyTarget = getEffectiveWeeklyCapacity(member) / 5;
  let cumulativeFlex = 0;

  return periods.map((key) => {
    const periodEntries = grouped[key] || [];
    const totalHours = periodEntries.reduce((s, e) => s + e.hours, 0);
    const wd = workingDaysInPeriod(key, granularity);
    const expected = dailyTarget * wd;
    const flex = totalHours - expected;
    cumulativeFlex += flex;

    return {
      period: periodLabel(key, granularity),
      flex: Math.round(cumulativeFlex * 10) / 10,
    };
  });
}

// --- 3. Capacity Detail ---

export function aggregateCapacityDetail(
  entries: Entry[],
  members: MemberFull[],
  resourceAllocations: ResourceAlloc[],
  vacationDays: Record<string, number>,
  from: Date,
  to: Date,
  granularity: "monthly" | "weekly"
) {
  const periods = getPeriodKeys(from, to, granularity);
  const wd = totalWorkingDays(from, to);
  const today = getToday();
  const next4wEnd = addWeeks(today, 4);

  return members.map((member) => {
    const memberEntries = entries.filter((e) => e.userId === member.id);
    const dailyTarget = getEffectiveWeeklyCapacity(member) / 5;
    const capacity = dailyTarget * wd;

    const billableHours = memberEntries
      .filter((e) => e.billingStatus === "billable")
      .reduce((s, e) => s + e.hours, 0);

    const internalHours = memberEntries
      .filter((e) =>
        e.billingStatus === "non_billable" ||
        e.billingStatus === "internal" ||
        e.billingStatus === "presales"
      )
      .reduce((s, e) => s + e.hours, 0);

    const vacDays = vacationDays[member.id] || 0;
    const vacationHours = vacDays * 7.5;

    const totalUsed = billableHours + internalHours + vacationHours;
    const available = Math.max(0, capacity - totalUsed);
    const utilPct = capacity > 0 ? Math.round((billableHours / capacity) * 1000) / 10 : 0;

    // Compute allocNext4w: sum hoursPerDay x working days in next 4 weeks
    const memberAllocs = resourceAllocations.filter((a) => a.userId === member.id);
    let allocNext4w = 0;
    for (const a of memberAllocs) {
      const aStart = new Date(a.startDate) > today ? new Date(a.startDate) : today;
      const aEnd = new Date(a.endDate) < next4wEnd ? new Date(a.endDate) : next4wEnd;
      const wd = workingDaysInInterval(aStart, aEnd);
      if (wd > 0) {
        allocNext4w += a.hoursPerDay * wd;
      }
    }

    const next4wCapacity = dailyTarget * 5 * 4;
    const allocPct = next4wCapacity > 0
      ? Math.round((allocNext4w / next4wCapacity) * 1000) / 10
      : 0;

    // Accrued vacation hours
    const accruedVacationHrs = member.vacationTrackingUnit === "hours" && member.vacationHoursPerYear
      ? Math.round((member.vacationHoursPerYear / 12) * (today.getMonth() + 1) * 10) / 10
      : Math.round(2.08 * (today.getMonth() + 1) * 7.5 * 10) / 10;

    return {
      name: memberName(member),
      fullName: `${member.firstName || ""} ${member.lastName || ""}`.trim() || member.email,
      billable: Math.round(billableHours * 10) / 10,
      internal: Math.round(internalHours * 10) / 10,
      vacation: Math.round(vacationHours * 10) / 10,
      available: Math.round(available * 10) / 10,
      capacity: Math.round(capacity * 10) / 10,
      utilPct,
      allocNext4w: Math.round(allocNext4w * 10) / 10,
      allocPct,
      accruedVacationHrs,
      costRate: member.costRate,
    };
  });
}

// --- 4. Effective Rate ---

export function aggregateEffectiveRate(
  entries: Entry[],
  projects: ProjectFull[]
) {
  const projectMap: Record<string, ProjectFull> = {};
  for (const p of projects) {
    projectMap[p.id] = p;
  }

  const grouped: Record<string, { hours: number; revenue: number }> = {};
  for (const e of entries) {
    if (e.billingStatus !== "billable") continue;
    if (!grouped[e.projectId]) grouped[e.projectId] = { hours: 0, revenue: 0 };
    grouped[e.projectId].hours += e.hours;
    grouped[e.projectId].revenue += e.hours * e.user.hourlyRate;
  }

  return Object.entries(grouped)
    .map(([projectId, data]) => {
      const project = projectMap[projectId];
      if (!project) return null;
      const effectiveRate = data.hours > 0 ? Math.round((data.revenue / data.hours) * 100) / 100 : 0;
      return {
        name: project.name,
        effectiveRate,
        billRate: project.projectRate || 0,
        color: project.color,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.effectiveRate - a.effectiveRate);
}

// --- 5. Budget Velocity ---

export function aggregateBudgetVelocity(
  entries: Entry[],
  projects: ProjectFull[],
  today?: Date
) {
  const now = today || getToday();

  const hoursByProject: Record<string, number> = {};
  for (const e of entries) {
    if (e.billingStatus === "billable" || e.billingStatus === "included") {
      hoursByProject[e.projectId] = (hoursByProject[e.projectId] || 0) + e.hours;
    }
  }

  return projects
    .filter((p) => p.budgetHours && p.budgetHours > 0 && p.startDate && p.endDate)
    .map((p) => {
      const start = new Date(p.startDate!);
      const end = new Date(p.endDate!);
      const totalDuration = end.getTime() - start.getTime();
      const elapsed = now.getTime() - start.getTime();
      const timeElapsed = totalDuration > 0
        ? Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 1000) / 10))
        : 0;

      const usedHours = hoursByProject[p.id] || 0;
      const budgetConsumed = p.budgetHours! > 0
        ? Math.round((usedHours / p.budgetHours!) * 1000) / 10
        : 0;

      return {
        name: p.name,
        timeElapsed,
        budgetConsumed,
        color: p.color,
        hours: Math.round(usedHours * 10) / 10,
      };
    });
}

// --- 6. Red List ---

export function aggregateRedList(
  entries: Entry[],
  projects: ProjectFull[],
  members: Member[],
  today?: Date
) {
  const now = today || getToday();

  const projectData: Record<string, { hours: number; revenue: number; cost: number }> = {};
  for (const e of entries) {
    if (!projectData[e.projectId]) projectData[e.projectId] = { hours: 0, revenue: 0, cost: 0 };
    if (e.billingStatus === "billable" || e.billingStatus === "included") {
      projectData[e.projectId].hours += e.hours;
    }
    if (e.billingStatus === "billable") {
      projectData[e.projectId].revenue += e.hours * e.user.hourlyRate;
    }
    projectData[e.projectId].cost += e.hours * e.user.costRate;
  }

  return projects
    .filter((p) => {
      if (!p.billable) return false; // Only billable projects can be at risk
      const data = projectData[p.id];
      if (!data) return false;
      const budgetPct = p.budgetHours && p.budgetHours > 0
        ? data.hours / p.budgetHours
        : 0;
      const margin = data.revenue > 0
        ? ((data.revenue - data.cost) / data.revenue) * 100
        : 0;
      return budgetPct > 0.85 || margin < 20;
    })
    .map((p) => {
      const data = projectData[p.id] || { hours: 0, revenue: 0, cost: 0 };
      const budgetPct = p.budgetHours && p.budgetHours > 0
        ? Math.round((data.hours / p.budgetHours) * 1000) / 10
        : 0;

      // Time percentage
      let timePct = 0;
      if (p.startDate && p.endDate) {
        const start = new Date(p.startDate);
        const end = new Date(p.endDate);
        const totalDuration = end.getTime() - start.getTime();
        const elapsed = now.getTime() - start.getTime();
        timePct = totalDuration > 0
          ? Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 1000) / 10))
          : 0;
      }

      const overrun = budgetPct > 100 ? Math.round((data.hours - (p.budgetHours || 0)) * 10) / 10 : 0;
      const margin = data.revenue > 0
        ? Math.round(((data.revenue - data.cost) / data.revenue) * 1000) / 10
        : 0;

      return {
        name: p.name,
        client: p.client || "",
        color: p.color,
        pm: "", // Project manager not directly available, leave empty
        budgetHours: p.budgetHours || 0,
        usedHours: Math.round(data.hours * 10) / 10,
        budgetPct,
        timePct,
        overrun,
        margin,
      };
    });
}

// --- 7. Team Contribution ---

export function aggregateTeamContribution(entries: Entry[]) {
  const grouped: Record<string, { name: string; hours: number }> = {};
  for (const e of entries) {
    if (!grouped[e.userId]) {
      grouped[e.userId] = { name: memberName(e.user), hours: 0 };
    }
    grouped[e.userId].hours += e.hours;
  }

  const results = Object.values(grouped).sort((a, b) => b.hours - a.hours);
  const totalHours = results.reduce((s, r) => s + r.hours, 0);

  return results.map((r) => ({
    name: r.name,
    hours: Math.round(r.hours * 10) / 10,
    pct: totalHours > 0 ? Math.round((r.hours / totalHours) * 1000) / 10 : 0,
  }));
}

// --- 8. Client Concentration ---

export function aggregateClientConcentration(entries: Entry[]) {
  const grouped: Record<string, number> = {};
  for (const e of entries) {
    if (e.billingStatus !== "billable") continue;
    const client = e.project.client || "No Client";
    const revenue = e.hours * e.user.hourlyRate;
    grouped[client] = (grouped[client] || 0) + revenue;
  }

  const results = Object.entries(grouped)
    .map(([name, revenue]) => ({ name, revenue: Math.round(revenue) }))
    .sort((a, b) => b.revenue - a.revenue);

  const totalRevenue = results.reduce((s, r) => s + r.revenue, 0);

  return results.map((r) => ({
    name: r.name,
    revenue: r.revenue,
    pct: totalRevenue > 0 ? Math.round((r.revenue / totalRevenue) * 1000) / 10 : 0,
  }));
}

// --- 9. Invoice Pipeline ---

export function aggregateInvoicePipeline(
  invoices: InvoiceData[],
  from: Date,
  to: Date,
  granularity: "monthly" | "weekly"
) {
  const periods = getPeriodKeys(from, to, granularity);
  const grouped: Record<string, { draft: number; sent: number; paid: number }> = {};
  for (const key of periods) {
    grouped[key] = { draft: 0, sent: 0, paid: 0 };
  }

  for (const inv of invoices) {
    const key = periodKey(inv.invoiceDate, granularity);
    if (!grouped[key]) continue;
    const status = inv.status as "draft" | "sent" | "paid";
    if (status === "draft" || status === "sent" || status === "paid") {
      grouped[key][status] += inv.totalAmount;
    }
  }

  return periods.map((key) => ({
    period: periodLabel(key, granularity),
    draft: Math.round((grouped[key]?.draft || 0) * 100) / 100,
    sent: Math.round((grouped[key]?.sent || 0) * 100) / 100,
    paid: Math.round((grouped[key]?.paid || 0) * 100) / 100,
  }));
}

// --- 10. Billing Velocity ---

export function aggregateBillingVelocity(
  entries: Entry[],
  invoicedEntries: InvoicedEntry[]
) {
  const daysList: number[] = [];
  for (const ie of invoicedEntries) {
    const entryDate = new Date(ie.date);
    const invoicedDate = new Date(ie.invoicedAt);
    const days = differenceInDays(invoicedDate, entryDate);
    if (days >= 0) daysList.push(days);
  }

  const avgDays = daysList.length > 0
    ? Math.round((daysList.reduce((s, d) => s + d, 0) / daysList.length) * 10) / 10
    : 0;

  const under7 = daysList.filter((d) => d < 7).length;
  const between7and14 = daysList.filter((d) => d >= 7 && d <= 14).length;
  const over14 = daysList.filter((d) => d > 14).length;

  return {
    avgDays,
    buckets: [
      { label: "<7d", value: under7, color: "#22C55E" },
      { label: "7-14d", value: between7and14, color: "#F59E0B" },
      { label: ">14d", value: over14, color: "#EF4444" },
    ],
  };
}

// --- 11. Collection Summary ---

export function aggregateCollectionSummary(invoices: InvoiceData[]) {
  let invoiced = 0;
  let paid = 0;
  let outstanding = 0;

  for (const inv of invoices) {
    const amount = inv.totalAmount;
    if (inv.status === "paid") {
      paid += amount;
      invoiced += amount;
    } else if (inv.status === "sent") {
      outstanding += amount;
      invoiced += amount;
    } else if (inv.status === "draft") {
      invoiced += amount;
    }
  }

  return {
    invoiced: Math.round(invoiced * 100) / 100,
    paid: Math.round(paid * 100) / 100,
    outstanding: Math.round(outstanding * 100) / 100,
  };
}

// --- 12. Unbilled Aging (simpler shape) ---

export function aggregateUnbilledAging(entries: Entry[], today?: Date) {
  const now = today || getToday();
  const unbilled = entries.filter(
    (e) => e.billingStatus === "billable" && e.approvalStatus === "approved"
  );

  const byProject: Record<string, { name: string; entries: Entry[] }> = {};
  for (const e of unbilled) {
    if (!byProject[e.projectId]) {
      byProject[e.projectId] = { name: e.project.name, entries: [] };
    }
    byProject[e.projectId].entries.push(e);
  }

  return Object.values(byProject).map((group) => {
    const hours = group.entries.reduce((s, e) => s + e.hours, 0);
    const revenue = group.entries.reduce((s, e) => s + e.hours * e.user.hourlyRate, 0);
    const dates = group.entries.map((e) => new Date(e.date).getTime());
    const oldestDate = new Date(Math.min(...dates));
    const age = differenceInDays(now, oldestDate);

    return {
      name: group.name,
      revenue: Math.round(revenue),
      age,
      hours: Math.round(hours * 10) / 10,
    };
  }).sort((a, b) => b.revenue - a.revenue);
}
