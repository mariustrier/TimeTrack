import * as XLSX from "xlsx";

export interface EconomicInvoice {
  date: string;
  invoiceNumber: string;
  amount: number;
}

export interface EconomicTaskCategory {
  number: number;
  name: string;
  subtotalHours: number;
  subtotalCost: number;
  subtotalSales: number;
}

export interface EconomicTimeEntry {
  date: string;
  employeeName: string;
  categoryNumber: number;
  categoryName: string;
  description: string;
  hours: number;
  costPrice: number;
  salesPrice: number;
}

export interface EconomicImportData {
  sourceCompanyId: string;
  sourceCompanyName: string;
  projectNumber: string;
  projectName: string;
  invoices: EconomicInvoice[];
  totalInvoiced: number;
  taskCategories: EconomicTaskCategory[];
  timeEntries: EconomicTimeEntry[];
  aggregatedTimeEntries: EconomicTimeEntry[]; // Pre-aggregated for safe upsert
  uniqueEmployees: string[];
  totalHours: number;
  totalCost: number;
  totalSales: number;
}

const SKIP_ROWS = new Set([
  "subtotal",
  "tid i alt",
  "i alt",
  "uden fordeling",
  "dækningsbidrag",
  "dækningsgrad",
  "over-/underdækning",
]);

function isSkipRow(value: string): boolean {
  return SKIP_ROWS.has(value.toLowerCase().trim());
}

function parseExcelDate(value: unknown): string | null {
  if (value instanceof Date) {
    return value.toISOString().split("T")[0];
  }
  if (typeof value === "number") {
    // Excel serial date
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      const y = date.y;
      const m = String(date.m).padStart(2, "0");
      const d = String(date.d).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.substring(0, 10);
  }
  return null;
}

function cleanDescription(taskText: string, categoryName: string): string {
  if (!taskText) return "";
  const stripped = taskText.trim();
  // The category name is concatenated without space as prefix
  const normalizedCategory = categoryName.replace(/\s+/g, "");
  if (stripped.startsWith(normalizedCategory)) {
    const rest = stripped.slice(normalizedCategory.length).trim();
    return rest;
  }
  // Also try with original spacing
  if (stripped.startsWith(categoryName)) {
    const rest = stripped.slice(categoryName.length).trim();
    return rest;
  }
  return stripped;
}

const CATEGORY_PATTERN = /^(\d+)\s*-\s*(.+)$/;

export function parseEconomicFile(buffer: ArrayBuffer): EconomicImportData {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("No sheets found in workbook");
  }

  const sheet = workbook.Sheets[sheetName];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  if (rows.length < 7) {
    throw new Error("Invalid Projektkort format: too few rows");
  }

  // Search for company info dynamically (usually row 2, but can vary)
  let sourceCompanyId = "";
  let sourceCompanyName = "";
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const val = String(rows[i]?.[0] || "").trim();
    const companyMatch = val.match(/^(\d{5,})\s*-\s*(.+)$/);
    if (companyMatch) {
      sourceCompanyId = companyMatch[1];
      sourceCompanyName = companyMatch[2].trim();
      break;
    }
  }

  // Search for project number and name dynamically (rows 0–30)
  let projectNumber = "";
  let projectName = "";
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const val = String(rows[i]?.[0] || "").trim();

    // "Projektkort - projekt XXXX" or "Projektkort for projekt XXXX - Name"
    if (!projectNumber) {
      const match = val.match(/projekt\s+(\S+?)(?:\s*-\s*(.+))?$/i);
      if (match) {
        projectNumber = match[1];
        if (match[2]) projectName = match[2].trim();
      }
    }

    // "Underprojekt XXXX - Name"
    if (!projectName) {
      const subMatch = val.match(/[Uu]nderprojekt\s+\S+\s*-\s*(.+)/);
      if (subMatch) {
        projectName = subMatch[1].trim();
      }
    }

    if (projectNumber && projectName) break;
  }

  // Fallback: use projectNumber as name if we found a number but no name
  if (!projectName && projectNumber) projectName = projectNumber;

  if (!projectNumber && !projectName) {
    throw new Error("Invalid Projektkort format: could not extract project info. Expected a row containing 'projekt' followed by a project number.");
  }

  // Find section boundaries
  let invoiceSectionStart = -1;
  let registrationSectionStart = -1;

  for (let i = 0; i < rows.length; i++) {
    const cellValue = String(rows[i]?.[0] || "").toUpperCase();
    if (cellValue.includes("UDGANGSPUNKT I FAKTURERING")) {
      invoiceSectionStart = i;
    }
    if (cellValue.includes("UDGANGSPUNKT I REGISTRERING")) {
      registrationSectionStart = i;
    }
  }

  // Parse invoices
  const invoices: EconomicInvoice[] = [];
  let totalInvoiced = 0;

  if (invoiceSectionStart >= 0) {
    const end = registrationSectionStart >= 0 ? registrationSectionStart : rows.length;
    for (let i = invoiceSectionStart + 1; i < end; i++) {
      const row = rows[i];
      if (!row) continue;
      const dateVal = parseExcelDate(row[0]);
      const invoiceNum = String(row[1] || "").trim();
      const amount = parseFloat(String(row[9] || "0")) || 0;
      const taskText = String(row[3] || "").toLowerCase();

      if (dateVal && invoiceNum && taskText.includes("faktura")) {
        invoices.push({ date: dateVal, invoiceNumber: invoiceNum, amount });
        totalInvoiced += amount;
      }
    }
  }

  // Parse time registrations
  const taskCategories: EconomicTaskCategory[] = [];
  const timeEntries: EconomicTimeEntry[] = [];
  const employeeSet = new Set<string>();

  let currentCategory: { number: number; name: string } | null = null;
  const categoryStats: Map<number, { hours: number; cost: number; sales: number }> = new Map();
  let inTimeSection = false;

  if (registrationSectionStart >= 0) {
    for (let i = registrationSectionStart + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      const col0 = String(row[0] || "").trim();

      // Detect "Tid:" subheader
      if (col0.toLowerCase().startsWith("tid:") || col0.toLowerCase() === "tid") {
        inTimeSection = true;
        continue;
      }

      if (!inTimeSection) continue;

      // Skip summary rows
      if (isSkipRow(col0)) continue;

      // Check for category header: "{number} - {name}"
      const categoryMatch = col0.match(CATEGORY_PATTERN);
      if (categoryMatch && !parseExcelDate(row[0])) {
        currentCategory = {
          number: parseInt(categoryMatch[1], 10),
          name: categoryMatch[2].trim(),
        };
        if (!categoryStats.has(currentCategory.number)) {
          categoryStats.set(currentCategory.number, { hours: 0, cost: 0, sales: 0 });
        }
        continue;
      }

      // Check for time entry row: valid date + employee name
      const dateVal = parseExcelDate(row[0]);
      const employeeName = String(row[2] || "").trim();

      if (dateVal && employeeName && currentCategory) {
        const hours = parseFloat(String(row[5] || "0")) || 0;
        const costPrice = parseFloat(String(row[6] || "0")) || 0;
        const salesPrice = parseFloat(String(row[8] || "0")) || 0;
        const taskText = String(row[3] || "").trim();
        const description = cleanDescription(taskText, currentCategory.name);

        timeEntries.push({
          date: dateVal,
          employeeName,
          categoryNumber: currentCategory.number,
          categoryName: currentCategory.name,
          description,
          hours,
          costPrice,
          salesPrice,
        });

        employeeSet.add(employeeName);

        const stats = categoryStats.get(currentCategory.number)!;
        stats.hours += hours;
        stats.cost += costPrice;
        stats.sales += salesPrice;
      }
    }
  }

  // Build category summaries
  categoryStats.forEach((stats, num) => {
    const name = timeEntries.find((e) => e.categoryNumber === num)?.categoryName || "";
    taskCategories.push({
      number: num,
      name,
      subtotalHours: stats.hours,
      subtotalCost: stats.cost,
      subtotalSales: stats.sales,
    });
  });
  taskCategories.sort((a, b) => a.number - b.number);

  const totalHours = timeEntries.reduce((sum, e) => sum + e.hours, 0);
  const totalCost = timeEntries.reduce((sum, e) => sum + e.costPrice, 0);
  const totalSales = timeEntries.reduce((sum, e) => sum + e.salesPrice, 0);

  const aggregatedTimeEntries = aggregateEntries(timeEntries);

  return {
    sourceCompanyId,
    sourceCompanyName,
    projectNumber,
    projectName,
    invoices,
    totalInvoiced,
    taskCategories,
    timeEntries,
    aggregatedTimeEntries,
    uniqueEmployees: Array.from(employeeSet).sort(),
    totalHours,
    totalCost,
    totalSales,
  };
}

/**
 * Aggregates parsed entries by (employeeName, date, categoryNumber) to prevent
 * duplicate rows from causing data loss during upsert operations.
 */
export function aggregateEntries(entries: EconomicTimeEntry[]): EconomicTimeEntry[] {
  const aggregated = new Map<string, EconomicTimeEntry>();
  for (const entry of entries) {
    const key = `${entry.employeeName}|${entry.date}|${entry.categoryNumber}`;
    if (aggregated.has(key)) {
      const existing = aggregated.get(key)!;
      existing.hours += entry.hours;
      existing.costPrice += entry.costPrice;
      existing.salesPrice += entry.salesPrice;
    } else {
      aggregated.set(key, { ...entry });
    }
  }
  return Array.from(aggregated.values());
}
