import { describe, it, expect } from "vitest";
import { getWeekBounds, getWeekId } from "@/lib/week-helpers";

describe("getWeekBounds", () => {
  it("returns Monday-Sunday for a Wednesday", () => {
    // 2024-01-10 is a Wednesday
    const { weekStart, weekEnd } = getWeekBounds(new Date(2024, 0, 10));
    expect(weekStart.getDay()).toBe(1); // Monday
    expect(weekEnd.getDay()).toBe(0); // Sunday
    expect(weekStart.getDate()).toBe(8); // Monday Jan 8
    expect(weekEnd.getDate()).toBe(14); // Sunday Jan 14
  });

  it("returns same week when given a Monday", () => {
    // 2024-01-08 is a Monday
    const { weekStart, weekEnd } = getWeekBounds(new Date(2024, 0, 8));
    expect(weekStart.getDate()).toBe(8);
    expect(weekEnd.getDate()).toBe(14);
  });

  it("returns previous Monday when given a Sunday", () => {
    // 2024-01-14 is a Sunday
    const { weekStart, weekEnd } = getWeekBounds(new Date(2024, 0, 14));
    expect(weekStart.getDate()).toBe(8);
    expect(weekEnd.getDate()).toBe(14);
  });

  it("accepts string dates", () => {
    const { weekStart } = getWeekBounds("2024-01-10");
    expect(weekStart.getDay()).toBe(1);
  });
});

describe("getWeekId", () => {
  it("returns yyyy-MM-dd format of Monday", () => {
    // 2024-01-10 is a Wednesday, Monday is Jan 8
    expect(getWeekId(new Date(2024, 0, 10))).toBe("2024-01-08");
  });

  it("returns same date for Monday input", () => {
    expect(getWeekId(new Date(2024, 0, 8))).toBe("2024-01-08");
  });

  it("accepts string dates", () => {
    expect(getWeekId("2024-01-10")).toBe("2024-01-08");
  });
});
