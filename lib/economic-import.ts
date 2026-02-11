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

  // Row 1: "{CompanyId} - {CompanyName}"
  const companyRow = String(rows[1]?.[0] || "");
  const companyParts = companyRow.split(" - ");
  const sourceCompanyId = companyParts[0]?.trim() || "";
  const sourceCompanyName = companyParts.slice(1).join(" - ").trim();

  // Row 3: "Projektkort - projekt {ProjectNumber}"
  const projektRow = String(rows[3]?.[0] || "");
  const projektMatch = projektRow.match(/projekt\s+(\S+)/i);
  const projectNumber = projektMatch?.[1] || "";

  // Row 6: "Underprojekt {ProjectNumber} - {ProjectName}"
  const subRow = String(rows[6]?.[0] || "");
  const subMatch = subRow.match(/Underprojekt\s+\S+\s*-\s*(.+)/i);
  const projectName = subMatch?.[1]?.trim() || projectNumber;

  if (!projectNumber && !projectName) {
    throw new Error("Invalid Projektkort format: could not extract project info");
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

  return {
    sourceCompanyId,
    sourceCompanyName,
    projectNumber,
    projectName,
    invoices,
    totalInvoiced,
    taskCategories,
    timeEntries,
    uniqueEmployees: Array.from(employeeSet).sort(),
    totalHours,
    totalCost,
    totalSales,
  };
}
