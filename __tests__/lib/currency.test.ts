import { describe, it, expect } from "vitest";
import {
  convertCurrency,
  smartRound,
  convertAndRound,
  convertAndFormat,
  convertAndFormatBudget,
} from "@/lib/currency";

describe("convertCurrency", () => {
  it("returns same amount for same currency", () => {
    expect(convertCurrency(100, "USD", "USD")).toBe(100);
  });

  it("converts USD to DKK", () => {
    // 1 USD = 6.85 DKK, so 100 USD = 685 DKK
    expect(convertCurrency(100, "USD", "DKK")).toBeCloseTo(685, 0);
  });

  it("converts DKK to EUR", () => {
    // 100 DKK / 7.46 = ~13.40 EUR
    expect(convertCurrency(100, "DKK", "EUR")).toBeCloseTo(13.4, 0);
  });

  it("converts USD to EUR via DKK", () => {
    // 100 USD * 6.85 / 7.46 = ~91.82 EUR
    expect(convertCurrency(100, "USD", "EUR")).toBeCloseTo(91.8, 0);
  });

  it("returns same amount for unknown currency", () => {
    expect(convertCurrency(100, "XYZ", "USD")).toBe(100);
    expect(convertCurrency(100, "USD", "XYZ")).toBe(100);
  });
});

describe("smartRound", () => {
  it("rounds values < 100 to nearest 1", () => {
    expect(smartRound(42.7)).toBe(43);
    expect(smartRound(99.4)).toBe(99);
  });

  it("rounds values 100-999 to nearest 5", () => {
    expect(smartRound(123)).toBe(125);
    expect(smartRound(997)).toBe(995);
  });

  it("rounds values 1000-9999 to nearest 50", () => {
    expect(smartRound(1234)).toBe(1250);
    expect(smartRound(5678)).toBe(5700);
  });

  it("rounds values 10000-99999 to nearest 500", () => {
    expect(smartRound(12345)).toBe(12500);
    expect(smartRound(87654)).toBe(87500);
  });

  it("rounds values >= 100000 to nearest 1000", () => {
    expect(smartRound(123456)).toBe(123000);
    expect(smartRound(999500)).toBe(1000000);
  });

  it("handles negative values", () => {
    expect(smartRound(-42.7)).toBe(-43);
    expect(smartRound(-1234)).toBe(-1250);
  });
});

describe("convertAndRound", () => {
  it("returns same amount for same currency", () => {
    expect(convertAndRound(100, "USD", "USD")).toBe(100);
  });

  it("converts and rounds", () => {
    const result = convertAndRound(100, "USD", "DKK");
    // 685 DKK, smartRound(685) = 685 (nearest 5)
    expect(result).toBe(685);
  });
});

describe("convertAndFormat", () => {
  it("returns a formatted currency string", () => {
    const result = convertAndFormat(100, "USD", "USD");
    expect(result).toContain("100");
  });

  it("converts and formats to target currency", () => {
    const result = convertAndFormat(100, "USD", "DKK");
    expect(result).toMatch(/\d/);
  });
});

describe("convertAndFormatBudget", () => {
  it("returns formatted string without decimals", () => {
    const result = convertAndFormatBudget(1234, "USD", "USD");
    expect(result).toContain("1,234");
    expect(result).not.toMatch(/\.\d/);
  });
});
