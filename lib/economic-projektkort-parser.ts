/**
 * Projektkort Excel parser for e-conomic import.
 * Parses the "Projektkort" (Project Card) Excel export format.
 */
import * as XLSX from "xlsx";

export interface ProjektkortData {
  companyName: string;
  projectNumber: string;
  projectName: string;
  period: { from: string; to: string };
  invoices: ProjektkortInvoice[];
  activities: ProjektkortActivity[];
  totals: {
    registeredHours: number;
    kostpris: number;
    salgspris: number;
    invoicedAmount: number;
  };
}

export interface ProjektkortInvoice {
  date: string;
  bilag: string;
  description: string;
  amount: number;
}

export interface ProjektkortActivity {
  number: number;
  name: string;
  entries: ProjektkortEntry[];
  subtotal: {
    hours: number;
    kostpris: number;
    salgspris: number;
    invoiced: number;
  };
  suggestedBillingStatus: "billable" | "nonBillable" | "mixed";
  billableEntryCount: number;
  nonBillableEntryCount: number;
}

export interface ProjektkortEntry {
  date: string;
  bilag: string;
  employeeName: string;
  description: string;
  hours: number;
  kostpris: number;
  salgspris: number;
  invoiced: number;
  isBillable: boolean;
}

/** Parse an Excel date serial or string to ISO date */
const parseExcelDate = (val: unknown): string => {
  if (val == null) return "";
  if (typeof val === "number") {
    // Excel date serial
    const date = XLSX.SSF.parse_date_code(val);
    if (date) {
      const y = date.y;
      const m = String(date.m).padStart(2, "0");
      const d = String(date.d).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return "";
  }
  const str = String(val).trim();
  // DD.MM.YY or DD.MM.YYYY format
  const dotMatch = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (dotMatch) {
    let year = parseInt(dotMatch[3]);
    if (year < 100) year += 2000;
    return `${year}-${dotMatch[2].padStart(2, "0")}-${dotMatch[1].padStart(2, "0")}`;
  }
  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  return str;
};

/** Safely get numeric value from cell */
const toNum = (val: unknown): number => {
  if (val == null) return 0;
  const n = typeof val === "number" ? val : parseFloat(String(val).replace(/[.,]/g, (m, i, s) => {
    // Handle Danish number format: 1.234,56 → 1234.56
    return i === s.lastIndexOf(m) && m === "," ? "." : "";
  }));
  return isNaN(n) ? 0 : n;
};

/** Safely get string value from cell */
const toStr = (val: unknown): string => {
  if (val == null) return "";
  return String(val).trim();
};

/** Check if a cell has bold formatting */
const isBold = (ws: XLSX.WorkSheet, cellRef: string): boolean => {
  const cell = ws[cellRef];
  if (!cell) return false;
  // SheetJS stores rich text info, check for bold
  if (cell.s && cell.s.font && cell.s.font.bold) return true;
  return false;
};

/** Activity header pattern: "N - Name" or "N - (Brug ikke) - Name" */
const ACTIVITY_PATTERN = /^(\d+)\s*-\s*(?:\(.*?\)\s*-\s*)?(.+)$/;

export const parseProjektkort = (buffer: ArrayBuffer): ProjektkortData => {
  const wb = XLSX.read(buffer, { type: "array", cellStyles: true, cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  const maxRow = range.e.r;

  // Helper: get cell value by row,col (0-indexed)
  const cell = (r: number, c: number): unknown => {
    const ref = XLSX.utils.encode_cell({ r, c });
    const cellObj = ws[ref];
    return cellObj ? cellObj.v : undefined;
  };

  const cellBold = (r: number, c: number): boolean => {
    const ref = XLSX.utils.encode_cell({ r, c });
    return isBold(ws, ref);
  };

  // Row 2 (index 1): Company name "NNNNNNN - Company Name"
  let companyName = "";
  const row2val = toStr(cell(1, 0));
  const companyMatch = row2val.match(/^\d+\s*-\s*(.+)$/);
  if (companyMatch) companyName = companyMatch[1].trim();

  // Row 4 (index 3): Period "Projektkort for perioden DD.MM.YY - DD.MM.YY"
  let periodFrom = "", periodTo = "";
  const row4val = toStr(cell(3, 0));
  const periodMatch = row4val.match(/perioden\s+(\d{1,2}\.\d{1,2}\.\d{2,4})\s*-\s*(\d{1,2}\.\d{1,2}\.\d{2,4})/i);
  if (periodMatch) {
    periodFrom = parseExcelDate(periodMatch[1]);
    periodTo = parseExcelDate(periodMatch[2]);
  }

  // Find project row dynamically — search through first 30 rows
  let projectNumber = "", projectName = "";
  let projectRow = -1;
  for (let r = 0; r <= Math.min(maxRow, 30); r++) {
    const v = toStr(cell(r, 0));

    // Try "Projektkort for projekt XXXX - Project Name" or "Projektkort - projekt XXXX"
    if (!projectNumber) {
      const projMatch = v.match(/projekt\s+(\S+?)\s*-\s*(.+)/i);
      if (projMatch) {
        projectNumber = projMatch[1];
        projectName = projMatch[2].trim();
        projectRow = r;
        continue;
      }
      // Also try just "projekt XXXX" without a name
      const projNumOnly = v.match(/projekt\s+(\S+)/i);
      if (projNumOnly) {
        projectNumber = projNumOnly[1];
        projectRow = r;
        continue;
      }
    }

    // Try "Underprojekt XXXX - Name"
    if (projectNumber && !projectName) {
      const subMatch = v.match(/[Uu]nderprojekt\s+\S+\s*-\s*(.+)/);
      if (subMatch) {
        projectName = subMatch[1].trim();
      }
    }

    if (projectNumber && projectName) break;
  }

  // Fallback: use projectNumber as name
  if (!projectName && projectNumber) projectName = projectNumber;

  if (projectRow === -1) projectRow = 6; // default for section search start

  // Find sections
  let invoiceSectionStart = -1;
  let registrationSectionStart = -1;
  for (let r = projectRow + 1; r <= maxRow; r++) {
    const v = toStr(cell(r, 0)).toUpperCase();
    if (v.includes("UDGANGSPUNKT I FAKTURERING")) invoiceSectionStart = r;
    if (v.includes("UDGANGSPUNKT I REGISTRERING")) registrationSectionStart = r;
  }

  // Parse invoices
  const invoices: ProjektkortInvoice[] = [];
  if (invoiceSectionStart >= 0) {
    const endRow = registrationSectionStart >= 0 ? registrationSectionStart : maxRow;
    for (let r = invoiceSectionStart + 1; r < endRow; r++) {
      const dateVal = cell(r, 0);
      const bilag = toStr(cell(r, 1));
      const desc = toStr(cell(r, 2)) || toStr(cell(r, 3));
      const amount = toNum(cell(r, 9)); // col J = Faktureret
      // Invoice entries have a date and an amount in col J
      if (dateVal && amount !== 0) {
        invoices.push({
          date: parseExcelDate(dateVal),
          bilag,
          description: desc,
          amount,
        });
      }
      // Stop at "Uden fordeling" or "I ALT" or blank section
      const colA = toStr(cell(r, 0)).toLowerCase();
      if (colA.includes("i alt")) break;
    }
  }

  // Parse activities and time entries
  const activities: ProjektkortActivity[] = [];
  let currentActivity: ProjektkortActivity | null = null;
  let totalHours = 0, totalKostpris = 0, totalSalgspris = 0, totalInvoiced = 0;

  if (registrationSectionStart >= 0) {
    // Skip past "Tid:" line
    let startRow = registrationSectionStart + 1;
    for (let r = startRow; r <= Math.min(startRow + 3, maxRow); r++) {
      const v = toStr(cell(r, 0)).toLowerCase();
      if (v === "tid:" || v === "") {
        startRow = r + 1;
      } else {
        break;
      }
    }

    for (let r = startRow; r <= maxRow; r++) {
      const colA = toStr(cell(r, 0));
      const colALower = colA.toLowerCase();

      // Grand total detection — stop parsing
      if (colALower === "tid i alt" || (colALower.includes("tid") && colALower.includes("i alt"))) {
        // Save last activity
        if (currentActivity) {
          classifyActivity(currentActivity);
          activities.push(currentActivity);
        }
        // Parse totals from this row
        totalHours = toNum(cell(r, 5));
        totalKostpris = toNum(cell(r, 6));
        totalSalgspris = toNum(cell(r, 8));
        totalInvoiced = toNum(cell(r, 9));
        break;
      }

      // Subtotal detection
      if (colALower === "subtotal" || colALower.includes("subtotal")) {
        if (currentActivity) {
          currentActivity.subtotal = {
            hours: toNum(cell(r, 5)),
            kostpris: toNum(cell(r, 6)),
            salgspris: toNum(cell(r, 8)),
            invoiced: toNum(cell(r, 9)),
          };
          classifyActivity(currentActivity);
          activities.push(currentActivity);
          currentActivity = null;
        }
        continue;
      }

      // Activity header detection: bold row with "N - Name" pattern
      const actMatch = colA.match(ACTIVITY_PATTERN);
      if (actMatch && (cellBold(r, 0) || !cell(r, 1))) {
        // Save previous activity if it exists without subtotal
        if (currentActivity) {
          classifyActivity(currentActivity);
          activities.push(currentActivity);
        }
        currentActivity = {
          number: parseInt(actMatch[1]),
          name: actMatch[2].trim(),
          entries: [],
          subtotal: { hours: 0, kostpris: 0, salgspris: 0, invoiced: 0 },
          suggestedBillingStatus: "nonBillable",
          billableEntryCount: 0,
          nonBillableEntryCount: 0,
        };
        continue;
      }

      // Time entry row: has a date in col A and employee name in col C
      const dateVal = cell(r, 0);
      const employeeName = toStr(cell(r, 2));
      const hours = toNum(cell(r, 5));

      if (dateVal && employeeName && hours > 0 && currentActivity) {
        const salgspris = toNum(cell(r, 8));
        currentActivity.entries.push({
          date: parseExcelDate(dateVal),
          bilag: toStr(cell(r, 1)),
          employeeName,
          description: toStr(cell(r, 3)),
          hours,
          kostpris: toNum(cell(r, 6)),
          salgspris,
          invoiced: toNum(cell(r, 9)),
          isBillable: salgspris > 0,
        });
      }
    }

    // Handle case where last activity wasn't closed by subtotal
    if (currentActivity && !activities.includes(currentActivity)) {
      classifyActivity(currentActivity);
      activities.push(currentActivity);
    }
  }

  // Calculate totals from activities if we didn't find the grand total row
  if (totalHours === 0 && activities.length > 0) {
    activities.forEach((act) => {
      totalHours += act.subtotal.hours || act.entries.reduce((s, e) => s + e.hours, 0);
      totalKostpris += act.subtotal.kostpris || act.entries.reduce((s, e) => s + e.kostpris, 0);
      totalSalgspris += act.subtotal.salgspris || act.entries.reduce((s, e) => s + e.salgspris, 0);
    });
  }

  // Extract period from entry dates if not found in header
  if (!periodFrom && activities.length > 0) {
    const allDates = activities.flatMap((a) => a.entries.map((e) => e.date)).filter(Boolean).sort();
    if (allDates.length > 0) {
      periodFrom = allDates[0];
      periodTo = allDates[allDates.length - 1];
    }
  }

  return {
    companyName,
    projectNumber,
    projectName,
    period: { from: periodFrom, to: periodTo },
    invoices,
    activities,
    totals: {
      registeredHours: totalHours,
      kostpris: totalKostpris,
      salgspris: totalSalgspris,
      invoicedAmount: totalInvoiced || invoices.reduce((s, i) => s + i.amount, 0),
    },
  };
};

/** Classify an activity based on salgspris of its entries */
const classifyActivity = (activity: ProjektkortActivity): void => {
  let billable = 0;
  let nonBillable = 0;

  activity.entries.forEach((entry) => {
    if (entry.salgspris > 0) {
      billable++;
    } else {
      nonBillable++;
    }
  });

  activity.billableEntryCount = billable;
  activity.nonBillableEntryCount = nonBillable;

  // Compute subtotal from entries if not set by subtotal row
  if (activity.subtotal.hours === 0 && activity.entries.length > 0) {
    activity.subtotal = {
      hours: activity.entries.reduce((s, e) => s + e.hours, 0),
      kostpris: activity.entries.reduce((s, e) => s + e.kostpris, 0),
      salgspris: activity.entries.reduce((s, e) => s + e.salgspris, 0),
      invoiced: activity.entries.reduce((s, e) => s + e.invoiced, 0),
    };
  }

  if (billable === 0) {
    activity.suggestedBillingStatus = "nonBillable";
  } else if (nonBillable === 0) {
    activity.suggestedBillingStatus = "billable";
  } else {
    activity.suggestedBillingStatus = "mixed";
  }
};
