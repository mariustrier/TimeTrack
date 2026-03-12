import { describe, it, expect, vi } from "vitest";

// Mock xlsx module
vi.mock("xlsx", () => {
  const mockSSF = {
    parse_date_code: (serial: number) => {
      // Simplified Excel date serial conversion
      const d = new Date((serial - 25569) * 86400 * 1000);
      return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
    },
  };

  return {
    default: {
      read: vi.fn(),
      utils: { decode_range: vi.fn(), encode_cell: vi.fn() },
      SSF: mockSSF,
    },
    read: vi.fn(),
    utils: {
      decode_range: (ref: string) => {
        const match = ref.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
        if (match) {
          return { s: { r: 0, c: 0 }, e: { r: parseInt(match[4]) - 1, c: 10 } };
        }
        return { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
      },
      encode_cell: ({ r, c }: { r: number; c: number }) => {
        const col = String.fromCharCode(65 + c);
        return `${col}${r + 1}`;
      },
    },
    SSF: mockSSF,
  };
});

// Helper to build a mock workbook for the parser
const buildMockWorkbook = (rows: Record<string, unknown>[]) => {
  const cells: Record<string, { v: unknown; s?: { font?: { bold?: boolean } } }> = {};
  let maxRow = 0;
  let maxCol = 0;

  rows.forEach((row, rowIdx) => {
    Object.entries(row).forEach(([colStr, val]) => {
      const colIdx = colStr.charCodeAt(0) - 65;
      const cellRef = `${colStr}${rowIdx + 1}`;
      if (typeof val === "object" && val !== null && "v" in val) {
        cells[cellRef] = val as { v: unknown; s?: { font?: { bold?: boolean } } };
      } else {
        cells[cellRef] = { v: val };
      }
      maxCol = Math.max(maxCol, colIdx);
      maxRow = Math.max(maxRow, rowIdx);
    });
  });

  cells["!ref"] = { v: `A1:${String.fromCharCode(65 + maxCol)}${maxRow + 1}` } as unknown as typeof cells[string];

  return {
    SheetNames: ["Sheet1"],
    Sheets: {
      Sheet1: {
        ...cells,
        "!ref": `A1:${String.fromCharCode(65 + maxCol)}${maxRow + 1}`,
      },
    },
  };
};

// We need to import after mock setup
import * as XLSX from "xlsx";

// Since the parser is tightly coupled with xlsx, let's test the classification logic
// by importing the parser and mocking xlsx.read
import { parseProjektkort } from "@/lib/economic-projektkort-parser";

describe("parseProjektkort", () => {
  it("parses basic projektkort with activities and entries", () => {
    const wb = buildMockWorkbook([
      // Row 1 (index 0): empty
      {},
      // Row 2 (index 1): Company name
      { A: "1431928 - Test Company ApS" },
      // Row 3 (index 2): empty
      {},
      // Row 4 (index 3): Period
      { A: "Projektkort for perioden 01.01.25 - 31.12.25" },
      // Row 5 (index 4): empty
      {},
      // Row 6 (index 5): Headers
      { A: "Dato", B: "Bilag", C: "Navn", D: "Opgave", F: "Antal", G: "Kostpris", I: "Salgspris" },
      // Row 7 (index 6): Project header
      { A: "Projektkort for projekt 2025001 - Test Project" },
      // Row 8 (index 7): REGISTRERING section
      { A: "UDGANGSPUNKT I REGISTRERING:" },
      // Row 9 (index 8): Tid:
      { A: "Tid:" },
      // Row 10 (index 9): Activity header - billable
      { A: { v: "4 - SKITSEFORSLAG", s: { font: { bold: true } } } },
      // Row 11 (index 10): Entry 1
      { A: "01.03.25", B: "600000", C: "Julie", D: "Design work", F: 4.5, G: 2250, I: 5400 },
      // Row 12 (index 11): Entry 2
      { A: "02.03.25", B: "600000", C: "Julie", D: "More design", F: 3.0, G: 1500, I: 3600 },
      // Row 13 (index 12): Subtotal
      { A: { v: "Subtotal", s: { font: { bold: true } } }, F: 7.5, G: 3750, I: 9000 },
      // Row 14 (index 13): Activity header - non-billable
      { A: { v: "1 - Korrespondance", s: { font: { bold: true } } } },
      // Row 15 (index 14): Entry with salgspris=0
      { A: "03.03.25", B: "600000", C: "Citlali", D: "Emails", F: 2.0, G: 800, I: 0 },
      // Row 16 (index 15): Subtotal
      { A: { v: "Subtotal", s: { font: { bold: true } } }, F: 2.0, G: 800, I: 0 },
      // Row 17 (index 16): Grand total
      { A: "Tid i alt", F: 9.5, G: 4550, I: 9000 },
    ]);

    // Mock xlsx.read to return our workbook
    vi.mocked(XLSX.read).mockReturnValue(wb as unknown as XLSX.WorkBook);

    const result = parseProjektkort(new ArrayBuffer(0));

    expect(result.companyName).toBe("Test Company ApS");
    expect(result.projectNumber).toBe("2025001");
    expect(result.projectName).toBe("Test Project");
    expect(result.period.from).toBe("2025-01-01");
    expect(result.period.to).toBe("2025-12-31");
    expect(result.activities).toHaveLength(2);

    // Activity 4 - all entries have salgspris > 0 → billable
    const act4 = result.activities.find((a) => a.number === 4);
    expect(act4).toBeDefined();
    expect(act4!.suggestedBillingStatus).toBe("billable");
    expect(act4!.billableEntryCount).toBe(2);
    expect(act4!.nonBillableEntryCount).toBe(0);
    expect(act4!.entries).toHaveLength(2);

    // Activity 1 - all entries have salgspris = 0 → nonBillable
    const act1 = result.activities.find((a) => a.number === 1);
    expect(act1).toBeDefined();
    expect(act1!.suggestedBillingStatus).toBe("nonBillable");
    expect(act1!.billableEntryCount).toBe(0);
    expect(act1!.nonBillableEntryCount).toBe(1);
  });

  it("classifies mixed activities correctly", () => {
    const wb = buildMockWorkbook([
      {},
      { A: "1431928 - Test Company" },
      {},
      { A: "Projektkort for perioden 01.01.25 - 31.12.25" },
      {},
      { A: "Dato" },
      { A: "Projektkort for projekt 2025002 - Mixed Project" },
      { A: "UDGANGSPUNKT I REGISTRERING:" },
      { A: "Tid:" },
      // Mixed activity: some entries billable, some not
      { A: { v: "5 - MYNDIGHED", s: { font: { bold: true } } } },
      { A: "01.03.25", B: "600000", C: "Julie", D: "Design", F: 3.0, G: 1500, I: 3600 },
      { A: "02.03.25", B: "600000", C: "Citlali", D: "Admin", F: 2.0, G: 800, I: 0 },
      { A: "03.03.25", B: "600000", C: "Julie", D: "More work", F: 1.0, G: 500, I: 1200 },
      { A: { v: "Subtotal", s: { font: { bold: true } } }, F: 6.0, G: 2800, I: 4800 },
      { A: "Tid i alt", F: 6.0, G: 2800, I: 4800 },
    ]);

    vi.mocked(XLSX.read).mockReturnValue(wb as unknown as XLSX.WorkBook);

    const result = parseProjektkort(new ArrayBuffer(0));

    expect(result.activities).toHaveLength(1);
    const act = result.activities[0];
    expect(act.number).toBe(5);
    expect(act.suggestedBillingStatus).toBe("mixed");
    expect(act.billableEntryCount).toBe(2); // Julie entries with salgspris > 0
    expect(act.nonBillableEntryCount).toBe(1); // Citlali entry with salgspris = 0
  });

  it("extracts period from entry dates when header period is missing", () => {
    const wb = buildMockWorkbook([
      {},
      { A: "1431928 - Test" },
      {},
      { A: "Projektkort for some text without dates" },
      {},
      { A: "Dato" },
      { A: "Projektkort for projekt 2025003 - No Period" },
      { A: "UDGANGSPUNKT I REGISTRERING:" },
      { A: "Tid:" },
      { A: { v: "1 - Test", s: { font: { bold: true } } } },
      { A: "15.06.25", B: "600000", C: "Alice", D: "Work", F: 1.0, G: 500, I: 0 },
      { A: "20.08.25", B: "600000", C: "Alice", D: "More work", F: 2.0, G: 1000, I: 0 },
      { A: { v: "Subtotal", s: { font: { bold: true } } }, F: 3.0 },
      { A: "Tid i alt", F: 3.0 },
    ]);

    vi.mocked(XLSX.read).mockReturnValue(wb as unknown as XLSX.WorkBook);

    const result = parseProjektkort(new ArrayBuffer(0));

    expect(result.period.from).toBe("2025-06-15");
    expect(result.period.to).toBe("2025-08-20");
  });
});
