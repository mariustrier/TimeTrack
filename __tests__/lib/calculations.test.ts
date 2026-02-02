import { describe, it, expect } from "vitest";
import {
  calculateRevenue,
  calculateCost,
  calculateProfit,
  calculateUtilization,
  calculateWeeklyTarget,
  calculateTimeBalance,
  formatCurrency,
  formatHours,
  formatPercentage,
  formatFixedBudget,
} from "@/lib/calculations";

describe("calculateRevenue", () => {
  it("multiplies hours by rate", () => {
    expect(calculateRevenue(10, 100)).toBe(1000);
  });
  it("returns 0 for zero hours", () => {
    expect(calculateRevenue(0, 100)).toBe(0);
  });
  it("returns 0 for zero rate", () => {
    expect(calculateRevenue(10, 0)).toBe(0);
  });
});

describe("calculateCost", () => {
  it("multiplies hours by cost rate", () => {
    expect(calculateCost(8, 50)).toBe(400);
  });
  it("returns 0 for zero inputs", () => {
    expect(calculateCost(0, 50)).toBe(0);
  });
});

describe("calculateProfit", () => {
  it("subtracts cost from revenue", () => {
    expect(calculateProfit(1000, 400)).toBe(600);
  });
  it("returns negative for loss", () => {
    expect(calculateProfit(200, 500)).toBe(-300);
  });
  it("returns 0 when equal", () => {
    expect(calculateProfit(500, 500)).toBe(0);
  });
});

describe("calculateUtilization", () => {
  it("calculates percentage of target", () => {
    expect(calculateUtilization(30, 40)).toBe(75);
  });
  it("returns 0 when target is 0", () => {
    expect(calculateUtilization(10, 0)).toBe(0);
  });
  it("can exceed 100%", () => {
    expect(calculateUtilization(50, 40)).toBe(125);
  });
});

describe("calculateWeeklyTarget", () => {
  it("returns the input value", () => {
    expect(calculateWeeklyTarget(37)).toBe(37);
  });
});

describe("calculateTimeBalance", () => {
  it("returns positive for overtime", () => {
    expect(calculateTimeBalance(42, 37)).toBe(5);
  });
  it("returns negative for under target", () => {
    expect(calculateTimeBalance(30, 37)).toBe(-7);
  });
  it("returns 0 when on target", () => {
    expect(calculateTimeBalance(37, 37)).toBe(0);
  });
});

describe("formatCurrency", () => {
  it("formats USD", () => {
    const result = formatCurrency(1234.56, "USD");
    expect(result).toContain("1,234.56");
  });
  it("formats DKK", () => {
    const result = formatCurrency(1234.56, "DKK");
    expect(result).toMatch(/1[.\s]?234/);
  });
  it("formats EUR", () => {
    const result = formatCurrency(1234.56, "EUR");
    expect(result).toMatch(/1[.\s]?234/);
  });
  it("defaults to USD", () => {
    const result = formatCurrency(100);
    expect(result).toContain("100");
  });
});

describe("formatHours", () => {
  it("formats with 1 decimal and h suffix", () => {
    expect(formatHours(8)).toBe("8.0h");
  });
  it("rounds to 1 decimal", () => {
    // JS toFixed uses banker's rounding: 7.55 → "7.5"
    expect(formatHours(7.55)).toBe("7.5h");
    expect(formatHours(7.56)).toBe("7.6h");
  });
});

describe("formatPercentage", () => {
  it("formats with 1 decimal and % suffix", () => {
    expect(formatPercentage(75)).toBe("75.0%");
  });
  it("rounds to 1 decimal", () => {
    expect(formatPercentage(33.333)).toBe("33.3%");
  });
});

describe("formatFixedBudget", () => {
  it("formats without decimals", () => {
    const result = formatFixedBudget(1234.56, "USD");
    expect(result).toContain("1,235");
    expect(result).not.toContain(".");
  });
  it("formats DKK without decimals", () => {
    const result = formatFixedBudget(5000, "DKK");
    expect(result).toMatch(/5[.\s]?000/);
  });
});
