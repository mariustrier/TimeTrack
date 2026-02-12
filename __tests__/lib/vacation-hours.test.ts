import { describe, it, expect } from "vitest";

/**
 * Tests for hours-based vacation tracking calculations.
 *
 * Days-based: 2.08 days/month accrual, balance = accrued + bonus - usedDays
 * Hours-based: (vacationHoursPerYear / 12) hours/month accrual,
 *              used = businessDays × (weeklyTarget / 5),
 *              balance = accrued + bonusHours - usedHours
 */

const MONTHLY_ACCRUAL_DAYS = 2.08;

function computeDaysBalance(
  currentMonth: number,
  bonusDays: number,
  approvedBusinessDays: number
) {
  const accrued = Math.round(MONTHLY_ACCRUAL_DAYS * currentMonth * 100) / 100;
  return Math.round((accrued + bonusDays - approvedBusinessDays) * 100) / 100;
}

function computeHoursBalance(
  currentMonth: number,
  vacationHoursPerYear: number,
  bonusHours: number,
  approvedBusinessDays: number,
  weeklyTarget: number
) {
  const monthlyAccrual = vacationHoursPerYear / 12;
  const accrued = Math.round(monthlyAccrual * currentMonth * 100) / 100;
  const dailyTarget = weeklyTarget / 5;
  const usedHours = Math.round(approvedBusinessDays * dailyTarget * 100) / 100;
  return {
    accrued,
    usedHours,
    balance: Math.round((accrued + bonusHours - usedHours) * 100) / 100,
  };
}

describe("Days-based vacation balance (unchanged)", () => {
  it("calculates standard 37h full-time accrual", () => {
    // Month 6, no bonus, no used
    expect(computeDaysBalance(6, 0, 0)).toBe(12.48);
  });

  it("accounts for bonus days", () => {
    expect(computeDaysBalance(3, 5, 0)).toBe(11.24); // 6.24 + 5
  });

  it("subtracts used days", () => {
    expect(computeDaysBalance(6, 0, 5)).toBe(7.48); // 12.48 - 5
  });

  it("can go negative", () => {
    expect(computeDaysBalance(1, 0, 5)).toBe(-2.92); // 2.08 - 5
  });

  it("month 12 gives ~24.96 days", () => {
    expect(computeDaysBalance(12, 0, 0)).toBe(24.96);
  });
});

describe("Hours-based vacation balance", () => {
  it("calculates accrual for 30h/week employee (150h/year)", () => {
    const result = computeHoursBalance(6, 150, 0, 0, 30);
    expect(result.accrued).toBe(75); // 150/12 * 6 = 75
    expect(result.usedHours).toBe(0);
    expect(result.balance).toBe(75);
  });

  it("calculates accrual for 37h/week full-time (185h/year)", () => {
    const result = computeHoursBalance(1, 185, 0, 0, 37);
    expect(result.accrued).toBeCloseTo(15.42, 1); // 185/12 ≈ 15.42
  });

  it("computes used hours from business days × daily target", () => {
    // 30h/week → 6h/day, 3 days off = 18h used
    const result = computeHoursBalance(6, 150, 0, 3, 30);
    expect(result.usedHours).toBe(18);
    expect(result.balance).toBe(57); // 75 - 18
  });

  it("accounts for bonus hours", () => {
    const result = computeHoursBalance(6, 150, 10, 0, 30);
    expect(result.balance).toBe(85); // 75 + 10
  });

  it("handles 20h/week part-timer (100h/year)", () => {
    // Month 3: 100/12 * 3 = 25h accrued
    // 2 business days off × 4h/day = 8h used
    const result = computeHoursBalance(3, 100, 0, 2, 20);
    expect(result.accrued).toBe(25);
    expect(result.usedHours).toBe(8);
    expect(result.balance).toBe(17);
  });

  it("can go negative", () => {
    // Month 1: 150/12 = 12.5h accrued, 5 days × 6h = 30h used
    const result = computeHoursBalance(1, 150, 0, 5, 30);
    expect(result.accrued).toBe(12.5);
    expect(result.usedHours).toBe(30);
    expect(result.balance).toBe(-17.5);
  });

  it("month 12 gives full annual entitlement", () => {
    const result = computeHoursBalance(12, 150, 0, 0, 30);
    expect(result.accrued).toBe(150);
  });

  it("handles zero vacationHoursPerYear gracefully", () => {
    const result = computeHoursBalance(6, 0, 0, 0, 30);
    expect(result.accrued).toBe(0);
    expect(result.balance).toBe(0);
  });
});

describe("Monthly planner grid logic (hours mode)", () => {
  it("computes cumulative balance across months", () => {
    const vacationHoursPerYear = 150;
    const weeklyTarget = 30;
    const bonusHours = 0;
    const monthlyAccrual = vacationHoursPerYear / 12; // 12.5
    const dailyTarget = weeklyTarget / 5; // 6

    // Simulate: 5 business days vacation in March (month index 2)
    const usedDaysPerMonth = [0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    let cumulativeUsed = 0;
    const months = usedDaysPerMonth.map((usedDays, i) => {
      const earned = Math.round(monthlyAccrual * (i + 1) * 100) / 100;
      const usedHours = Math.round(usedDays * dailyTarget * 100) / 100;
      cumulativeUsed += usedHours;
      const balance = Math.round((earned + bonusHours - cumulativeUsed) * 100) / 100;
      return { earned, usedHours, cumulativeUsed, balance };
    });

    // Jan: 12.5 earned, 0 used, balance 12.5
    expect(months[0].balance).toBe(12.5);
    // Feb: 25 earned, 0 used, balance 25
    expect(months[1].balance).toBe(25);
    // Mar: 37.5 earned, 30h used (5 × 6), balance 7.5
    expect(months[2].earned).toBe(37.5);
    expect(months[2].usedHours).toBe(30);
    expect(months[2].balance).toBe(7.5);
    // Apr: 50 earned, still 30 cumulative, balance 20
    expect(months[3].balance).toBe(20);
    // Dec: 150 earned, 30 used, balance 120
    expect(months[11].balance).toBe(120);
  });
});
