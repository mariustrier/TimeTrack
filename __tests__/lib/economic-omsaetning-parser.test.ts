import { describe, it, expect, vi } from "vitest";

// Mock xlsx module
vi.mock("xlsx", () => {
  return {
    default: {
      read: vi.fn(),
      utils: { decode_range: vi.fn(), encode_cell: vi.fn() },
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
  };
});

const buildMockWorkbook = (rows: Record<string, unknown>[]) => {
  const cells: Record<string, unknown> = {};
  let maxRow = 0;
  let maxCol = 0;

  rows.forEach((row, rowIdx) => {
    Object.entries(row).forEach(([colStr, val]) => {
      const colIdx = colStr.charCodeAt(0) - 65;
      const cellRef = `${colStr}${rowIdx + 1}`;
      if (typeof val === "object" && val !== null && "v" in val) {
        cells[cellRef] = val;
      } else {
        cells[cellRef] = { v: val };
      }
      maxCol = Math.max(maxCol, colIdx);
      maxRow = Math.max(maxRow, rowIdx);
    });
  });

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

import * as XLSX from "xlsx";
import { parseOmsaetningsstatistik } from "@/lib/economic-omsaetning-parser";

describe("parseOmsaetningsstatistik", () => {
  it("parses categories and project entries", () => {
    const wb = buildMockWorkbook([
      // Row 1 (index 0): empty
      {},
      // Row 2 (index 1): Company name
      { A: "1431928 - Test Company ApS" },
      // Rows 3-6 (index 2-5): misc
      {}, {}, {}, {},
      // Row 7 (index 6): Headers
      { A: "Nr.", B: "Kunde", C: "Gruppe", D: "Antal", E: "Omsætning", F: "Omkostninger", G: "Bruttofortj.", H: "Brutto%" },
      // Row 8 (index 7): Category header
      { A: { v: "1 - Intromøde", s: { font: { bold: true } } } },
      // Row 9 (index 8): Project entry
      { A: "2025017", B: "Jørgen K. Knudsen", C: "Private", D: 3, E: 3240, F: 1350, G: 1890, H: 58.33 },
      // Row 10 (index 9): Subtotal
      { A: { v: "", s: { font: { bold: true } } }, B: "Intromøde in total:", D: 3, E: 3240, F: 1350, G: 1890, H: 58.33 },
      // Row 11 (index 10): Category header
      { A: { v: "2 - Skitsering", s: { font: { bold: true } } } },
      // Row 12 (index 11): Project entry
      { A: "2025017", B: "Jørgen K. Knudsen", C: "Private", D: 11, E: 11880, F: 4950, G: 6930, H: 58.33 },
      // Row 13 (index 12): Subtotal
      { B: "Skitsering in total:", D: 11, E: 11880, F: 4950, G: 6930, H: 58.33 },
      // Row 14 (index 13): Grand total
      { B: "Total:", D: 14, E: 15120, F: 6300, G: 8820, H: 58.33 },
    ]);

    vi.mocked(XLSX.read).mockReturnValue(wb as unknown as XLSX.WorkBook);

    const result = parseOmsaetningsstatistik(new ArrayBuffer(0));

    expect(result.companyName).toBe("Test Company ApS");
    expect(result.categories).toHaveLength(2);

    // Category 1
    expect(result.categories[0].number).toBe(1);
    expect(result.categories[0].name).toBe("Intromøde");
    expect(result.categories[0].projectEntries).toHaveLength(1);
    expect(result.categories[0].projectEntries[0].projectNumber).toBe("2025017");
    expect(result.categories[0].subtotal.hours).toBe(3);
    expect(result.categories[0].subtotal.revenue).toBe(3240);

    // Category 2
    expect(result.categories[1].number).toBe(2);
    expect(result.categories[1].name).toBe("Skitsering");
    expect(result.categories[1].subtotal.hours).toBe(11);

    // Totals
    expect(result.totals.hours).toBe(14);
    expect(result.totals.revenue).toBe(15120);
    expect(result.totals.grossProfit).toBe(8820);
  });

  it("handles empty file", () => {
    const wb = buildMockWorkbook([{}]);

    vi.mocked(XLSX.read).mockReturnValue(wb as unknown as XLSX.WorkBook);

    const result = parseOmsaetningsstatistik(new ArrayBuffer(0));

    expect(result.categories).toHaveLength(0);
    expect(result.totals.hours).toBe(0);
  });

  it("handles single category", () => {
    const wb = buildMockWorkbook([
      {},
      { A: "Company" },
      {}, {}, {}, {},
      { A: "Nr." },
      { A: { v: "5 - Licitation", s: { font: { bold: true } } } },
      { A: "2025017", B: "Customer", C: "Group", D: 16, E: 17280, F: 7200, G: 10080, H: 58.33 },
      { B: "Licitation in total:", D: 16, E: 17280, F: 7200, G: 10080 },
      { B: "Total:", D: 16, E: 17280, F: 7200, G: 10080 },
    ]);

    vi.mocked(XLSX.read).mockReturnValue(wb as unknown as XLSX.WorkBook);

    const result = parseOmsaetningsstatistik(new ArrayBuffer(0));

    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].number).toBe(5);
    expect(result.categories[0].name).toBe("Licitation");
    expect(result.categories[0].subtotal.hours).toBe(16);
    expect(result.totals.hours).toBe(16);
  });
});
