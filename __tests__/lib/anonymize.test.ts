import { describe, it, expect } from "vitest";
import { anonymizeInsightData, deanonymizeInsights } from "@/lib/ai/anonymize";
import { InsightDataPackage } from "@/lib/ai/insight-data-gatherer";

function makeMinimalData(overrides?: Partial<InsightDataPackage>): InsightDataPackage {
  return {
    company: { id: "comp_123", name: "Acme Corp", currency: "USD" },
    team: {
      members: [
        { id: "u1", name: "John Doe", weeklyTarget: 40, vacationDays: 25, avgHoursLast4Weeks: 38, utilizationPercent: 95, totalHoursLast30Days: 152 },
        { id: "u2", name: "Jane Smith", weeklyTarget: 37, vacationDays: 25, avgHoursLast4Weeks: 30, utilizationPercent: 81, totalHoursLast30Days: 120 },
      ],
      totalCapacityHoursWeekly: 77,
    },
    workloadMetrics: {
      weeklyHoursByUser: [
        { userId: "u1", userName: "John Doe", weekStart: "2026-01-26", hours: 42, weeklyTarget: 40 },
        { userId: "u2", userName: "Jane Smith", weekStart: "2026-01-26", hours: 30, weeklyTarget: 37 },
      ],
      usersOverworked: [{ name: "John Doe", avgHours: 42, weeksOver40: 3 }],
      usersUnderutilized: [{ name: "Jane Smith", avgUtilization: 65 }],
      weekendWorkers: [],
    },
    vacations: {
      upcoming: [{ userName: "Jane Smith", startDate: "2026-02-10", endDate: "2026-02-14", type: "vacation", businessDays: 5 }],
      capacityReductions: [],
    },
    projects: {
      active: [
        {
          id: "p1",
          name: "ClientX Website",
          budgetHours: 500,
          hoursUsed: 425,
          percentUsed: 85,
          weeklyBurnRate: 45,
          teamMembers: [
            { name: "John Doe", hours: 300, percent: 71 },
            { name: "Jane Smith", hours: 125, percent: 29 },
          ],
        },
        {
          id: "p2",
          name: "Internal Tool",
          budgetHours: null,
          hoursUsed: 50,
          percentUsed: null,
          weeklyBurnRate: 12,
          teamMembers: [{ name: "John Doe", hours: 50, percent: 100 }],
        },
      ],
      singlePersonRisks: [{ projectName: "Internal Tool", userName: "John Doe", percentOfWork: 100 }],
    },
    productivity: {
      billablePercentByWeek: [{ weekStart: "2026-01-26", billablePercent: 78 }],
      pendingApprovals: 3,
      usersWithEntryGaps: [{ name: "Jane Smith", missedDays: 3 }],
    },
    contracts: [
      { projectName: "ClientX Website", maxHours: 500, maxBudget: 50000, deadline: "2026-06-30", scope: "Build website for ClientX with John Doe leading", hoursUsed: 0 },
    ],
    ...overrides,
  };
}

describe("anonymizeInsightData", () => {
  it("replaces employee names with pseudonyms", () => {
    const data = makeMinimalData();
    const { anonymizedData } = anonymizeInsightData(data);

    // Names sorted alphabetically: Jane Smith -> Employee A, John Doe -> Employee B
    const names = anonymizedData.team.members.map((m) => m.name);
    expect(names).toContain("Employee A");
    expect(names).toContain("Employee B");
    expect(names).not.toContain("John Doe");
    expect(names).not.toContain("Jane Smith");
  });

  it("replaces project names with Greek letter pseudonyms", () => {
    const data = makeMinimalData();
    const { anonymizedData } = anonymizeInsightData(data);

    // Projects sorted alphabetically: ClientX Website -> Project Alpha, Internal Tool -> Project Beta
    const projectNames = anonymizedData.projects.active.map((p) => p.name);
    expect(projectNames).toContain("Project Alpha");
    expect(projectNames).toContain("Project Beta");
    expect(projectNames).not.toContain("ClientX Website");
    expect(projectNames).not.toContain("Internal Tool");
  });

  it("replaces company name with 'The Company'", () => {
    const data = makeMinimalData();
    const { anonymizedData } = anonymizeInsightData(data);

    expect(anonymizedData.company.name).toBe("The Company");
  });

  it("strips IDs", () => {
    const data = makeMinimalData();
    const { anonymizedData } = anonymizeInsightData(data);

    expect(anonymizedData.company.id).toBe("");
    for (const m of anonymizedData.team.members) {
      expect(m.id).toBe("");
    }
    for (const w of anonymizedData.workloadMetrics.weeklyHoursByUser) {
      expect(w.userId).toBe("");
    }
    for (const p of anonymizedData.projects.active) {
      expect(p.id).toBe("");
    }
  });

  it("uses consistent pseudonyms across all fields", () => {
    const data = makeMinimalData();
    const { anonymizedData, map } = anonymizeInsightData(data);

    const johnPseudo = map.employees.get("John Doe")!;
    const janePseudo = map.employees.get("Jane Smith")!;

    // Check overworked
    expect(anonymizedData.workloadMetrics.usersOverworked[0].name).toBe(johnPseudo);

    // Check underutilized
    expect(anonymizedData.workloadMetrics.usersUnderutilized[0].name).toBe(janePseudo);

    // Check vacations
    expect(anonymizedData.vacations.upcoming[0].userName).toBe(janePseudo);

    // Check project team members
    const project1Members = anonymizedData.projects.active[0].teamMembers.map((m) => m.name);
    expect(project1Members).toContain(johnPseudo);
    expect(project1Members).toContain(janePseudo);

    // Check single person risks
    expect(anonymizedData.projects.singlePersonRisks[0].userName).toBe(johnPseudo);

    // Check entry gaps
    expect(anonymizedData.productivity.usersWithEntryGaps[0].name).toBe(janePseudo);

    // Check weekly hours
    const weeklyNames = anonymizedData.workloadMetrics.weeklyHoursByUser.map((w) => w.userName);
    expect(weeklyNames).toContain(johnPseudo);
    expect(weeklyNames).toContain(janePseudo);
  });

  it("scrubs known names from contract scope text", () => {
    const data = makeMinimalData({
      contracts: [
        { projectName: "ClientX Website", maxHours: 500, maxBudget: 50000, deadline: "2026-06-30", scope: "Build ClientX Website for Acme Corp with John Doe leading", hoursUsed: 0 },
      ],
    });
    const { anonymizedData } = anonymizeInsightData(data);

    const scope = anonymizedData.contracts[0].scope!;
    expect(scope).not.toContain("ClientX Website");
    expect(scope).not.toContain("Acme Corp");
    expect(scope).not.toContain("John Doe");
    expect(scope).toContain("Project Alpha");
    expect(scope).toContain("The Company");
  });

  it("preserves numeric values", () => {
    const data = makeMinimalData();
    const { anonymizedData } = anonymizeInsightData(data);

    expect(anonymizedData.team.members[0].weeklyTarget).toBeGreaterThan(0);
    expect(anonymizedData.projects.active[0].hoursUsed).toBe(425);
    expect(anonymizedData.projects.active[0].budgetHours).toBe(500);
    expect(anonymizedData.productivity.pendingApprovals).toBe(3);
    expect(anonymizedData.productivity.billablePercentByWeek[0].billablePercent).toBe(78);
  });

  it("handles empty data gracefully", () => {
    const data = makeMinimalData({
      team: { members: [], totalCapacityHoursWeekly: 0 },
      workloadMetrics: { weeklyHoursByUser: [], usersOverworked: [], usersUnderutilized: [], weekendWorkers: [] },
      vacations: { upcoming: [], capacityReductions: [] },
      projects: { active: [], singlePersonRisks: [] },
      productivity: { billablePercentByWeek: [], pendingApprovals: 0, usersWithEntryGaps: [] },
      contracts: [],
    });
    const { anonymizedData, map } = anonymizeInsightData(data);

    expect(anonymizedData.company.name).toBe("The Company");
    expect(map.employees.size).toBe(0);
    expect(map.projects.size).toBe(0);
  });

  it("does not mutate the original data", () => {
    const data = makeMinimalData();
    const originalName = data.team.members[0].name;
    anonymizeInsightData(data);

    expect(data.team.members[0].name).toBe(originalName);
    expect(data.company.name).toBe("Acme Corp");
  });
});

describe("deanonymizeInsights", () => {
  it("restores real names in insight text", () => {
    const data = makeMinimalData();
    const { map } = anonymizeInsightData(data);

    const johnPseudo = map.employees.get("John Doe")!;
    const projectPseudo = map.projects.get("ClientX Website")!;

    const insights = [
      {
        category: "HEADS_UP" as const,
        title: `${johnPseudo} is overworked`,
        description: `${johnPseudo} has been working 42h/week on ${projectPseudo}`,
        suggestion: `Consider redistributing ${projectPseudo} work from ${johnPseudo}`,
      },
    ];

    const result = deanonymizeInsights(insights, map);
    expect(result[0].title).toBe("John Doe is overworked");
    expect(result[0].description).toContain("John Doe");
    expect(result[0].description).toContain("ClientX Website");
    expect(result[0].suggestion).toContain("John Doe");
    expect(result[0].suggestion).toContain("ClientX Website");
  });

  it("restores company name", () => {
    const data = makeMinimalData();
    const { map } = anonymizeInsightData(data);

    const insights = [
      {
        category: "CELEBRATION" as const,
        title: "Great week for The Company",
        description: "The Company had a productive week",
      },
    ];

    const result = deanonymizeInsights(insights, map);
    expect(result[0].title).toBe("Great week for Acme Corp");
    expect(result[0].description).toContain("Acme Corp");
  });

  it("handles insights without suggestion field", () => {
    const data = makeMinimalData();
    const { map } = anonymizeInsightData(data);

    const insights = [
      {
        category: "INSIGHT" as const,
        title: "Billable hours trending up",
        description: "Weekly billable % increased from 70% to 78%",
        relatedHours: 78,
      },
    ];

    const result = deanonymizeInsights(insights, map);
    expect(result[0].suggestion).toBeUndefined();
    expect(result[0].relatedHours).toBe(78);
  });

  it("prevents partial matches (Employee AA before Employee A)", () => {
    // Build data with 27+ employees to get Employee AA
    const members = [];
    const names = [];
    for (let i = 0; i < 27; i++) {
      const name = `Person ${String.fromCharCode(65 + i)}`;
      names.push(name);
      members.push({
        id: `u${i}`,
        name,
        weeklyTarget: 40,
        vacationDays: 25,
        avgHoursLast4Weeks: 35,
        utilizationPercent: 87,
        totalHoursLast30Days: 140,
      });
    }

    const data = makeMinimalData({
      team: { members, totalCapacityHoursWeekly: 40 * 27 },
      workloadMetrics: { weeklyHoursByUser: [], usersOverworked: [], usersUnderutilized: [], weekendWorkers: [] },
      productivity: { billablePercentByWeek: [], pendingApprovals: 0, usersWithEntryGaps: [] },
    });

    const { map } = anonymizeInsightData(data);

    // Employee AA should exist
    const hasAA = Array.from(map.reverseEmployees.keys()).some((k) => k === "Employee AA");
    expect(hasAA).toBe(true);

    // De-anonymize should correctly handle "Employee AA" without partial match on "Employee A"
    const insights = [
      {
        category: "INSIGHT" as const,
        title: "Employee AA and Employee A both performing well",
        description: "Both Employee AA and Employee A have good utilization",
      },
    ];

    const result = deanonymizeInsights(insights, map);
    // The title should not contain any "Employee" pseudonyms
    expect(result[0].title).not.toContain("Employee A");
    expect(result[0].title).not.toContain("Employee AA");
  });
});
