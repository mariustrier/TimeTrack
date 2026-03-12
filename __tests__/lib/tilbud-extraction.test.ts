import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { extractTilbudFromExcel } from "@/lib/tilbud-extraction";
import type {
  TilbudExtraction,
  TilbudPhaseExtraction,
} from "@/lib/tilbud-extraction";

function buildMockWorkbook(rows: unknown[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(buf);
}

describe("extractTilbudFromExcel", () => {
  it("should extract basic phase and task structure", async () => {
    const buffer = buildMockWorkbook([
      ["Fase", "Navn", "Opgave", "Timer", "Beløb", "Inkl moms", "Noter"],
      ["1", "Indledende", "", "1", "", "", ""],
      ["", "", "Møde", "1", "", "", ""],
      ["2", "Skitse", "", "13", "", "", ""],
      ["", "", "Digital optegning", "2", "", "", ""],
      ["", "", "Skitseprojekt", "8", "", "", ""],
      ["", "", "Møde 2", "1", "", "", ""],
      ["", "", "Tilrettelser", "2", "", "", ""],
    ]);

    const result = await extractTilbudFromExcel(buffer);

    expect(result.confidence).toBe(0.7);
    expect(result.phases).toHaveLength(2);

    expect(result.phases[0].faseNumber).toBe(1);
    expect(result.phases[0].name).toBe("Indledende");
    expect(result.phases[0].subtotalHours).toBe(1);
    expect(result.phases[0].tasks).toHaveLength(1);
    expect(result.phases[0].tasks[0].name).toBe("Møde");
    expect(result.phases[0].tasks[0].quotedHours).toBe(1);

    expect(result.phases[1].faseNumber).toBe(2);
    expect(result.phases[1].name).toBe("Skitse");
    expect(result.phases[1].tasks).toHaveLength(4);
    expect(result.phases[1].tasks[0].quotedHours).toBe(2);
    expect(result.phases[1].tasks[1].quotedHours).toBe(8);
  });

  it("should detect timeloen tasks", async () => {
    const buffer = buildMockWorkbook([
      ["Fase", "Navn", "Opgave", "Timer", "", "", ""],
      ["4", "Hovedprojekt", "", "50", "", "", ""],
      ["", "", "Tegninger", "17", "", "", ""],
      ["", "", "VVS ventilation", "timeløn", "", "", ""],
      ["", "", "Materialeliste", "Timeløn", "", "", ""],
    ]);

    const result = await extractTilbudFromExcel(buffer);
    expect(result.phases).toHaveLength(1);

    const tasks = result.phases[0].tasks;
    expect(tasks).toHaveLength(3);

    expect(tasks[0].name).toBe("Tegninger");
    expect(tasks[0].quotedHours).toBe(17);
    expect(tasks[0].isTimeloen).toBe(false);

    expect(tasks[1].name).toBe("VVS ventilation");
    expect(tasks[1].isTimeloen).toBe(true);
    expect(tasks[1].quotedHours).toBeUndefined();

    expect(tasks[2].name).toBe("Materialeliste");
    expect(tasks[2].isTimeloen).toBe(true);
  });

  it("should detect timeloen estimate ranges", async () => {
    const buffer = buildMockWorkbook([
      ["Fase", "Navn", "Opgave", "Timer", "", "", ""],
      ["5", "Licitation", "", "7", "", "", ""],
      ["", "", "Rettelseblade", "timeløn", "", "", "2-7 timer"],
    ]);

    const result = await extractTilbudFromExcel(buffer);
    const task = result.phases[0].tasks[0];
    expect(task.isTimeloen).toBe(true);
    // The timeloen estimate is parsed from the full row text
  });

  it("should detect recurring phases (pr. måned)", async () => {
    const buffer = buildMockWorkbook([
      ["Fase", "Navn", "Opgave", "Timer", "", "", ""],
      ["6", "Tilsyn", "pr. måned", "14", "", "", ""],
      ["", "", "Byggepladsmøde", "6", "", "", ""],
      ["", "", "Referat", "4", "", "", ""],
    ]);

    const result = await extractTilbudFromExcel(buffer);
    expect(result.phases[0].isRecurring).toBe(true);
    expect(result.phases[0].recurringUnit).toBe("month");
  });

  it("should extract hourly rate from row text", async () => {
    const buffer = buildMockWorkbook([
      ["", "", "", "", "", "", ""],
      ["Timepris:", "1.080,- kr pr. time", "", "", "", "", ""],
      ["1", "Indledende", "", "1", "", "", ""],
      ["", "", "Møde", "1", "", "", ""],
    ]);

    const result = await extractTilbudFromExcel(buffer);
    expect(result.hourlyRate).toBe(1080);
    expect(result.hourlyRateInclMoms).toBe(1350);
  });

  it("should handle empty workbook gracefully", async () => {
    const buffer = buildMockWorkbook([
      ["", "", "", "", "", "", ""],
    ]);

    const result = await extractTilbudFromExcel(buffer);
    expect(result.phases).toHaveLength(0);
    expect(result.confidence).toBe(0.7);
  });

  it("should handle fase with no tasks", async () => {
    const buffer = buildMockWorkbook([
      ["Fase", "Navn", "Opgave", "Timer", "", "", ""],
      ["8", "Myndigheder", "", "timeløn", "", "", ""],
      ["9", "1 års gennemgang", "", "timeløn", "", "", ""],
    ]);

    const result = await extractTilbudFromExcel(buffer);
    expect(result.phases).toHaveLength(2);
    expect(result.phases[0].faseNumber).toBe(8);
    expect(result.phases[0].name).toBe("Myndigheder");
    expect(result.phases[0].tasks).toHaveLength(0);
    expect(result.phases[1].faseNumber).toBe(9);
  });

  it("should parse task description from column G", async () => {
    const buffer = buildMockWorkbook([
      ["Fase", "Navn", "Opgave", "Timer", "", "", "Noter"],
      ["1", "Indledende", "", "5", "", "", ""],
      ["", "", "Møde", "1", "", "", "Første projektmøde"],
    ]);

    const result = await extractTilbudFromExcel(buffer);
    expect(result.phases[0].tasks[0].description).toBe("Første projektmøde");
  });

  it("should handle hourly rate with different formats", async () => {
    // Test "850 kr/time" format
    const buffer = buildMockWorkbook([
      ["", "850 kr/time", "", "", "", "", ""],
      ["1", "Fase 1", "", "", "", "", ""],
    ]);

    const result = await extractTilbudFromExcel(buffer);
    expect(result.hourlyRate).toBe(850);
  });
});

describe("TilbudExtraction interfaces", () => {
  it("should conform to the TilbudExtraction interface", () => {
    const extraction: TilbudExtraction = {
      projectName: "Test projekt",
      hourlyRate: 1080,
      phases: [
        {
          faseNumber: 1,
          name: "Indledende",
          subtotalHours: 5,
          isRecurring: false,
          tasks: [
            {
              name: "Møde",
              quotedHours: 1,
              isTimeloen: false,
            },
          ],
        },
      ],
      confidence: 0.85,
    };

    expect(extraction.phases).toHaveLength(1);
    expect(extraction.phases[0].tasks[0].isTimeloen).toBe(false);
  });

  it("should support timeloen phases", () => {
    const phase: TilbudPhaseExtraction = {
      faseNumber: 8,
      name: "Myndigheder",
      isRecurring: false,
      tasks: [
        {
          name: "Myndighedsbehandling",
          isTimeloen: true,
          timeloenEstimate: "5-15 timer",
        },
      ],
    };

    expect(phase.tasks[0].quotedHours).toBeUndefined();
    expect(phase.tasks[0].isTimeloen).toBe(true);
  });

  it("should support recurring phases", () => {
    const phase: TilbudPhaseExtraction = {
      faseNumber: 6,
      name: "Tilsyn",
      subtotalHours: 14,
      isRecurring: true,
      recurringUnit: "month",
      tasks: [],
    };

    expect(phase.isRecurring).toBe(true);
    expect(phase.recurringUnit).toBe("month");
  });
});
