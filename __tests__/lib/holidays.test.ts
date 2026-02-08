import { describe, it, expect } from "vitest";
import {
  getEasterDate,
  getDanishHolidays,
  isDanishHoliday,
  getHolidayName,
  getHolidayCode,
  isCompanyHoliday,
  getCompanyHolidayName,
  getCompanyHolidaysInRange,
} from "@/lib/holidays";

describe("getEasterDate", () => {
  it("returns correct Easter for 2024 (March 31)", () => {
    const easter = getEasterDate(2024);
    expect(easter.getFullYear()).toBe(2024);
    expect(easter.getMonth()).toBe(2); // March (0-indexed)
    expect(easter.getDate()).toBe(31);
  });

  it("returns correct Easter for 2025 (April 20)", () => {
    const easter = getEasterDate(2025);
    expect(easter.getFullYear()).toBe(2025);
    expect(easter.getMonth()).toBe(3); // April
    expect(easter.getDate()).toBe(20);
  });

  it("returns correct Easter for 2026 (April 5)", () => {
    const easter = getEasterDate(2026);
    expect(easter.getFullYear()).toBe(2026);
    expect(easter.getMonth()).toBe(3);
    expect(easter.getDate()).toBe(5);
  });

  it("returns correct Easter for 2027 (March 28)", () => {
    const easter = getEasterDate(2027);
    expect(easter.getFullYear()).toBe(2027);
    expect(easter.getMonth()).toBe(2);
    expect(easter.getDate()).toBe(28);
  });
});

describe("getDanishHolidays", () => {
  it("returns 11 holidays", () => {
    const holidays = getDanishHolidays(2025);
    expect(holidays).toHaveLength(11);
  });

  it("includes New Year's Day", () => {
    const holidays = getDanishHolidays(2025);
    expect(holidays.some((h) => h.code === "NEW_YEARS_DAY")).toBe(true);
  });

  it("includes Christmas holidays", () => {
    const holidays = getDanishHolidays(2025);
    const codes = holidays.map((h) => h.code);
    expect(codes).toContain("CHRISTMAS_EVE");
    expect(codes).toContain("CHRISTMAS_DAY");
    expect(codes).toContain("SECOND_CHRISTMAS_DAY");
  });

  it("does NOT include Store Bededag", () => {
    const holidays = getDanishHolidays(2025);
    expect(holidays.some((h) => h.code === "STORE_BEDEDAG")).toBe(false);
  });

  it("does NOT include Grundlovsdag", () => {
    const holidays = getDanishHolidays(2025);
    expect(holidays.some((h) => h.code === "CONSTITUTION_DAY")).toBe(false);
  });

  it("caches results for same year", () => {
    const a = getDanishHolidays(2025);
    const b = getDanishHolidays(2025);
    expect(a).toBe(b); // Same reference
  });

  it("Easter-dependent holidays are correct for 2025", () => {
    const holidays = getDanishHolidays(2025);
    // Easter 2025 = April 20
    const byCode = (code: string) => holidays.find((h) => h.code === code)!;

    // Maundy Thursday = Easter - 3 = April 17
    expect(byCode("MAUNDY_THURSDAY").date.getDate()).toBe(17);
    expect(byCode("MAUNDY_THURSDAY").date.getMonth()).toBe(3);

    // Good Friday = Easter - 2 = April 18
    expect(byCode("GOOD_FRIDAY").date.getDate()).toBe(18);

    // Easter Monday = Easter + 1 = April 21
    expect(byCode("EASTER_MONDAY").date.getDate()).toBe(21);

    // Ascension = Easter + 39 = May 29
    expect(byCode("ASCENSION_DAY").date.getMonth()).toBe(4); // May
    expect(byCode("ASCENSION_DAY").date.getDate()).toBe(29);

    // Whit Sunday = Easter + 49 = June 8
    expect(byCode("WHIT_SUNDAY").date.getMonth()).toBe(5); // June
    expect(byCode("WHIT_SUNDAY").date.getDate()).toBe(8);

    // Whit Monday = Easter + 50 = June 9
    expect(byCode("WHIT_MONDAY").date.getDate()).toBe(9);
  });
});

describe("isDanishHoliday", () => {
  it("returns true for Jan 1", () => {
    expect(isDanishHoliday(new Date(2025, 0, 1))).toBe(true);
  });

  it("returns true for Dec 25", () => {
    expect(isDanishHoliday(new Date(2025, 11, 25))).toBe(true);
  });

  it("returns false for a regular day", () => {
    expect(isDanishHoliday(new Date(2025, 0, 2))).toBe(false);
  });

  it("works with string dates", () => {
    expect(isDanishHoliday("2025-01-01")).toBe(true);
    expect(isDanishHoliday("2025-01-02")).toBe(false);
  });

  it("works with ISO strings", () => {
    expect(isDanishHoliday("2025-12-25T10:00:00.000Z")).toBe(true);
  });
});

describe("getHolidayName", () => {
  it("returns English name by default", () => {
    expect(getHolidayName("2025-01-01")).toBe("New Year's Day");
  });

  it("returns Danish name when locale is da", () => {
    expect(getHolidayName("2025-01-01", "da")).toBe("Nytårsdag");
  });

  it("returns null for non-holiday", () => {
    expect(getHolidayName("2025-01-02")).toBeNull();
  });
});

describe("getHolidayCode", () => {
  it("returns code for holiday", () => {
    expect(getHolidayCode("2025-01-01")).toBe("NEW_YEARS_DAY");
  });

  it("returns null for non-holiday", () => {
    expect(getHolidayCode("2025-01-02")).toBeNull();
  });
});

describe("isCompanyHoliday", () => {
  it("returns true for enabled Danish holiday", () => {
    expect(isCompanyHoliday("2025-01-01", [], [])).toBe(true);
  });

  it("returns false for disabled Danish holiday", () => {
    expect(isCompanyHoliday("2025-01-01", ["NEW_YEARS_DAY"], [])).toBe(false);
  });

  it("returns true for custom recurring holiday", () => {
    const customs = [{ name: "Company Day", month: 6, day: 15 }];
    expect(isCompanyHoliday("2025-06-15", [], customs)).toBe(true);
    expect(isCompanyHoliday("2026-06-15", [], customs)).toBe(true);
  });

  it("returns true for custom one-time holiday", () => {
    const customs = [{ name: "Special Day", month: 3, day: 10, year: 2025 }];
    expect(isCompanyHoliday("2025-03-10", [], customs)).toBe(true);
    expect(isCompanyHoliday("2026-03-10", [], customs)).toBe(false);
  });

  it("returns false for non-holiday", () => {
    expect(isCompanyHoliday("2025-07-15", [], [])).toBe(false);
  });
});

describe("getCompanyHolidayName", () => {
  it("returns Danish holiday name when enabled", () => {
    expect(getCompanyHolidayName("2025-01-01", "en")).toBe("New Year's Day");
  });

  it("returns null when Danish holiday is disabled", () => {
    expect(getCompanyHolidayName("2025-01-01", "en", ["NEW_YEARS_DAY"])).toBeNull();
  });

  it("returns custom holiday name", () => {
    const customs = [{ name: "Firmafest", month: 9, day: 1 }];
    expect(getCompanyHolidayName("2025-09-01", "en", [], customs)).toBe("Firmafest");
  });
});

describe("getCompanyHolidaysInRange", () => {
  it("returns holidays within date range", () => {
    const result = getCompanyHolidaysInRange("2025-12-20", "2025-12-31");
    const codes = result.map((r) => r.code).filter(Boolean);
    expect(codes).toContain("CHRISTMAS_EVE");
    expect(codes).toContain("CHRISTMAS_DAY");
    expect(codes).toContain("SECOND_CHRISTMAS_DAY");
  });

  it("excludes disabled holidays", () => {
    const result = getCompanyHolidaysInRange("2025-12-20", "2025-12-31", ["CHRISTMAS_EVE"]);
    const codes = result.map((r) => r.code).filter(Boolean);
    expect(codes).not.toContain("CHRISTMAS_EVE");
    expect(codes).toContain("CHRISTMAS_DAY");
  });

  it("includes custom holidays", () => {
    const customs = [{ name: "Firmafest", month: 12, day: 28 }];
    const result = getCompanyHolidaysInRange("2025-12-20", "2025-12-31", [], customs);
    expect(result.some((r) => r.name === "Firmafest")).toBe(true);
  });

  it("returns sorted by date", () => {
    const result = getCompanyHolidaysInRange("2025-01-01", "2025-12-31");
    for (let i = 1; i < result.length; i++) {
      expect(result[i].date.getTime()).toBeGreaterThanOrEqual(result[i - 1].date.getTime());
    }
  });

  it("spans multiple years correctly", () => {
    const result = getCompanyHolidaysInRange("2025-12-30", "2026-01-02");
    const names = result.map((r) => r.name);
    // Should include 2025 Dec holidays and 2026 Jan 1
    expect(names).toContain("Nytårsdag"); // 2026 Jan 1
  });
});
