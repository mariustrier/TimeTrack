import { describe, it, expect } from "vitest";
import {
  expandRecurringExpenses,
  shouldAutoApprove,
  COMPANY_EXPENSE_CATEGORIES,
  PROJECT_EXPENSE_CATEGORIES,
} from "@/lib/expense-utils";

describe("COMPANY_EXPENSE_CATEGORIES", () => {
  it("has 6 categories", () => {
    expect(COMPANY_EXPENSE_CATEGORIES).toHaveLength(6);
    expect(COMPANY_EXPENSE_CATEGORIES).toContain("rent");
    expect(COMPANY_EXPENSE_CATEGORIES).toContain("other");
  });
});

describe("PROJECT_EXPENSE_CATEGORIES", () => {
  it("has 5 categories", () => {
    expect(PROJECT_EXPENSE_CATEGORIES).toHaveLength(5);
    expect(PROJECT_EXPENSE_CATEGORIES).toContain("travel");
    expect(PROJECT_EXPENSE_CATEGORIES).toContain("other");
  });
});

describe("expandRecurringExpenses", () => {
  it("includes one-time expense within range", () => {
    const result = expandRecurringExpenses(
      [{ amount: 100, date: "2024-03-15", category: "software", description: "License", recurring: false, frequency: null }],
      "2024-03-01",
      "2024-03-31"
    );
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(100);
  });

  it("excludes one-time expense outside range", () => {
    const result = expandRecurringExpenses(
      [{ amount: 100, date: "2024-04-15", category: "software", description: "License", recurring: false, frequency: null }],
      "2024-03-01",
      "2024-03-31"
    );
    expect(result).toHaveLength(0);
  });

  it("generates monthly recurring instances", () => {
    // Use Date objects to avoid timezone issues with date string parsing
    const result = expandRecurringExpenses(
      [{ amount: 500, date: new Date(2024, 0, 15), category: "rent", description: "Office", recurring: true, frequency: "monthly" }],
      new Date(2024, 0, 1),
      new Date(2024, 2, 31)
    );
    expect(result).toHaveLength(3);
    result.forEach((e) => expect(e.amount).toBe(500));
  });

  it("generates quarterly recurring instances", () => {
    const result = expandRecurringExpenses(
      [{ amount: 1000, date: new Date(2024, 0, 15), category: "insurance", description: "Insurance", recurring: true, frequency: "quarterly" }],
      new Date(2024, 0, 1),
      new Date(2024, 11, 31)
    );
    expect(result).toHaveLength(4);
  });

  it("generates yearly recurring instances", () => {
    const result = expandRecurringExpenses(
      [{ amount: 5000, date: new Date(2024, 0, 15), category: "insurance", description: "Annual", recurring: true, frequency: "yearly" }],
      new Date(2024, 0, 1),
      new Date(2025, 11, 31)
    );
    expect(result).toHaveLength(2);
  });

  it("returns empty array for empty input", () => {
    const result = expandRecurringExpenses([], new Date(2024, 0, 1), new Date(2024, 11, 31));
    expect(result).toHaveLength(0);
  });

  it("defaults to monthly when frequency is null on recurring", () => {
    const result = expandRecurringExpenses(
      [{ amount: 100, date: new Date(2024, 0, 15), category: "other", description: "Test", recurring: true, frequency: null }],
      new Date(2024, 0, 1),
      new Date(2024, 2, 31)
    );
    expect(result).toHaveLength(3);
  });
});

describe("shouldAutoApprove", () => {
  it("returns false when threshold is null", () => {
    expect(shouldAutoApprove(100, null)).toBe(false);
  });

  it("returns true when amount is below threshold", () => {
    expect(shouldAutoApprove(50, 100)).toBe(true);
  });

  it("returns true when amount equals threshold", () => {
    expect(shouldAutoApprove(100, 100)).toBe(true);
  });

  it("returns false when amount exceeds threshold", () => {
    expect(shouldAutoApprove(150, 100)).toBe(false);
  });
});
