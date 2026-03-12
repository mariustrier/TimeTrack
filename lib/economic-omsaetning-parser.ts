/**
 * Omsætningsstatistik Excel parser for e-conomic import.
 * Parses the "Omsætningsstatistik" (Revenue Statistics) Excel export format.
 */
import * as XLSX from "xlsx";

export interface OmsaetningData {
  companyName: string;
  categories: OmsaetningCategory[];
  totals: {
    hours: number;
    revenue: number;
    costs: number;
    grossProfit: number;
    marginPercent: number;
  };
}

export interface OmsaetningCategory {
  number: number;
  name: string;
  projectEntries: OmsaetningProjectEntry[];
  subtotal: {
    hours: number;
    revenue: number;
    costs: number;
    grossProfit: number;
    marginPercent: number;
  };
}

export interface OmsaetningProjectEntry {
  projectNumber: string;
  customerName: string;
  group: string;
  hours: number;
  revenue: number;
  costs: number;
  grossProfit: number;
  marginPercent: number;
}

/** Safely get numeric value */
const toNum = (val: unknown): number => {
  if (val == null) return 0;
  if (typeof val === "number") return val;
  const str = String(val).replace(/\s/g, "");
  // Handle Danish format: "1.234,56" → 1234.56 and "58,33%" → 58.33
  const cleaned = str.replace(/%$/, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

const toStr = (val: unknown): string => {
  if (val == null) return "";
  return String(val).trim();
};

/** Category header pattern: "N - Name" */
const CATEGORY_PATTERN = /^(\d+)\s*-\s*(.+)$/;

export const parseOmsaetningsstatistik = (buffer: ArrayBuffer): OmsaetningData => {
  const wb = XLSX.read(buffer, { type: "array", cellStyles: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  const maxRow = range.e.r;

  const cell = (r: number, c: number): unknown => {
    const ref = XLSX.utils.encode_cell({ r, c });
    const cellObj = ws[ref];
    return cellObj ? cellObj.v : undefined;
  };

  const cellBold = (r: number, c: number): boolean => {
    const ref = XLSX.utils.encode_cell({ r, c });
    const cellObj = ws[ref];
    if (!cellObj) return false;
    if (cellObj.s && cellObj.s.font && cellObj.s.font.bold) return true;
    return false;
  };

  // Row 2 (index 1): Company name
  let companyName = "";
  const row2val = toStr(cell(1, 0));
  const companyMatch = row2val.match(/^\d+\s*-\s*(.+)$/);
  if (companyMatch) {
    companyName = companyMatch[1].trim();
  } else {
    companyName = row2val;
  }

  // Parse categories starting from row 8 (index 7) or wherever data starts
  const categories: OmsaetningCategory[] = [];
  let currentCategory: OmsaetningCategory | null = null;
  let totalHours = 0, totalRevenue = 0, totalCosts = 0, totalGrossProfit = 0, totalMargin = 0;

  // Find header row (look for "Nr." or similar in first few rows)
  let dataStartRow = 7; // Default: row 8 (index 7)
  for (let r = 0; r <= Math.min(maxRow, 15); r++) {
    const v = toStr(cell(r, 0)).toLowerCase();
    if (v === "nr." || v === "nr" || v === "nummer") {
      dataStartRow = r + 1;
      break;
    }
  }

  for (let r = dataStartRow; r <= maxRow; r++) {
    const colA = toStr(cell(r, 0));
    const colB = toStr(cell(r, 1));
    const colBLower = colB.toLowerCase();

    // Grand total: "Total:" in col B
    if (colBLower === "total:" || colBLower === "i alt:") {
      if (currentCategory) {
        categories.push(currentCategory);
        currentCategory = null;
      }
      totalHours = toNum(cell(r, 3));
      totalRevenue = toNum(cell(r, 4));
      totalCosts = toNum(cell(r, 5));
      totalGrossProfit = toNum(cell(r, 6));
      totalMargin = toNum(cell(r, 7));
      break;
    }

    // Subtotal: "X in total:" in col B (bold row)
    if (colBLower.includes("in total:") || colBLower.includes("i alt:")) {
      if (currentCategory) {
        currentCategory.subtotal = {
          hours: toNum(cell(r, 3)),
          revenue: toNum(cell(r, 4)),
          costs: toNum(cell(r, 5)),
          grossProfit: toNum(cell(r, 6)),
          marginPercent: toNum(cell(r, 7)),
        };
        categories.push(currentCategory);
        currentCategory = null;
      }
      continue;
    }

    // Category header: bold, "N - Name" pattern in col A, no project number
    const catMatch = colA.match(CATEGORY_PATTERN);
    if (catMatch && (cellBold(r, 0) || !colB)) {
      // Check it's not a project entry (project entries have data in col B)
      const hasData = colB && toNum(cell(r, 3)) > 0;
      if (!hasData || cellBold(r, 0)) {
        if (currentCategory) {
          // Auto-compute subtotal if missing
          if (currentCategory.subtotal.hours === 0 && currentCategory.projectEntries.length > 0) {
            currentCategory.subtotal = {
              hours: currentCategory.projectEntries.reduce((s, e) => s + e.hours, 0),
              revenue: currentCategory.projectEntries.reduce((s, e) => s + e.revenue, 0),
              costs: currentCategory.projectEntries.reduce((s, e) => s + e.costs, 0),
              grossProfit: currentCategory.projectEntries.reduce((s, e) => s + e.grossProfit, 0),
              marginPercent: 0,
            };
          }
          categories.push(currentCategory);
        }
        currentCategory = {
          number: parseInt(catMatch[1]),
          name: catMatch[2].trim(),
          projectEntries: [],
          subtotal: { hours: 0, revenue: 0, costs: 0, grossProfit: 0, marginPercent: 0 },
        };
        continue;
      }
    }

    // Project entry row: col A has project number, col B has customer name
    if (currentCategory && colA && colB && /^\d+$/.test(colA)) {
      currentCategory.projectEntries.push({
        projectNumber: colA,
        customerName: colB,
        group: toStr(cell(r, 2)),
        hours: toNum(cell(r, 3)),
        revenue: toNum(cell(r, 4)),
        costs: toNum(cell(r, 5)),
        grossProfit: toNum(cell(r, 6)),
        marginPercent: toNum(cell(r, 7)),
      });
    }
  }

  // Handle last category if not closed
  if (currentCategory) {
    if (currentCategory.subtotal.hours === 0 && currentCategory.projectEntries.length > 0) {
      currentCategory.subtotal = {
        hours: currentCategory.projectEntries.reduce((s, e) => s + e.hours, 0),
        revenue: currentCategory.projectEntries.reduce((s, e) => s + e.revenue, 0),
        costs: currentCategory.projectEntries.reduce((s, e) => s + e.costs, 0),
        grossProfit: currentCategory.projectEntries.reduce((s, e) => s + e.grossProfit, 0),
        marginPercent: 0,
      };
    }
    categories.push(currentCategory);
  }

  // Calculate totals from categories if not found in grand total row
  if (totalHours === 0 && categories.length > 0) {
    categories.forEach((cat) => {
      totalHours += cat.subtotal.hours;
      totalRevenue += cat.subtotal.revenue;
      totalCosts += cat.subtotal.costs;
      totalGrossProfit += cat.subtotal.grossProfit;
    });
    totalMargin = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;
  }

  return {
    companyName,
    categories,
    totals: {
      hours: totalHours,
      revenue: totalRevenue,
      costs: totalCosts,
      grossProfit: totalGrossProfit,
      marginPercent: totalMargin,
    },
  };
};
