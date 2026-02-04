import { describe, it, expect } from "vitest";
import {
  splitIntoChunks,
  scoreChunk,
  selectRelevantChunks,
  scrubPii,
  scrubKnownNames,
} from "@/lib/ai/redact-contract";

describe("splitIntoChunks", () => {
  it("splits text on double newlines", () => {
    const text = "Section one with enough text to pass.\n\nSection two with enough text to pass.";
    const chunks = splitIntoChunks(text);
    expect(chunks.length).toBe(2);
    expect(chunks[0]).toContain("Section one");
    expect(chunks[1]).toContain("Section two");
  });

  it("filters out very short fragments", () => {
    const text = "This is a real section with content.\n\nOk\n\nAnother real section with content.";
    const chunks = splitIntoChunks(text);
    // "Ok" is too short (< 20 chars) and should be filtered
    expect(chunks.length).toBe(2);
  });
});

describe("scoreChunk", () => {
  it("scores budget-related text higher", () => {
    const budgetChunk = "The maximum budget for this project is $50,000 with a fee cap of $100/hour.";
    const boilerplate = "This agreement is governed by the laws of Denmark.";
    expect(scoreChunk(budgetChunk)).toBeGreaterThan(scoreChunk(boilerplate));
  });

  it("scores scope-related text higher", () => {
    const scopeChunk = "The scope of services shall include deliverables for the web application.";
    const boilerplate = "Both parties agree to this document.";
    expect(scoreChunk(scopeChunk)).toBeGreaterThan(scoreChunk(boilerplate));
  });

  it("scores deadline-related text higher", () => {
    const deadlineChunk = "The deadline for completion is December 31, 2026. The term expires after 12 months.";
    const boilerplate = "This is page one of the contract.";
    expect(scoreChunk(deadlineChunk)).toBeGreaterThan(scoreChunk(boilerplate));
  });

  it("returns 0 for text with no relevant keywords", () => {
    const irrelevant = "The weather today is sunny and warm in Copenhagen.";
    expect(scoreChunk(irrelevant)).toBe(0);
  });
});

describe("selectRelevantChunks", () => {
  it("keeps all chunks if total is small (<= 15)", () => {
    const chunks = Array.from({ length: 10 }, (_, i) => `Chunk ${i} with some text`);
    const selected = selectRelevantChunks(chunks);
    expect(selected.length).toBe(10);
  });

  it("reduces large chunk lists to top scoring", () => {
    const chunks: string[] = [];
    // 18 boilerplate chunks
    for (let i = 0; i < 18; i++) {
      chunks.push(`This is standard legal boilerplate paragraph number ${i} with no relevant terms.`);
    }
    // 2 relevant chunks
    chunks.push("The maximum budget is $100,000 with a fee cap and payment schedule.");
    chunks.push("The scope of services includes deliverables and the deadline is June 2026.");

    const selected = selectRelevantChunks(chunks, 5);
    expect(selected.length).toBe(5);

    // The relevant chunks should be included
    const joined = selected.join(" ");
    expect(joined).toContain("budget");
    expect(joined).toContain("scope");
  });

  it("preserves original order of selected chunks", () => {
    const chunks = [
      "Intro paragraph with no keywords here at all.",
      "The budget is $50,000 with payment terms.",
      "More boilerplate legal text without keywords.",
      "The scope includes web development services.",
      "Another filler paragraph about nothing relevant.",
      "Even more generic text that has no value.",
      "The deadline for the project is December 2026.",
      "Boilerplate paragraph eight with nothing useful.",
      "Filler paragraph nine about standard terms.",
      "Filler paragraph ten about standard terms.",
      "Filler paragraph eleven about standard terms.",
      "Filler paragraph twelve about standard terms.",
      "Filler paragraph thirteen about standard terms.",
      "Filler paragraph fourteen about standard terms.",
      "Filler paragraph fifteen about standard terms.",
      "Filler paragraph sixteen about standard terms.",
    ];

    const selected = selectRelevantChunks(chunks, 3);
    // Budget chunk (index 1) should come before scope (index 3) should come before deadline (index 6)
    const budgetIdx = selected.findIndex((c) => c.includes("budget"));
    const scopeIdx = selected.findIndex((c) => c.includes("scope"));
    const deadlineIdx = selected.findIndex((c) => c.includes("deadline"));

    if (budgetIdx >= 0 && scopeIdx >= 0) {
      expect(budgetIdx).toBeLessThan(scopeIdx);
    }
    if (scopeIdx >= 0 && deadlineIdx >= 0) {
      expect(scopeIdx).toBeLessThan(deadlineIdx);
    }
  });
});

describe("scrubPii", () => {
  it("replaces email addresses", () => {
    const { scrubbed, count } = scrubPii("Contact john@example.com for details.");
    expect(scrubbed).toContain("[EMAIL_1]");
    expect(scrubbed).not.toContain("john@example.com");
    expect(count).toBeGreaterThan(0);
  });

  it("uses deterministic placeholders for same email", () => {
    const { scrubbed } = scrubPii("Email john@test.com and also john@test.com again.");
    const matches = scrubbed.match(/\[EMAIL_1\]/g);
    expect(matches?.length).toBe(2);
  });

  it("assigns different numbers to different emails", () => {
    const { scrubbed } = scrubPii("Contact a@test.com and b@test.com.");
    expect(scrubbed).toContain("[EMAIL_1]");
    expect(scrubbed).toContain("[EMAIL_2]");
  });

  it("replaces IBAN numbers", () => {
    const { scrubbed } = scrubPii("Payment to DK50 0040 0440 1162 43.");
    expect(scrubbed).toContain("[IBAN_1]");
  });

  it("replaces CVR numbers", () => {
    const { scrubbed } = scrubPii("Company CVR: DK12345678.");
    expect(scrubbed).toContain("[CVR_1]");
  });

  it("replaces Danish CPR-like numbers", () => {
    const { scrubbed } = scrubPii("CPR: 010190-1234 is sensitive.");
    expect(scrubbed).toContain("[CPR_1]");
  });

  it("replaces Danish postal codes", () => {
    const { scrubbed } = scrubPii("Address: 2100 København");
    expect(scrubbed).toContain("[POSTAL_1]");
  });

  it("preserves plain numbers that look like amounts", () => {
    const { scrubbed } = scrubPii("The budget is 50000 DKK.");
    // 50000 alone should not be scrubbed as a phone number
    expect(scrubbed).toContain("50000");
  });
});

describe("scrubKnownNames", () => {
  it("replaces company name", () => {
    const { scrubbed } = scrubKnownNames(
      "This contract is between Acme Corp and the client.",
      { companyName: "Acme Corp", employeeNames: [], projectNames: [] }
    );
    expect(scrubbed).toContain("[COMPANY]");
    expect(scrubbed).not.toContain("Acme Corp");
  });

  it("replaces employee full names", () => {
    const { scrubbed } = scrubKnownNames(
      "Project lead: John Doe. Reviewed by Jane Smith.",
      { companyName: "", employeeNames: ["John Doe", "Jane Smith"], projectNames: [] }
    );
    expect(scrubbed).toContain("[PERSON_1]");
    expect(scrubbed).toContain("[PERSON_2]");
    expect(scrubbed).not.toContain("John Doe");
    expect(scrubbed).not.toContain("Jane Smith");
  });

  it("replaces partial names (first name, last name)", () => {
    const { scrubbed } = scrubKnownNames(
      "John will handle the delivery.",
      { companyName: "", employeeNames: ["John Doe"], projectNames: [] }
    );
    // "John" alone should be scrubbed since it's part of a known employee
    expect(scrubbed).not.toContain("John");
  });

  it("replaces project names", () => {
    const { scrubbed } = scrubKnownNames(
      "This relates to the Website Redesign project.",
      { companyName: "", employeeNames: [], projectNames: ["Website Redesign"] }
    );
    expect(scrubbed).toContain("[PROJECT_1]");
    expect(scrubbed).not.toContain("Website Redesign");
  });

  it("handles longest match first", () => {
    const { scrubbed } = scrubKnownNames(
      "Acme Corporation and Acme Corp are the same.",
      { companyName: "Acme Corporation", employeeNames: [], projectNames: ["Acme Corp"] }
    );
    // "Acme Corporation" should be matched before "Acme Corp"
    expect(scrubbed).toContain("[COMPANY]");
  });

  it("preserves numbers and dates", () => {
    const { scrubbed } = scrubKnownNames(
      "Budget of 50000 DKK due by 2026-06-30 for Acme Corp.",
      { companyName: "Acme Corp", employeeNames: [], projectNames: [] }
    );
    expect(scrubbed).toContain("50000");
    expect(scrubbed).toContain("2026-06-30");
  });

  it("handles empty names gracefully", () => {
    const { scrubbed, count } = scrubKnownNames(
      "Just some text.",
      { companyName: "", employeeNames: [], projectNames: [] }
    );
    expect(scrubbed).toBe("Just some text.");
    expect(count).toBe(0);
  });

  it("skips very short name parts", () => {
    // "De" from "Jan De Vries" should be skipped (< 3 chars)
    const { scrubbed } = scrubKnownNames(
      "De is a common word. Jan De Vries leads the team.",
      { companyName: "", employeeNames: ["Jan De Vries"], projectNames: [] }
    );
    // "Jan De Vries" as full name should be replaced
    expect(scrubbed).not.toContain("Jan De Vries");
    // But standalone "De" at the beginning should still exist
    // (it was replaced as part of Jan De Vries in the second occurrence, but standalone De stays)
    expect(scrubbed.startsWith("De")).toBe(true);
  });
});
