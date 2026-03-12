import * as XLSX from "xlsx";
import { getAnthropicClient } from "@/lib/ai/client";
import { checkBudget, trackUsage } from "@/lib/ai/cost-tracking";

const EXTRACTION_MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You are parsing a Danish tilbud (project quote) document. Extract the structure into JSON.

Rules:
1. Identify numbered "Faser" (phases). They are typically numbered 1-9.
2. Under each fase, identify individual tasks with their hour estimates.
3. Tasks marked "timeløn" or "Timeløn" have no fixed hours — set isTimeloen: true.
4. Some timeløn tasks include an estimate range like "2-7 timer" — capture this in timeloenEstimate.
5. Look for "pr. måned" or "pr. uge" indicating recurring budgets — set isRecurring: true.
6. Find the hourly rate (often written as "X,- kr pr. time" or "X kr/time").
7. Bold numbers in the "Timer" column are usually subtotals for that fase.
8. Extract any notes about payment terms, conditions, or scope limitations.

Respond ONLY with valid JSON matching this schema:
{
  "projectName": string | null,
  "projectDescription": string | null,
  "date": "YYYY-MM-DD" | null,
  "hourlyRate": number | null,
  "hourlyRateInclMoms": number | null,
  "phases": [{
    "faseNumber": number,
    "name": string,
    "subtotalHours": number | null,
    "isRecurring": boolean,
    "recurringUnit": "month" | "week" | null,
    "tasks": [{
      "name": string,
      "description": string | null,
      "quotedHours": number | null,
      "isTimeloen": boolean,
      "timeloenEstimate": string | null
    }]
  }],
  "notes": string | null,
  "confidence": number
}`;

export interface TilbudExtraction {
  projectName?: string;
  projectDescription?: string;
  date?: string;
  hourlyRate?: number;
  hourlyRateInclMoms?: number;
  phases: TilbudPhaseExtraction[];
  notes?: string;
  confidence: number;
}

export interface TilbudPhaseExtraction {
  faseNumber: number;
  name: string;
  subtotalHours?: number;
  isRecurring: boolean;
  recurringUnit?: string;
  tasks: TilbudTaskExtraction[];
}

export interface TilbudTaskExtraction {
  name: string;
  description?: string;
  quotedHours?: number;
  isTimeloen: boolean;
  timeloenEstimate?: string;
}

export async function extractTilbudFromText(
  text: string,
  companyId: string
): Promise<TilbudExtraction> {
  try {
    const budget = await checkBudget(companyId);
    if (!budget.allowed) {
      throw new Error(
        `AI budget exceeded. Daily: ${budget.dailyUsed}/${budget.dailyLimit}, Monthly: ${budget.monthlyUsed}/${budget.monthlyLimit}`
      );
    }

    const client = getAnthropicClient();

    const response = await client.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Parse the following tilbud document and extract its structure:\n\n${text}`,
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Claude");
    }

    // Strip markdown code blocks if present (```json ... ```)
    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }

    const extraction: TilbudExtraction = JSON.parse(jsonText);

    await trackUsage(
      companyId,
      "extract-tilbud",
      EXTRACTION_MODEL,
      response.usage.input_tokens,
      response.usage.output_tokens
    );

    return extraction;
  } catch (error) {
    console.error("[AI] Error extracting tilbud:", error);
    throw error;
  }
}

export async function extractTilbudFromExcel(
  buffer: Buffer
): Promise<TilbudExtraction> {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const extraction: TilbudExtraction = {
      phases: [],
      confidence: 0.7,
    };

    let currentPhase: TilbudPhaseExtraction | null = null;
    let hourlyRate: number | null = null;

    for (const row of rows) {
      const colA = String(row[0] ?? "").trim();
      const colB = String(row[1] ?? "").trim();
      const colC = String(row[2] ?? "").trim();
      const colD = String(row[3] ?? "").trim();
      const colG = String(row[6] ?? "").trim();

      // Combine all cells to search for hourly rate
      const fullRowText = row.map((c) => String(c ?? "")).join(" ");

      // Look for hourly rate patterns like "850,- kr pr. time" or "850 kr/time"
      if (!hourlyRate) {
        const rateMatch = fullRowText.match(
          /(\d[\d.,]*)\s*(?:,-\s*)?kr\s*(?:pr\.\s*time|\/time)/i
        );
        if (rateMatch) {
          hourlyRate = parseFloat(rateMatch[1].replace(/\./g, "").replace(",", "."));
          extraction.hourlyRate = hourlyRate;
          // Calculate incl moms (25% Danish VAT)
          extraction.hourlyRateInclMoms = Math.round(hourlyRate * 1.25 * 100) / 100;
        }
      }

      // Detect fase rows: column A has a number (1-9), column B has the fase name
      const faseNumberMatch = colA.match(/^(\d)$/);
      if (faseNumberMatch && colB) {
        // Save the previous phase
        if (currentPhase) {
          extraction.phases.push(currentPhase);
        }

        const isRecurring =
          fullRowText.toLowerCase().includes("pr. måned") ||
          fullRowText.toLowerCase().includes("pr. uge");

        let recurringUnit: string | undefined;
        if (fullRowText.toLowerCase().includes("pr. måned")) {
          recurringUnit = "month";
        } else if (fullRowText.toLowerCase().includes("pr. uge")) {
          recurringUnit = "week";
        }

        // Check if column D has a subtotal (numeric value for the fase)
        let subtotalHours: number | undefined;
        const subtotalMatch = colD.match(/^(\d+(?:[.,]\d+)?)$/);
        if (subtotalMatch) {
          subtotalHours = parseFloat(subtotalMatch[1].replace(",", "."));
        }

        currentPhase = {
          faseNumber: parseInt(faseNumberMatch[1]),
          name: colB,
          subtotalHours,
          isRecurring,
          recurringUnit,
          tasks: [],
        };
        continue;
      }

      // Detect task rows: column C has a task description, under a current phase
      if (currentPhase && colC) {
        const isTimeloen =
          colD.toLowerCase().includes("timeløn") ||
          colD.toLowerCase().includes("timeloen") ||
          colC.toLowerCase().includes("timeløn") ||
          colC.toLowerCase().includes("timeloen");

        let quotedHours: number | undefined;
        let timeloenEstimate: string | undefined;

        if (isTimeloen) {
          // Look for estimate ranges like "2-7 timer"
          const estimateMatch = fullRowText.match(/(\d+\s*-\s*\d+\s*timer)/i);
          if (estimateMatch) {
            timeloenEstimate = estimateMatch[1];
          }
        } else {
          // Try to parse hours from column D
          const hoursMatch = colD.match(/^(\d+(?:[.,]\d+)?)$/);
          if (hoursMatch) {
            quotedHours = parseFloat(hoursMatch[1].replace(",", "."));
          }
        }

        currentPhase.tasks.push({
          name: colC,
          description: colG || undefined,
          quotedHours,
          isTimeloen,
          timeloenEstimate,
        });
      }
    }

    // Push the last phase
    if (currentPhase) {
      extraction.phases.push(currentPhase);
    }

    return extraction;
  } catch (error) {
    console.error("[Excel] Error extracting tilbud from Excel:", error);
    throw error;
  }
}
