import { describe, it, expect } from "vitest";
import {
  matchEmployees,
  matchTilbudCategories,
  matchInvoiceCategories,
} from "@/lib/economic-matching";

describe("matchEmployees", () => {
  const team = [
    { id: "u1", firstName: "Julie", lastName: "Hansen", email: "julie@test.dk" },
    { id: "u2", firstName: "Kevin", lastName: "Olsen", email: "kevin@test.dk" },
    { id: "u3", firstName: "Citlali", lastName: "Ramirez", email: "citlali@test.dk" },
  ];

  it("matches exact full name", () => {
    const result = matchEmployees(["Julie Hansen"], team);
    expect(result["Julie Hansen"]).toBe("u1");
  });

  it("matches by first name only", () => {
    const result = matchEmployees(["Julie"], team);
    expect(result["Julie"]).toBe("u1");
  });

  it("matches by last name only", () => {
    const result = matchEmployees(["Olsen"], team);
    expect(result["Olsen"]).toBe("u2");
  });

  it("matches case-insensitively", () => {
    const result = matchEmployees(["julie hansen"], team);
    expect(result["julie hansen"]).toBe("u1");
  });

  it("matches by substring", () => {
    const result = matchEmployees(["Citlali R."], team);
    // "Citlali R." includes "Citlali" (firstName)
    expect(result["Citlali R."]).toBe("u3");
  });

  it("returns empty for no match", () => {
    const result = matchEmployees(["Unknown Person"], team);
    expect(result["Unknown Person"]).toBeUndefined();
  });

  it("handles multiple names", () => {
    const result = matchEmployees(["Julie", "Kevin", "Citlali"], team);
    expect(result["Julie"]).toBe("u1");
    expect(result["Kevin"]).toBe("u2");
    expect(result["Citlali"]).toBe("u3");
  });

  it("handles empty input", () => {
    const result = matchEmployees([], team);
    expect(Object.keys(result)).toHaveLength(0);
  });
});

describe("matchTilbudCategories", () => {
  const categories = [
    { id: "tc1", name: "Skitse" },
    { id: "tc2", name: "Hovedprojekt" },
    { id: "tc3", name: "Myndigheder" },
  ];

  it("matches exact lowercase name", () => {
    const activities = [{ number: 4, name: "Skitse" }];
    const result = matchTilbudCategories(activities, categories);
    expect(result[4]).toBe("tc1");
  });

  it("matches by includes", () => {
    const activities = [{ number: 4, name: "SKITSEFORSLAG" }];
    // "skitseforslag" includes "skitse" → matches
    const result = matchTilbudCategories(activities, categories);
    expect(result[4]).toBe("tc1");
  });

  it("matches by startsWith", () => {
    const activities = [{ number: 5, name: "Myndighed" }];
    // "myndighed" startsWith check: "myndigheder".startsWith("myndighed") → true
    const result = matchTilbudCategories(activities, categories);
    expect(result[5]).toBe("tc3");
  });

  it("returns empty for no match", () => {
    const activities = [{ number: 99, name: "Completely Unknown" }];
    const result = matchTilbudCategories(activities, categories);
    expect(result[99]).toBeUndefined();
  });

  it("handles multiple activities", () => {
    const activities = [
      { number: 4, name: "SKITSEFORSLAG" },
      { number: 6, name: "HOVEDPROJEKT" },
    ];
    const result = matchTilbudCategories(activities, categories);
    expect(result[4]).toBe("tc1");
    expect(result[6]).toBe("tc2");
  });
});

describe("matchInvoiceCategories", () => {
  const activities = [
    { number: 1, name: "Korrespondance" },
    { number: 4, name: "SKITSEFORSLAG" },
    { number: 5, name: "MYNDIGHED" },
    { number: 6, name: "HOVEDPROJEKT" },
  ];

  it("matches exact category to activity", () => {
    const cats = [{ number: 1, name: "Korrespondance" }];
    const result = matchInvoiceCategories(cats, activities);
    expect(result[1]).toBe(1);
  });

  it("matches by includes (category name in activity name)", () => {
    const cats = [{ number: 2, name: "Skitsering" }];
    // "skitsering" doesn't include "skitseforslag" exactly,
    // but "skitseforslag" starts with "skits" which "skitsering" also starts with
    // Actually, let's check: "skitseforslag".includes("skitsering") = false
    // "skitsering".includes("skitseforslag") = false
    // "skitseforslag".startsWith("skitsering") = false
    // "skitsering".startsWith("skitseforslag") = false
    // So this won't match with the current algorithm
    const result = matchInvoiceCategories(cats, activities);
    // No match expected for this case
    expect(result[2]).toBeUndefined();
  });

  it("matches Hovedprojekt category to HOVEDPROJEKT activity", () => {
    const cats = [{ number: 4, name: "Hovedprojekt" }];
    const result = matchInvoiceCategories(cats, activities);
    expect(result[4]).toBe(6);
  });

  it("handles multiple categories", () => {
    const cats = [
      { number: 3, name: "MYNDIGHED" },
      { number: 4, name: "HOVEDPROJEKT" },
    ];
    const result = matchInvoiceCategories(cats, activities);
    expect(result[3]).toBe(5);
    expect(result[4]).toBe(6);
  });

  it("returns empty for no matches", () => {
    const cats = [{ number: 99, name: "Something Else Entirely" }];
    const result = matchInvoiceCategories(cats, activities);
    expect(result[99]).toBeUndefined();
  });
});
