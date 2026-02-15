import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import {
  format,
  differenceInCalendarWeeks,
  startOfWeek,
  addWeeks,
  eachWeekOfInterval,
} from "date-fns";
import { da } from "date-fns/locale";
import { getToday } from "@/lib/demo-date";
import type {
  TimelineProject,
  TimelineMilestone,
  TimelineActivity,
} from "@/components/project-timeline/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_DA: Record<string, string> = {
  not_started: "Ikke startet",
  in_progress: "I gang",
  needs_review: "Til review",
  complete: "Afsluttet",
};

/** Blend a hex color toward white by the given opacity (0=white, 1=original). */
function blendWithWhite(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (
    "FF" +
    Math.round(r * opacity + 255 * (1 - opacity))
      .toString(16)
      .padStart(2, "0") +
    Math.round(g * opacity + 255 * (1 - opacity))
      .toString(16)
      .padStart(2, "0") +
    Math.round(b * opacity + 255 * (1 - opacity))
      .toString(16)
      .padStart(2, "0")
  ).toUpperCase();
}

function hexToArgb(hex: string): string {
  return "FF" + hex.replace("#", "").toUpperCase();
}

const ACCENT_BLUE = "FF1E3A5F";
const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FFFFFFFF" },
  size: 10,
  name: "Calibri",
};
const ALT_ROW_FILL: ExcelJS.FillPattern = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF9FAFB" },
};
const WHITE_FILL: ExcelJS.FillPattern = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFFFFF" },
};
const THIN_BORDER: Partial<ExcelJS.Border> = {
  style: "thin",
  color: { argb: "FFE5E7EB" },
};
const BORDERS_ALL: Partial<ExcelJS.Borders> = {
  top: THIN_BORDER,
  bottom: THIN_BORDER,
  left: THIN_BORDER,
  right: THIN_BORDER,
};

function headerFill(): ExcelJS.FillPattern {
  return { type: "pattern", pattern: "solid", fgColor: { argb: ACCENT_BLUE } };
}

/** Apply standard print settings to a worksheet. */
function applyPrint(ws: ExcelJS.Worksheet) {
  ws.pageSetup = {
    orientation: "landscape",
    paperSize: 8 as ExcelJS.PaperSize,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };
}

/** Create the title + subtitle rows used on most sheets. */
function addSheetHeader(
  ws: ExcelJS.Worksheet,
  title: string,
  subtitle: string,
  mergeCols: number,
) {
  const titleRow = ws.getRow(1);
  const lastCol = String.fromCharCode(64 + Math.min(mergeCols, 26));
  ws.mergeCells(`A1:${lastCol}1`);
  titleRow.getCell(1).value = title;
  titleRow.getCell(1).font = { bold: true, size: 14, name: "Calibri" };
  titleRow.getCell(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFAFAF9" },
  };
  titleRow.height = 28;

  const subRow = ws.getRow(2);
  ws.mergeCells(`A2:${lastCol}2`);
  subRow.getCell(1).value = subtitle;
  subRow.getCell(1).font = {
    size: 9,
    color: { argb: "FF9CA3AF" },
    name: "Calibri",
  };
  subRow.height = 16;

  // Row 3 = spacer
  ws.getRow(3).height = 6;
}

/** Set auto-filter on the header row (row 4) spanning the given columns. */
function setAutoFilter(ws: ExcelJS.Worksheet, colCount: number) {
  const lastCol = String.fromCharCode(64 + Math.min(colCount, 26));
  ws.autoFilter = `A4:${lastCol}4`;
}

/** Produce a column letter from a 1-based index (supports up to AZ). */
function colLetter(n: number): string {
  if (n <= 26) return String.fromCharCode(64 + n);
  return (
    String.fromCharCode(64 + Math.floor((n - 1) / 26)) +
    String.fromCharCode(65 + ((n - 1) % 26))
  );
}

// ---------------------------------------------------------------------------
// Main export function
// ---------------------------------------------------------------------------

export async function exportTimelineToExcel(params: {
  projects: TimelineProject[];
  activities: Record<string, TimelineActivity[]>;
  milestones: TimelineMilestone[];
  companyName: string;
  generatedBy?: string;
  includeBudget?: boolean;
  includeMilestones?: boolean;
  includeActivities?: boolean;
  isDemo?: boolean;
}): Promise<void> {
  const {
    projects,
    activities,
    milestones,
    companyName,
    generatedBy = "System",
    includeBudget = true,
    includeMilestones = true,
    includeActivities = true,
    isDemo,
  } = params;

  const today = getToday(isDemo);
  const dateStr = format(today, "dd-MM-yyyy");
  const datePretty = format(today, "dd. MMMM yyyy", { locale: da });
  const subtitle = `Genereret ${datePretty} af ${generatedBy}`;

  const wb = new ExcelJS.Workbook();
  wb.creator = companyName;
  wb.created = today;

  // -------------------------------------------------------------------------
  // Sheet 1: Projektoversigt
  // -------------------------------------------------------------------------
  const buildOverview = () => {
    const ws = wb.addWorksheet("Projektoversigt", {
      properties: { tabColor: { argb: "FF1E3A5F" } },
    });

    const columns: { header: string; width: number }[] = [
      { header: "Projekt", width: 28 },
      { header: "Kode", width: 8 },
      { header: "Klient", width: 24 },
      { header: "Status", width: 12 },
      { header: "Fase", width: 18 },
      { header: "Startdato", width: 12 },
      { header: "Slutdato", width: 12 },
      { header: "Varighed uger", width: 12 },
      { header: "Budget timer", width: 13 },
      { header: "Forbrugt timer", width: 13 },
      { header: "Resterende", width: 13 },
      { header: "Forbrug %", width: 10 },
      { header: "Budget DKK", width: 15 },
      { header: "Fakturerbar", width: 10 },
      { header: "Faktureret DKK", width: 15 },
      { header: "Team", width: 30 },
    ];

    columns.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      col.width = c.width;
    });

    addSheetHeader(ws, `Projektoversigt \u2014 ${companyName}`, subtitle, 16);

    // Row 4: headers
    const headerRow = ws.getRow(4);
    headerRow.height = 22;
    columns.forEach((c, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = c.header;
      cell.font = HEADER_FONT;
      cell.fill = headerFill();
      cell.alignment = { vertical: "middle", horizontal: "left" };
      cell.border = BORDERS_ALL;
    });

    let totalBudget = 0;
    let totalUsed = 0;

    // Data rows
    projects.forEach((p, idx) => {
      const rowNum = 5 + idx;
      const row = ws.getRow(rowNum);
      const isAlt = idx % 2 === 1;

      // Status
      const status = p.archived
        ? "Inaktiv"
        : p.locked
          ? "Pauset"
          : "Aktiv";

      // Dates
      const startDate = p.startDate
        ? format(new Date(p.startDate), "dd.MM.yyyy")
        : "";
      const endDate = p.endDate
        ? format(new Date(p.endDate), "dd.MM.yyyy")
        : "";

      // Duration
      let durationWeeks: number | null = null;
      if (p.startDate && p.endDate) {
        durationWeeks = differenceInCalendarWeeks(
          new Date(p.endDate),
          new Date(p.startDate),
          { weekStartsOn: 1 },
        );
      }

      // Budget
      const budget = p.budgetHours ?? 0;
      const used = p.hoursUsed;
      const remaining = budget > 0 ? budget - used : null;
      const pct = budget > 0 ? used / budget : null;
      totalBudget += budget;
      totalUsed += used;

      // Billable
      const isBillable = budget > 0;

      // Team
      const teamNames = p.allocations
        ? Array.from(
            new Set(p.allocations.map((a) => a.userName)),
          ).join(", ")
        : "";

      const values: (string | number | null)[] = [
        p.name,
        p.id.slice(0, 6).toUpperCase(),
        p.client ?? "",
        status,
        p.currentPhase?.name ?? "",
        startDate,
        endDate,
        durationWeeks,
        budget > 0 ? budget : null,
        used > 0 ? used : null,
        remaining,
        pct,
        null, // Budget DKK — not available in timeline data
        isBillable ? "Ja" : "Nej",
        null, // Faktureret DKK
        teamNames,
      ];

      values.forEach((v, ci) => {
        const cell = row.getCell(ci + 1);
        cell.value = v as ExcelJS.CellValue;
        cell.fill = isAlt ? ALT_ROW_FILL : WHITE_FILL;
        cell.border = BORDERS_ALL;
        cell.alignment = { vertical: "middle" };
      });

      // Number formats
      row.getCell(9).numFmt = '#,##0.0';
      row.getCell(10).numFmt = '#,##0.0';
      row.getCell(11).numFmt = '#,##0.0';
      row.getCell(12).numFmt = '0.0%';
      row.getCell(13).numFmt = '#,##0 "DKK"';
      row.getCell(15).numFmt = '#,##0 "DKK"';

      // Conditional formatting on Forbrug %
      if (pct !== null) {
        const cell12 = row.getCell(12);
        if (pct > 1) {
          cell12.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFEE2E2" },
          };
          cell12.font = { bold: true, color: { argb: "FF991B1B" } };
        } else if (pct >= 0.9) {
          cell12.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFEF2F2" },
          };
          cell12.font = { color: { argb: "FFDC2626" } };
        } else if (pct >= 0.75) {
          cell12.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFFBEB" },
          };
          cell12.font = { color: { argb: "FFD97706" } };
        } else {
          cell12.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFECFDF5" },
          };
          cell12.font = { color: { argb: "FF059669" } };
        }
      }

      // Fakturerbar styling
      const cell14 = row.getCell(14);
      if (isBillable) {
        cell14.font = { color: { argb: "FF059669" } };
      } else {
        cell14.font = { italic: true, color: { argb: "FF9CA3AF" } };
      }

      // Status styling
      const cell4 = row.getCell(4);
      if (status === "Aktiv") {
        cell4.font = { color: { argb: "FF059669" } };
      } else if (status === "Pauset") {
        cell4.font = { color: { argb: "FFD97706" } };
      } else {
        cell4.font = { color: { argb: "FF9CA3AF" } };
      }
    });

    // Totals row
    const totalRowNum = 5 + projects.length;
    const totalRow = ws.getRow(totalRowNum);
    totalRow.getCell(1).value = "Total";
    totalRow.getCell(1).font = { bold: true };
    totalRow.getCell(9).value = totalBudget > 0 ? totalBudget : null;
    totalRow.getCell(9).numFmt = '#,##0.0';
    totalRow.getCell(10).value = totalUsed > 0 ? totalUsed : null;
    totalRow.getCell(10).numFmt = '#,##0.0';
    const totalRemaining = totalBudget > 0 ? totalBudget - totalUsed : null;
    totalRow.getCell(11).value = totalRemaining;
    totalRow.getCell(11).numFmt = '#,##0.0';
    const totalPct = totalBudget > 0 ? totalUsed / totalBudget : null;
    totalRow.getCell(12).value = totalPct;
    totalRow.getCell(12).numFmt = '0.0%';

    for (let ci = 1; ci <= 16; ci++) {
      const cell = totalRow.getCell(ci);
      cell.font = { ...cell.font, bold: true };
      cell.border = {
        ...BORDERS_ALL,
        top: { style: "medium", color: { argb: "FF1F2937" } },
      };
    }

    setAutoFilter(ws, 16);
    ws.views = [{ state: "frozen", xSplit: 0, ySplit: 4 }];
    applyPrint(ws);
  };

  // -------------------------------------------------------------------------
  // Sheet 2: Aktiviteter
  // -------------------------------------------------------------------------
  const buildActivities = () => {
    if (!includeActivities) return;

    const ws = wb.addWorksheet("Aktiviteter", {
      properties: { tabColor: { argb: "FFF59E0B" } },
    });

    const columns = [
      { header: "Projekt", width: 24 },
      { header: "Kategori/Fase", width: 20 },
      { header: "Aktivitet", width: 30 },
      { header: "Ansvarlig", width: 18 },
      { header: "Status", width: 14 },
      { header: "Startdato", width: 12 },
      { header: "Slutdato", width: 12 },
      { header: "Varighed uger", width: 12 },
      { header: "Note", width: 35 },
    ];

    columns.forEach((c, i) => {
      ws.getColumn(i + 1).width = c.width;
    });

    addSheetHeader(ws, `Aktiviteter \u2014 ${companyName}`, subtitle, 9);

    // Row 4: headers
    const headerRow = ws.getRow(4);
    headerRow.height = 22;
    columns.forEach((c, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = c.header;
      cell.font = HEADER_FONT;
      cell.fill = headerFill();
      cell.alignment = { vertical: "middle", horizontal: "left" };
      cell.border = BORDERS_ALL;
    });

    // Collect all activities sorted by project name then sortOrder
    const projectMap: Record<string, TimelineProject> = {};
    projects.forEach((p) => {
      projectMap[p.id] = p;
    });

    const allActivities: { project: TimelineProject; activity: TimelineActivity }[] = [];
    Object.keys(activities).forEach((projId) => {
      const proj = projectMap[projId];
      if (!proj) return;
      const acts = activities[projId] ?? [];
      acts.forEach((a) => {
        allActivities.push({ project: proj, activity: a });
      });
    });

    allActivities.sort((a, b) => {
      const nameCompare = a.project.name.localeCompare(b.project.name, "da");
      if (nameCompare !== 0) return nameCompare;
      return a.activity.sortOrder - b.activity.sortOrder;
    });

    let lastProjectId = "";
    let dataRowIdx = 0;

    allActivities.forEach(({ project: proj, activity: act }) => {
      const rowNum = 5 + dataRowIdx;
      const row = ws.getRow(rowNum);
      const isAlt = dataRowIdx % 2 === 1;

      const durationWeeks =
        act.startDate && act.endDate
          ? differenceInCalendarWeeks(
              new Date(act.endDate),
              new Date(act.startDate),
              { weekStartsOn: 1 },
            )
          : null;

      const values: (string | number | null)[] = [
        proj.name,
        act.categoryName ?? act.phaseName ?? "",
        act.name,
        act.assignedUserName ?? "",
        STATUS_DA[act.status] ?? act.status,
        act.startDate ? format(new Date(act.startDate), "dd.MM.yyyy") : "",
        act.endDate ? format(new Date(act.endDate), "dd.MM.yyyy") : "",
        durationWeeks,
        act.note ?? "",
      ];

      values.forEach((v, ci) => {
        const cell = row.getCell(ci + 1);
        cell.value = v as ExcelJS.CellValue;
        cell.fill = isAlt ? ALT_ROW_FILL : WHITE_FILL;
        cell.border = BORDERS_ALL;
        cell.alignment = { vertical: "middle" };
      });

      // Project color left border when project changes
      if (proj.id !== lastProjectId) {
        row.getCell(1).border = {
          ...BORDERS_ALL,
          left: {
            style: "medium",
            color: { argb: hexToArgb(proj.color) },
          },
        };
        lastProjectId = proj.id;
      }

      // Status colors
      const statusCell = row.getCell(5);
      const statusColors: Record<string, string> = {
        not_started: "FF6B7280",
        in_progress: "FFD97706",
        needs_review: "FFEA580C",
        complete: "FF059669",
      };
      statusCell.font = {
        color: { argb: statusColors[act.status] ?? "FF6B7280" },
      };

      // Strikethrough on name if complete
      if (act.status === "complete") {
        row.getCell(3).font = {
          strike: true,
          color: { argb: "FF9CA3AF" },
        };
      }

      dataRowIdx++;
    });

    setAutoFilter(ws, 9);
    ws.views = [{ state: "frozen", xSplit: 0, ySplit: 4 }];
    applyPrint(ws);
  };

  // -------------------------------------------------------------------------
  // Sheet 3: Milepæle
  // -------------------------------------------------------------------------
  const buildMilestones = () => {
    if (!includeMilestones) return;

    const ws = wb.addWorksheet("Milepæle", {
      properties: { tabColor: { argb: "FF059669" } },
    });

    const columns = [
      { header: "Projekt", width: 24 },
      { header: "Milepæl", width: 28 },
      { header: "Type", width: 16 },
      { header: "Forfaldsdato", width: 14 },
      { header: "Status", width: 14 },
      { header: "Beskrivelse", width: 35 },
    ];

    columns.forEach((c, i) => {
      ws.getColumn(i + 1).width = c.width;
    });

    addSheetHeader(ws, `Milepæle \u2014 ${companyName}`, subtitle, 6);

    const headerRow = ws.getRow(4);
    headerRow.height = 22;
    columns.forEach((c, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = c.header;
      cell.font = HEADER_FONT;
      cell.fill = headerFill();
      cell.alignment = { vertical: "middle", horizontal: "left" };
      cell.border = BORDERS_ALL;
    });

    // Project lookup
    const projectMap: Record<string, TimelineProject> = {};
    projects.forEach((p) => {
      projectMap[p.id] = p;
    });

    // Sort by dueDate ascending
    const sorted = [...milestones].sort(
      (a, b) =>
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    );

    sorted.forEach((m, idx) => {
      const rowNum = 5 + idx;
      const row = ws.getRow(rowNum);
      const isAlt = idx % 2 === 1;
      const proj = projectMap[m.projectId];

      // Status
      const dueDate = new Date(m.dueDate);
      let statusText: string;
      let statusColor: string;
      let statusFill: ExcelJS.FillPattern | null = null;

      if (m.completed) {
        statusText = "Afsluttet \u2713";
        statusColor = "FF059669";
      } else if (dueDate < today) {
        statusText = "Forfalden \u26A0";
        statusColor = "FFDC2626";
        statusFill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFEF2F2" },
        };
      } else {
        statusText = "Kommende";
        statusColor = "FF9CA3AF";
      }

      const values: (string | number | null)[] = [
        proj?.name ?? "",
        m.title,
        m.type === "phase" ? "Fase" : "Brugerdefineret",
        format(dueDate, "dd.MM.yyyy"),
        statusText,
        m.description ?? "",
      ];

      values.forEach((v, ci) => {
        const cell = row.getCell(ci + 1);
        cell.value = v as ExcelJS.CellValue;
        cell.fill = isAlt ? ALT_ROW_FILL : WHITE_FILL;
        cell.border = BORDERS_ALL;
        cell.alignment = { vertical: "middle" };
      });

      // Status styling
      const sCell = row.getCell(5);
      sCell.font = { color: { argb: statusColor } };
      if (statusFill) {
        sCell.fill = statusFill;
      }
    });

    setAutoFilter(ws, 6);
    ws.views = [{ state: "frozen", xSplit: 0, ySplit: 4 }];
    applyPrint(ws);
  };

  // -------------------------------------------------------------------------
  // Sheet 4: Tidslinje (Gantt)
  // -------------------------------------------------------------------------
  const buildTimeline = () => {
    const ws = wb.addWorksheet("Tidslinje", {
      properties: { tabColor: { argb: "FF7C3AED" } },
    });

    // Calculate date range across all projects + activities
    let earliest: Date | null = null;
    let latest: Date | null = null;

    const extendRange = (dateStr: string | null) => {
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (!earliest || d < earliest) earliest = d;
      if (!latest || d > latest) latest = d;
    };

    projects.forEach((p) => {
      extendRange(p.startDate);
      extendRange(p.endDate);
    });

    Object.keys(activities).forEach((projId) => {
      const acts = activities[projId] ?? [];
      acts.forEach((a) => {
        extendRange(a.startDate);
        extendRange(a.endDate);
      });
    });

    milestones.forEach((m) => {
      extendRange(m.dueDate);
    });

    // Fallback if no dates at all
    if (!earliest) earliest = today;
    if (!latest) latest = addWeeks(today, 12);

    // Pad: -2 weeks before, +4 weeks after
    const rangeStart = startOfWeek(addWeeks(earliest, -2), {
      weekStartsOn: 1,
    });
    const rangeEnd = addWeeks(latest, 4);

    const weeks = eachWeekOfInterval(
      { start: rangeStart, end: rangeEnd },
      { weekStartsOn: 1 },
    );

    // Column A = names
    ws.getColumn(1).width = 32;

    // One column per week
    weeks.forEach((_, wi) => {
      ws.getColumn(wi + 2).width = 3.8;
    });

    // ---- Row 1: Month headers ----
    const monthRow = ws.getRow(1);
    monthRow.height = 18;
    let monthStart = 0;
    let currentMonth = "";

    weeks.forEach((weekDate, wi) => {
      const monthKey = format(weekDate, "MMM yyyy", { locale: da });
      if (monthKey !== currentMonth) {
        if (currentMonth && wi > monthStart) {
          // Merge previous month span
          const startCol = colLetter(monthStart + 2);
          const endCol = colLetter(wi + 1); // last col of previous month
          if (monthStart + 2 !== wi + 1) {
            ws.mergeCells(`${startCol}1:${endCol}1`);
          }
          const mCell = monthRow.getCell(monthStart + 2);
          mCell.value = currentMonth;
          mCell.font = { bold: true, size: 9, name: "Calibri" };
          mCell.alignment = { horizontal: "center", vertical: "middle" };
          mCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF3F4F6" },
          };
        }
        currentMonth = monthKey;
        monthStart = wi;
      }
    });
    // Final month
    if (currentMonth && weeks.length > monthStart) {
      const startCol = colLetter(monthStart + 2);
      const endCol = colLetter(weeks.length + 1);
      if (monthStart + 2 !== weeks.length + 1) {
        ws.mergeCells(`${startCol}1:${endCol}1`);
      }
      const mCell = monthRow.getCell(monthStart + 2);
      mCell.value = currentMonth;
      mCell.font = { bold: true, size: 9, name: "Calibri" };
      mCell.alignment = { horizontal: "center", vertical: "middle" };
      mCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF3F4F6" },
      };
    }

    // ---- Row 2: Week numbers ----
    const weekRow = ws.getRow(2);
    weekRow.height = 16;
    weekRow.getCell(1).value = "";
    weeks.forEach((weekDate, wi) => {
      const cell = weekRow.getCell(wi + 2);
      const wn = format(weekDate, "I", { locale: da });
      cell.value = parseInt(wn, 10);
      cell.font = { size: 8, color: { argb: "FF9CA3AF" }, name: "Calibri" };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF9FAFB" },
      };
    });

    // Determine "today" column index
    const todayWeekStart = startOfWeek(today, { weekStartsOn: 1 });
    let todayColIdx = -1;
    weeks.forEach((w, wi) => {
      if (
        w.getFullYear() === todayWeekStart.getFullYear() &&
        w.getMonth() === todayWeekStart.getMonth() &&
        w.getDate() === todayWeekStart.getDate()
      ) {
        todayColIdx = wi;
      }
    });

    // Highlight today's week number
    if (todayColIdx >= 0) {
      const todayCell = weekRow.getCell(todayColIdx + 2);
      todayCell.font = {
        bold: true,
        size: 8,
        color: { argb: "FFD97706" },
        name: "Calibri",
      };
    }

    /** Map a date string to its week column index (0-based in weeks array). */
    const dateToWeekCol = (dateStr: string): number => {
      const d = startOfWeek(new Date(dateStr), { weekStartsOn: 1 });
      let best = 0;
      let bestDiff = Infinity;
      weeks.forEach((w, wi) => {
        const diff = Math.abs(d.getTime() - w.getTime());
        if (diff < bestDiff) {
          bestDiff = diff;
          best = wi;
        }
      });
      return best;
    };

    // Project lookup
    const projectMap: Record<string, TimelineProject> = {};
    projects.forEach((p) => {
      projectMap[p.id] = p;
    });

    // Build milestone lookup by project
    const milestonesByProject: Record<string, TimelineMilestone[]> = {};
    milestones.forEach((m) => {
      if (!milestonesByProject[m.projectId]) {
        milestonesByProject[m.projectId] = [];
      }
      milestonesByProject[m.projectId].push(m);
    });

    // ---- Build rows for each project ----
    let currentRow = 3;

    projects.forEach((proj) => {
      // --- Project bar row ---
      const projRow = ws.getRow(currentRow);
      projRow.height = 20;
      projRow.getCell(1).value = proj.name;
      projRow.getCell(1).font = { bold: true, size: 10, name: "Calibri" };

      // Fill date range cells with project color at 30%
      if (proj.startDate && proj.endDate) {
        const startWi = dateToWeekCol(proj.startDate);
        const endWi = dateToWeekCol(proj.endDate);
        const barColor = blendWithWhite(proj.color, 0.3);
        for (let wi = startWi; wi <= endWi && wi < weeks.length; wi++) {
          const cell = projRow.getCell(wi + 2);
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: barColor },
          };
        }
      }

      // Today column highlight on project row
      if (todayColIdx >= 0) {
        const todayCell = projRow.getCell(todayColIdx + 2);
        if (!todayCell.fill || (todayCell.fill as ExcelJS.FillPattern).fgColor === undefined) {
          todayCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFEF3C7" },
          };
        }
      }

      currentRow++;

      // --- Activities for this project ---
      const projActivities = activities[proj.id] ?? [];

      // Group by category/phase
      const categoryGroups: Record<string, TimelineActivity[]> = {};
      projActivities.forEach((a) => {
        const key = a.categoryName ?? a.phaseName ?? "Uncategorized";
        if (!categoryGroups[key]) categoryGroups[key] = [];
        categoryGroups[key].push(a);
      });

      // Sort activities within each group by sortOrder
      Object.keys(categoryGroups).forEach((key) => {
        categoryGroups[key].sort((a, b) => a.sortOrder - b.sortOrder);
      });

      Object.keys(categoryGroups).forEach((catName) => {
        const catActivities = categoryGroups[catName];
        const sampleAct = catActivities[0];
        const catColor = sampleAct?.phaseColor ?? proj.color;

        // Category header row
        const catRow = ws.getRow(currentRow);
        catRow.height = 16;
        catRow.getCell(1).value = `  \u25B8 ${catName}`;
        catRow.getCell(1).font = {
          bold: true,
          size: 9,
          color: { argb: "FF4B5563" },
          name: "Calibri",
        };
        catRow.getCell(1).border = {
          left: { style: "medium", color: { argb: hexToArgb(catColor) } },
        };

        // Today highlight
        if (todayColIdx >= 0) {
          catRow.getCell(todayColIdx + 2).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFEF3C7" },
          };
        }

        currentRow++;

        // Activity rows
        catActivities.forEach((act) => {
          const actRow = ws.getRow(currentRow);
          actRow.height = 16;
          actRow.getCell(1).value = `      ${act.name}`;
          actRow.getCell(1).font = {
            size: 9,
            color: { argb: "FF374151" },
            name: "Calibri",
          };

          // Status left border color
          const statusBorderColors: Record<string, string> = {
            not_started: "FF9CA3AF",
            in_progress: "FFD97706",
            needs_review: "FFEA580C",
            complete: "FF059669",
          };
          actRow.getCell(1).border = {
            left: {
              style: "thin",
              color: {
                argb: statusBorderColors[act.status] ?? "FF9CA3AF",
              },
            },
          };

          // Fill bar in date range with project color at 50%
          if (act.startDate && act.endDate) {
            const startWi = dateToWeekCol(act.startDate);
            const endWi = dateToWeekCol(act.endDate);
            const barColor = blendWithWhite(
              act.color ?? act.phaseColor ?? proj.color,
              0.5,
            );

            for (let wi = startWi; wi <= endWi && wi < weeks.length; wi++) {
              const cell = actRow.getCell(wi + 2);
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: barColor },
              };
            }

            // Activity name in first bar cell
            const firstBarCell = actRow.getCell(startWi + 2);
            firstBarCell.value = act.name;
            firstBarCell.font = {
              size: 7.5,
              color: { argb: "FF1F2937" },
              name: "Calibri",
            };
          }

          // Today highlight
          if (todayColIdx >= 0) {
            const todayCell = actRow.getCell(todayColIdx + 2);
            if (
              !todayCell.fill ||
              (todayCell.fill as ExcelJS.FillPattern).fgColor === undefined
            ) {
              todayCell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFFEF3C7" },
              };
            }
          }

          currentRow++;
        });
      });

      // --- Milestones for this project ---
      const projMilestones = milestonesByProject[proj.id] ?? [];
      projMilestones.forEach((m) => {
        const msRow = ws.getRow(currentRow);
        msRow.height = 16;

        const dueFormatted = format(new Date(m.dueDate), "dd.MM");
        msRow.getCell(1).value = `  \u25C6 ${m.title}  (${dueFormatted})`;
        msRow.getCell(1).font = {
          size: 9,
          color: {
            argb: hexToArgb(
              m.color ?? m.phaseColor ?? proj.color,
            ),
          },
          name: "Calibri",
        };

        // Place diamond in correct week column
        const msWi = dateToWeekCol(m.dueDate);
        const msCell = msRow.getCell(msWi + 2);
        msCell.value = "\u25C6";
        msCell.font = {
          bold: true,
          size: 10,
          color: {
            argb: hexToArgb(
              m.color ?? m.phaseColor ?? proj.color,
            ),
          },
        };
        msCell.alignment = { horizontal: "center" };

        // Adjacent dots
        if (msWi > 0) {
          const prevCell = msRow.getCell(msWi + 1);
          prevCell.value = "\u00B7";
          prevCell.font = {
            color: {
              argb: hexToArgb(
                m.color ?? m.phaseColor ?? proj.color,
              ),
            },
          };
          prevCell.alignment = { horizontal: "center" };
        }
        if (msWi + 1 < weeks.length) {
          const nextCell = msRow.getCell(msWi + 3);
          nextCell.value = "\u00B7";
          nextCell.font = {
            color: {
              argb: hexToArgb(
                m.color ?? m.phaseColor ?? proj.color,
              ),
            },
          };
          nextCell.alignment = { horizontal: "center" };
        }

        // Today highlight
        if (todayColIdx >= 0) {
          const todayCell = msRow.getCell(todayColIdx + 2);
          if (
            !todayCell.fill ||
            (todayCell.fill as ExcelJS.FillPattern).fgColor === undefined
          ) {
            todayCell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFEF3C7" },
            };
          }
        }

        currentRow++;
      });

      // Spacer row between projects
      const spacer = ws.getRow(currentRow);
      spacer.height = 8;

      // Today highlight on spacer
      if (todayColIdx >= 0) {
        spacer.getCell(todayColIdx + 2).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFEF3C7" },
        };
      }

      currentRow++;
    });

    // Freeze at B3
    ws.views = [{ state: "frozen", xSplit: 1, ySplit: 2 }];
    applyPrint(ws);
  };

  // -------------------------------------------------------------------------
  // Sheet 5: Budgetstatus
  // -------------------------------------------------------------------------
  const buildBudget = () => {
    if (!includeBudget) return;

    const ws = wb.addWorksheet("Budgetstatus", {
      properties: { tabColor: { argb: "FFDC2626" } },
    });

    const columns = [
      { header: "Projekt", width: 28 },
      { header: "Klient", width: 22 },
      { header: "Fakturerbar", width: 12 },
      { header: "Budget timer", width: 13 },
      { header: "Forbrugt timer", width: 13 },
      { header: "Resterende timer", width: 13 },
      { header: "Forbrug %", width: 12 },
      { header: "Budget DKK", width: 15 },
      { header: "Omsætning DKK", width: 15 },
      { header: "Est. færdig DKK", width: 15 },
      { header: "Dækningsgrad %", width: 13 },
    ];

    columns.forEach((c, i) => {
      ws.getColumn(i + 1).width = c.width;
    });

    addSheetHeader(ws, `Budgetstatus \u2014 ${companyName}`, subtitle, 11);

    const headerRow = ws.getRow(4);
    headerRow.height = 22;
    columns.forEach((c, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = c.header;
      cell.font = HEADER_FONT;
      cell.fill = headerFill();
      cell.alignment = { vertical: "middle", horizontal: "left" };
      cell.border = BORDERS_ALL;
    });

    let totalBudgetH = 0;
    let totalUsedH = 0;

    projects.forEach((p, idx) => {
      const rowNum = 5 + idx;
      const row = ws.getRow(rowNum);
      const isAlt = idx % 2 === 1;

      const budget = p.budgetHours ?? 0;
      const used = p.hoursUsed;
      const remaining = budget > 0 ? budget - used : null;
      const pct = budget > 0 ? used / budget : null;
      const isBillable = budget > 0;
      totalBudgetH += budget;
      totalUsedH += used;

      const values: (string | number | null)[] = [
        p.name,
        p.client ?? "",
        isBillable ? "Ja" : "Nej",
        budget > 0 ? budget : null,
        used > 0 ? used : null,
        remaining,
        pct,
        null, // Budget DKK
        null, // Omsætning DKK
        null, // Est. færdig DKK
        null, // Dækningsgrad %
      ];

      values.forEach((v, ci) => {
        const cell = row.getCell(ci + 1);
        cell.value = v as ExcelJS.CellValue;
        cell.fill = isAlt ? ALT_ROW_FILL : WHITE_FILL;
        cell.border = BORDERS_ALL;
        cell.alignment = { vertical: "middle" };
      });

      // Number formats
      row.getCell(4).numFmt = '#,##0.0';
      row.getCell(5).numFmt = '#,##0.0';
      row.getCell(6).numFmt = '#,##0.0';
      row.getCell(7).numFmt = '0.0%';
      row.getCell(8).numFmt = '#,##0 "DKK"';
      row.getCell(9).numFmt = '#,##0 "DKK"';
      row.getCell(10).numFmt = '#,##0 "DKK"';
      row.getCell(11).numFmt = '0.0%';

      // Conditional formatting on Forbrug %
      if (pct !== null) {
        const cell7 = row.getCell(7);
        if (pct > 1) {
          cell7.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFEE2E2" },
          };
          cell7.font = { bold: true, color: { argb: "FF991B1B" } };
        } else if (pct >= 0.9) {
          cell7.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFEF2F2" },
          };
          cell7.font = { color: { argb: "FFDC2626" } };
        } else if (pct >= 0.75) {
          cell7.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFFBEB" },
          };
          cell7.font = { color: { argb: "FFD97706" } };
        } else {
          cell7.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFECFDF5" },
          };
          cell7.font = { color: { argb: "FF059669" } };
        }
      }

      // Fakturerbar styling
      const cell3 = row.getCell(3);
      if (isBillable) {
        cell3.font = { color: { argb: "FF059669" } };
      } else {
        cell3.font = { italic: true, color: { argb: "FF9CA3AF" } };
      }

      // Dækningsgrad styling (column 11) — only style if we have a value
      // Since we don't have DKK data from the timeline, this column will be null
      // but the styling logic is ready for when data is available
    });

    // Totals row
    const totalRowNum = 5 + projects.length;
    const totalRow = ws.getRow(totalRowNum);
    totalRow.getCell(1).value = "Total";
    totalRow.getCell(1).font = { bold: true };

    // Use SUM formulas for totals
    if (projects.length > 0) {
      const lastDataRow = 4 + projects.length;
      totalRow.getCell(4).value = {
        formula: `SUM(D5:D${lastDataRow})`,
      } as ExcelJS.CellFormulaValue;
      totalRow.getCell(5).value = {
        formula: `SUM(E5:E${lastDataRow})`,
      } as ExcelJS.CellFormulaValue;
      totalRow.getCell(6).value = {
        formula: `SUM(F5:F${lastDataRow})`,
      } as ExcelJS.CellFormulaValue;
      // Overall % = total used / total budget
      totalRow.getCell(7).value =
        totalBudgetH > 0 ? totalUsedH / totalBudgetH : null;
      totalRow.getCell(8).value = {
        formula: `SUM(H5:H${lastDataRow})`,
      } as ExcelJS.CellFormulaValue;
      totalRow.getCell(9).value = {
        formula: `SUM(I5:I${lastDataRow})`,
      } as ExcelJS.CellFormulaValue;
      totalRow.getCell(10).value = {
        formula: `SUM(J5:J${lastDataRow})`,
      } as ExcelJS.CellFormulaValue;
    }

    // Formats on totals
    totalRow.getCell(4).numFmt = '#,##0.0';
    totalRow.getCell(5).numFmt = '#,##0.0';
    totalRow.getCell(6).numFmt = '#,##0.0';
    totalRow.getCell(7).numFmt = '0.0%';
    totalRow.getCell(8).numFmt = '#,##0 "DKK"';
    totalRow.getCell(9).numFmt = '#,##0 "DKK"';
    totalRow.getCell(10).numFmt = '#,##0 "DKK"';
    totalRow.getCell(11).numFmt = '0.0%';

    for (let ci = 1; ci <= 11; ci++) {
      const cell = totalRow.getCell(ci);
      cell.font = { ...cell.font, bold: true };
      cell.border = {
        ...BORDERS_ALL,
        top: { style: "medium", color: { argb: "FF1F2937" } },
      };
    }

    setAutoFilter(ws, 11);
    ws.views = [{ state: "frozen", xSplit: 0, ySplit: 4 }];
    applyPrint(ws);
  };

  // -------------------------------------------------------------------------
  // Build all sheets
  // -------------------------------------------------------------------------

  buildOverview();
  buildActivities();
  buildMilestones();
  buildTimeline();
  buildBudget();

  // -------------------------------------------------------------------------
  // Save file
  // -------------------------------------------------------------------------

  const filename = `Projekttidslinje \u2014 ${companyName} \u2014 ${dateStr}.xlsx`;
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, filename);
}
