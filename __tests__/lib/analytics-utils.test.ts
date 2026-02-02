import { describe, it, expect } from "vitest";
import {
  aggregateEmployeeTimeDistribution,
  aggregateEmployeeUtilizationTrend,
  aggregateEmployeeProfitability,
  aggregateTeamUtilization,
  aggregateTeamProfitability,
  aggregateTeamTimeMix,
  aggregateProjectBurndown,
  aggregateProjectProfitability,
  aggregateProjectBillableMix,
  aggregateCompanyRevenueOverhead,
  aggregateExpenseBreakdown,
  aggregateNonBillableTrend,
  aggregateUnbilledWork,
  calculateForecast,
} from "@/lib/analytics-utils";

// --- Fixtures ---

function makeEntry(overrides: Record<string, any> = {}) {
  return {
    id: "e1",
    hours: 8,
    date: "2024-01-15",
    billingStatus: "billable",
    approvalStatus: "approved",
    userId: "u1",
    projectId: "p1",
    user: {
      id: "u1",
      firstName: "John",
      lastName: "Doe",
      email: "john@test.com",
      hourlyRate: 100,
      costRate: 50,
      weeklyTarget: 37,
    },
    project: {
      id: "p1",
      name: "Project Alpha",
      client: "Client A",
      color: "#3B82F6",
      billable: true,
      budgetHours: 100,
    },
    ...overrides,
  };
}

function makeMember(overrides: Record<string, any> = {}) {
  return {
    id: "u1",
    firstName: "John",
    lastName: "Doe",
    email: "john@test.com",
    hourlyRate: 100,
    costRate: 50,
    weeklyTarget: 37,
    ...overrides,
  };
}

function makeProject(overrides: Record<string, any> = {}) {
  return {
    id: "p1",
    name: "Project Alpha",
    client: "Client A",
    color: "#3B82F6",
    billable: true,
    budgetHours: 100,
    ...overrides,
  };
}

// --- Employee Insights ---

describe("aggregateEmployeeTimeDistribution", () => {
  it("groups hours by billing status", () => {
    const entries = [
      makeEntry({ hours: 5, billingStatus: "billable" }),
      makeEntry({ hours: 3, billingStatus: "internal" }),
      makeEntry({ hours: 2, billingStatus: "billable" }),
    ];
    const result = aggregateEmployeeTimeDistribution(entries);
    const billable = result.find((r) => r.status === "billable");
    const internal = result.find((r) => r.status === "internal");
    expect(billable?.hours).toBe(7);
    expect(internal?.hours).toBe(3);
  });

  it("returns empty array for no entries", () => {
    expect(aggregateEmployeeTimeDistribution([])).toHaveLength(0);
  });
});

describe("aggregateEmployeeUtilizationTrend", () => {
  it("returns period data with utilization percentages", () => {
    const member = makeMember();
    const entries = [
      makeEntry({ date: "2024-01-15", hours: 37, billingStatus: "billable" }),
    ];
    const result = aggregateEmployeeUtilizationTrend(
      entries,
      member,
      new Date(2024, 0, 1),
      new Date(2024, 0, 31),
      "monthly"
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty("billableUtil");
    expect(result[0]).toHaveProperty("totalUtil");
    expect(result[0].target).toBe(100);
  });

  it("returns 0 utilization when target is 0", () => {
    const member = makeMember({ weeklyTarget: 0 });
    const entries = [makeEntry({ date: "2024-01-15" })];
    const result = aggregateEmployeeUtilizationTrend(
      entries,
      member,
      new Date(2024, 0, 1),
      new Date(2024, 0, 31),
      "monthly"
    );
    expect(result[0].billableUtil).toBe(0);
    expect(result[0].totalUtil).toBe(0);
  });
});

describe("aggregateEmployeeProfitability", () => {
  it("calculates revenue from billable and cost from all hours", () => {
    const member = makeMember({ hourlyRate: 100, costRate: 50 });
    const entries = [
      makeEntry({ date: "2024-01-15", hours: 10, billingStatus: "billable" }),
      makeEntry({ date: "2024-01-16", hours: 5, billingStatus: "internal" }),
    ];
    const result = aggregateEmployeeProfitability(
      entries,
      member,
      new Date(2024, 0, 1),
      new Date(2024, 0, 31),
      "monthly"
    );
    expect(result).toHaveLength(1);
    expect(result[0].revenue).toBe(1000); // 10 * 100
    expect(result[0].cost).toBe(750); // 15 * 50
    expect(result[0].profit).toBe(250);
  });
});

// --- Team Insights ---

describe("aggregateTeamUtilization", () => {
  it("returns utilization per member", () => {
    const members = [makeMember(), makeMember({ id: "u2", email: "jane@test.com", firstName: "Jane" })];
    const entries = [
      makeEntry({ userId: "u1", hours: 37, billingStatus: "billable", date: "2024-01-15" }),
    ];
    const result = aggregateTeamUtilization(
      entries,
      members,
      new Date(2024, 0, 8),
      new Date(2024, 0, 14),
      "weekly"
    );
    expect(result).toHaveLength(2);
    expect(result[0].billableUtil).toBeGreaterThan(0);
    expect(result[1].billableUtil).toBe(0);
  });
});

describe("aggregateTeamProfitability", () => {
  it("returns revenue, cost, margin per member", () => {
    const members = [makeMember({ hourlyRate: 100, costRate: 50 })];
    const entries = [
      makeEntry({ hours: 10, billingStatus: "billable" }),
      makeEntry({ hours: 5, billingStatus: "internal" }),
    ];
    const result = aggregateTeamProfitability(entries, members);
    expect(result).toHaveLength(1);
    expect(result[0].revenue).toBe(1000);
    expect(result[0].cost).toBe(750);
    expect(result[0].margin).toBeGreaterThan(0);
  });
});

describe("aggregateTeamTimeMix", () => {
  it("returns billing status breakdown per member", () => {
    const members = [makeMember()];
    const entries = [
      makeEntry({ hours: 5, billingStatus: "billable" }),
      makeEntry({ hours: 3, billingStatus: "internal" }),
    ];
    const result = aggregateTeamTimeMix(entries, members);
    expect(result).toHaveLength(1);
    expect(result[0].billable).toBe(5);
    expect(result[0].internal).toBe(3);
  });
});

// --- Project Insights ---

describe("aggregateProjectBurndown", () => {
  it("returns empty for project without budget", () => {
    const project = makeProject({ budgetHours: null });
    const result = aggregateProjectBurndown([], project, new Date(2024, 0, 1), new Date(2024, 0, 31), "monthly");
    expect(result).toHaveLength(0);
  });

  it("tracks cumulative hours used", () => {
    const project = makeProject({ budgetHours: 100 });
    const entries = [
      makeEntry({ date: "2024-01-15", hours: 20, billingStatus: "billable" }),
      makeEntry({ date: "2024-02-15", hours: 30, billingStatus: "billable" }),
    ];
    const result = aggregateProjectBurndown(
      entries,
      project,
      new Date(2024, 0, 1),
      new Date(2024, 2, 31),
      "monthly"
    );
    expect(result).toHaveLength(3);
    expect(result[0].hoursUsed).toBe(20);
    expect(result[1].hoursUsed).toBe(50);
  });
});

describe("aggregateProjectProfitability", () => {
  it("calculates per-period revenue and cost", () => {
    const entries = [
      makeEntry({ date: "2024-01-15", hours: 10, billingStatus: "billable" }),
    ];
    const result = aggregateProjectProfitability(
      entries,
      "p1",
      new Date(2024, 0, 1),
      new Date(2024, 0, 31),
      "monthly"
    );
    expect(result).toHaveLength(1);
    expect(result[0].revenue).toBe(1000);
    expect(result[0].cost).toBe(500);
    expect(result[0].profit).toBe(500);
  });
});

describe("aggregateProjectBillableMix", () => {
  it("returns billing breakdown per project", () => {
    const projects = [makeProject()];
    const entries = [
      makeEntry({ hours: 5, billingStatus: "billable" }),
      makeEntry({ hours: 3, billingStatus: "internal" }),
    ];
    const result = aggregateProjectBillableMix(entries, projects);
    expect(result).toHaveLength(1);
    expect(result[0].billable).toBe(5);
    expect(result[0].internal).toBe(3);
  });

  it("filters out projects with no hours", () => {
    const projects = [makeProject(), makeProject({ id: "p2", name: "Empty" })];
    const entries = [makeEntry({ hours: 5, billingStatus: "billable", projectId: "p1" })];
    const result = aggregateProjectBillableMix(entries, projects);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Project Alpha");
  });
});

// --- Company Insights ---

describe("aggregateCompanyRevenueOverhead", () => {
  it("includes expenses in total cost", () => {
    const entries = [
      makeEntry({ date: "2024-01-15", hours: 10, billingStatus: "billable" }),
    ];
    const projExp = [{ amount: 200, date: "2024-01-15", category: "travel", description: "Trip" }];
    const compExp = [{ amount: 300, date: "2024-01-15", category: "rent", description: "Office" }];
    const result = aggregateCompanyRevenueOverhead(
      entries,
      new Date(2024, 0, 1),
      new Date(2024, 0, 31),
      "monthly",
      projExp,
      compExp
    );
    expect(result).toHaveLength(1);
    expect(result[0].revenue).toBe(1000);
    expect(result[0].projectExpenses).toBe(200);
    expect(result[0].companyExpenses).toBe(300);
    expect(result[0].totalCost).toBe(500 + 500); // labor + expenses
  });
});

describe("aggregateExpenseBreakdown", () => {
  it("groups expenses by category and period", () => {
    const projExp = [
      { amount: 100, date: "2024-01-15", category: "travel", description: "Trip" },
      { amount: 200, date: "2024-01-20", category: "meals", description: "Lunch" },
    ];
    const result = aggregateExpenseBreakdown(
      projExp,
      [],
      new Date(2024, 0, 1),
      new Date(2024, 0, 31),
      "monthly"
    );
    expect(result).toHaveLength(1);
    expect(result[0].travel).toBe(100);
    expect(result[0].meals).toBe(200);
  });
});

describe("aggregateNonBillableTrend", () => {
  it("calculates non-billable percentage", () => {
    const entries = [
      makeEntry({ date: "2024-01-15", hours: 8, billingStatus: "billable" }),
      makeEntry({ date: "2024-01-15", hours: 2, billingStatus: "internal" }),
    ];
    const result = aggregateNonBillableTrend(
      entries,
      new Date(2024, 0, 1),
      new Date(2024, 0, 31),
      "monthly"
    );
    expect(result).toHaveLength(1);
    expect(result[0].totalPercent).toBe(20);
    expect(result[0].internal).toBe(20);
  });

  it("returns 0 for empty period", () => {
    const result = aggregateNonBillableTrend(
      [],
      new Date(2024, 0, 1),
      new Date(2024, 0, 31),
      "monthly"
    );
    expect(result[0].totalPercent).toBe(0);
  });
});

describe("aggregateUnbilledWork", () => {
  it("returns unbilled approved billable entries grouped by project", () => {
    const entries = [
      makeEntry({ hours: 10, billingStatus: "billable", approvalStatus: "approved" }),
      makeEntry({ hours: 5, billingStatus: "billable", approvalStatus: "approved" }),
      makeEntry({ hours: 3, billingStatus: "internal", approvalStatus: "approved" }),
    ];
    const result = aggregateUnbilledWork(entries);
    expect(result).toHaveLength(1);
    expect(result[0].hours).toBe(15);
    expect(result[0].estimatedRevenue).toBe(1500);
    expect(result[0].projectName).toBe("Project Alpha");
  });

  it("excludes non-approved entries", () => {
    const entries = [
      makeEntry({ billingStatus: "billable", approvalStatus: "draft" }),
    ];
    const result = aggregateUnbilledWork(entries);
    expect(result).toHaveLength(0);
  });
});

describe("calculateForecast", () => {
  it("returns empty if less than 3 data points", () => {
    expect(calculateForecast([
      { period: "Jan 2024", revenue: 1000, totalCost: 500, contributionMargin: 500 },
    ], 3)).toHaveLength(0);
  });

  it("returns empty for 2 data points", () => {
    expect(calculateForecast([
      { period: "Jan 2024", revenue: 1000, totalCost: 500, contributionMargin: 500 },
      { period: "Feb 2024", revenue: 1200, totalCost: 600, contributionMargin: 600 },
    ], 3)).toHaveLength(0);
  });

  it("generates forecast months based on last 3 data points", () => {
    const data = [
      { period: "Jan 2024", revenue: 1000, totalCost: 500, contributionMargin: 500 },
      { period: "Feb 2024", revenue: 1200, totalCost: 600, contributionMargin: 600 },
      { period: "Mar 2024", revenue: 1100, totalCost: 550, contributionMargin: 550 },
    ];
    const result = calculateForecast(data, 2);
    expect(result).toHaveLength(2);
    expect(result[0].isForecast).toBe(true);
    // Average revenue: (1000+1200+1100)/3 = 1100
    expect(result[0].revenue).toBe(1100);
    // Average cost: (500+600+550)/3 = 550
    expect(result[0].totalCost).toBe(550);
  });
});
