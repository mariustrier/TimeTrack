import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseEconomicFile } from "@/lib/economic-import";

function buildMockWorkbook(rows: unknown[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return buf;
}

const HEADER_ROWS = [
  [null], // Row 0 (empty)
  ["1431928 - Z.o.o.m Arkitekter ApS"], // Row 1
  ["Rapporter » Projekter »"], // Row 2
  ["Projektkort - projekt 2025017"], // Row 3
  [null], // Row 4 (empty)
  ["Dato", "Bilag", "Navn", "Opgave - Tekst", "Overskrift", "Antal", "Kostpris", "Procentdel", "Salgspris", "Faktureret"], // Row 5
  ["Underprojekt 2025017 - Blidahpark 5"], // Row 6
];

function buildFullWorkbook() {
  return buildMockWorkbook([
    ...HEADER_ROWS,
    // Invoice section
    ["UDGANGSPUNKT I FAKTURERING"],
    [new Date("2025-10-15"), "12345", null, "Faktura", null, null, null, null, null, 50000],
    [new Date("2025-11-20"), "12346", null, "Faktura", null, null, null, null, null, 30000],
    ["I ALT", null, null, null, null, null, null, null, null, 80000],
    // Registration section
    ["UDGANGSPUNKT I REGISTRERING"],
    ["Tid:"],
    // Category 1
    ["1 - Korrespondance"],
    [new Date("2025-09-15"), "600000", "Julie Trier Brøgger", "KorrespondanceVermland køkken", null, 1, 310, null, 950, 0],
    [new Date("2025-09-16"), "600000", "Citlali Steninge", "Korrespondance", null, 0.5, 0, null, 0, 0],
    ["Subtotal", null, null, null, null, 1.5],
    // Category 4
    ["4 - Skitseforslag"],
    [new Date("2025-10-01"), "600000", "Julie Trier Brøgger", "Skitseforslag", null, 2, 620, null, 56000, 0],
    [new Date("2025-10-02"), "600000", "Kevin James Bailey", "SkitseforslagRet tegninger", null, 3.5, 1085, null, 3325, 0],
    ["Subtotal", null, null, null, null, 5.5],
    // Category 6
    ["6 - Hovedprojekt"],
    [new Date("2025-11-05"), "600000", "Kevin James Bailey", "HovedprojektRet badeværelse", null, 1, 310, null, 950, 0],
    ["Subtotal", null, null, null, null, 1],
    // Summary rows
    ["Tid i alt", null, null, null, null, 8],
    ["Uden fordeling"],
    ["I ALT"],
    ["Dækningsbidrag"],
    ["Dækningsgrad"],
    ["Over-/underdækning"],
  ]);
}

describe("parseEconomicFile", () => {
  it("extracts company info from header", () => {
    const data = parseEconomicFile(buildFullWorkbook());
    expect(data.sourceCompanyId).toBe("1431928");
    expect(data.sourceCompanyName).toBe("Z.o.o.m Arkitekter ApS");
  });

  it("extracts project number and name", () => {
    const data = parseEconomicFile(buildFullWorkbook());
    expect(data.projectNumber).toBe("2025017");
    expect(data.projectName).toBe("Blidahpark 5");
  });

  it("parses invoices correctly", () => {
    const data = parseEconomicFile(buildFullWorkbook());
    expect(data.invoices).toHaveLength(2);
    expect(data.invoices[0].invoiceNumber).toBe("12345");
    expect(data.invoices[0].amount).toBe(50000);
    expect(data.invoices[1].amount).toBe(30000);
    expect(data.totalInvoiced).toBe(80000);
  });

  it("extracts unique employees", () => {
    const data = parseEconomicFile(buildFullWorkbook());
    expect(data.uniqueEmployees).toEqual([
      "Citlali Steninge",
      "Julie Trier Brøgger",
      "Kevin James Bailey",
    ]);
  });

  it("parses all time entries", () => {
    const data = parseEconomicFile(buildFullWorkbook());
    expect(data.timeEntries).toHaveLength(5);
  });

  it("calculates correct totals", () => {
    const data = parseEconomicFile(buildFullWorkbook());
    expect(data.totalHours).toBe(8);
  });

  it("extracts task categories", () => {
    const data = parseEconomicFile(buildFullWorkbook());
    expect(data.taskCategories).toHaveLength(3);
    expect(data.taskCategories[0].number).toBe(1);
    expect(data.taskCategories[0].name).toBe("Korrespondance");
    expect(data.taskCategories[0].subtotalHours).toBe(1.5);
    expect(data.taskCategories[1].number).toBe(4);
    expect(data.taskCategories[1].name).toBe("Skitseforslag");
    expect(data.taskCategories[2].number).toBe(6);
    expect(data.taskCategories[2].name).toBe("Hovedprojekt");
  });

  it("cleans descriptions by stripping category prefix", () => {
    const data = parseEconomicFile(buildFullWorkbook());
    // "KorrespondanceVermland køkken" -> "Vermland køkken"
    const entry1 = data.timeEntries.find(
      (e) => e.employeeName === "Julie Trier Brøgger" && e.categoryNumber === 1
    );
    expect(entry1?.description).toBe("Vermland køkken");

    // "SkitseforslagRet tegninger" -> "Ret tegninger"
    const entry2 = data.timeEntries.find(
      (e) => e.employeeName === "Kevin James Bailey" && e.categoryNumber === 4
    );
    expect(entry2?.description).toBe("Ret tegninger");

    // "HovedprojektRet badeværelse" -> "Ret badeværelse"
    const entry3 = data.timeEntries.find(
      (e) => e.categoryNumber === 6
    );
    expect(entry3?.description).toBe("Ret badeværelse");
  });

  it("handles entries with only category name (empty description)", () => {
    const data = parseEconomicFile(buildFullWorkbook());
    // "Korrespondance" with category "Korrespondance" -> ""
    const entry = data.timeEntries.find(
      (e) => e.employeeName === "Citlali Steninge"
    );
    expect(entry?.description).toBe("");

    // "Skitseforslag" with category "Skitseforslag" -> ""
    const julieSkitseEntry = data.timeEntries.find(
      (e) => e.employeeName === "Julie Trier Brøgger" && e.categoryNumber === 4
    );
    expect(julieSkitseEntry?.description).toBe("");
  });

  it("preserves hours correctly (decimal support)", () => {
    const data = parseEconomicFile(buildFullWorkbook());
    const citlali = data.timeEntries.find(
      (e) => e.employeeName === "Citlali Steninge"
    );
    expect(citlali?.hours).toBe(0.5);

    const kevin = data.timeEntries.find(
      (e) => e.employeeName === "Kevin James Bailey" && e.categoryNumber === 4
    );
    expect(kevin?.hours).toBe(3.5);
  });

  it("skips summary rows (Subtotal, Tid i alt, I ALT, etc.)", () => {
    const data = parseEconomicFile(buildFullWorkbook());
    // Should have exactly 5 time entries, no summary rows
    expect(data.timeEntries).toHaveLength(5);
    const hasSubtotal = data.timeEntries.some((e) =>
      e.employeeName.toLowerCase().includes("subtotal")
    );
    expect(hasSubtotal).toBe(false);
  });

  it("rejects files with too few rows", () => {
    const buf = buildMockWorkbook([["row1"], ["row2"]]);
    expect(() => parseEconomicFile(buf)).toThrow("too few rows");
  });

  it("handles workbook with no time registration section", () => {
    const buf = buildMockWorkbook([
      ...HEADER_ROWS,
      ["UDGANGSPUNKT I FAKTURERING"],
      [new Date("2025-10-15"), "12345", null, "Faktura", null, null, null, null, null, 50000],
      ["I ALT"],
    ]);
    const data = parseEconomicFile(buf);
    expect(data.timeEntries).toHaveLength(0);
    expect(data.invoices).toHaveLength(1);
  });

  it("handles entries with zero cost/sales", () => {
    const data = parseEconomicFile(buildFullWorkbook());
    const citlali = data.timeEntries.find(
      (e) => e.employeeName === "Citlali Steninge"
    );
    expect(citlali?.costPrice).toBe(0);
    expect(citlali?.salesPrice).toBe(0);
  });
});
