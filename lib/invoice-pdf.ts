import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

interface InvoicePdfData {
  // Company (seller)
  companyName: string;
  companyAddress?: string | null;
  companyCvr?: string | null;
  companyBankAccount?: string | null;
  companyBankReg?: string | null;

  // Invoice
  invoiceNumber: string; // Formatted with prefix
  invoiceDate: string;
  dueDate: string;
  paymentTermsDays: number;
  currency: string;
  note?: string | null;

  // Client (buyer)
  clientName: string;
  clientAddress?: string | null;
  clientCvr?: string | null;
  clientEan?: string | null;

  // Lines
  lines: {
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }[];

  // Totals
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
}

/** Format a number Danish-style: period as thousands separator, comma as decimal */
function formatDanish(amount: number, decimals = 2): string {
  const fixed = amount.toFixed(decimals);
  const [intPart, decPart] = fixed.split(".");
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decPart ? `${withThousands},${decPart}` : withThousands;
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { height } = page.getSize();
  const margin = 50;
  let y = height - margin;

  const darkGray = rgb(0.2, 0.2, 0.2);
  const midGray = rgb(0.45, 0.45, 0.45);
  const lightGray = rgb(0.85, 0.85, 0.85);

  // --- Header ---
  page.drawText(data.companyName, { x: margin, y, size: 18, font: fontBold, color: darkGray });
  y -= 16;
  if (data.companyAddress) {
    page.drawText(data.companyAddress, { x: margin, y, size: 9, font, color: midGray });
    y -= 12;
  }
  if (data.companyCvr) {
    page.drawText(`CVR: ${data.companyCvr}`, { x: margin, y, size: 9, font, color: midGray });
    y -= 12;
  }

  // Invoice title on right
  page.drawText("FAKTURA", { x: 420, y: height - margin, size: 22, font: fontBold, color: darkGray });
  page.drawText(`#${data.invoiceNumber}`, { x: 420, y: height - margin - 20, size: 12, font, color: midGray });

  y -= 20;

  // --- Client info ---
  page.drawText("Kunde", { x: margin, y, size: 9, font: fontBold, color: midGray });
  y -= 14;
  page.drawText(data.clientName, { x: margin, y, size: 11, font: fontBold, color: darkGray });
  y -= 14;
  if (data.clientAddress) {
    page.drawText(data.clientAddress, { x: margin, y, size: 9, font, color: midGray });
    y -= 12;
  }
  if (data.clientCvr) {
    page.drawText(`CVR: ${data.clientCvr}`, { x: margin, y, size: 9, font, color: midGray });
    y -= 12;
  }
  if (data.clientEan) {
    page.drawText(`EAN: ${data.clientEan}`, { x: margin, y, size: 9, font, color: midGray });
    y -= 12;
  }

  // --- Dates on right ---
  const dateY = height - margin - 80;
  const labelX = 370;
  const valX = 460;
  page.drawText("Fakturadato:", { x: labelX, y: dateY, size: 9, font, color: midGray });
  page.drawText(data.invoiceDate, { x: valX, y: dateY, size: 9, font, color: darkGray });
  page.drawText("Forfaldsdato:", { x: labelX, y: dateY - 14, size: 9, font, color: midGray });
  page.drawText(data.dueDate, { x: valX, y: dateY - 14, size: 9, font, color: darkGray });
  page.drawText("Betaling:", { x: labelX, y: dateY - 28, size: 9, font, color: midGray });
  page.drawText(`Netto ${data.paymentTermsDays} dage`, { x: valX, y: dateY - 28, size: 9, font, color: darkGray });

  y -= 20;

  // --- Line items table ---
  const tableTop = y;
  const colDesc = margin;
  const colQty = 310;
  const colPrice = 380;
  const colAmount = 480;

  // Table header
  page.drawRectangle({ x: margin, y: tableTop - 4, width: 495, height: 18, color: lightGray });
  page.drawText("Beskrivelse", { x: colDesc + 4, y: tableTop, size: 9, font: fontBold, color: darkGray });
  page.drawText("Antal", { x: colQty, y: tableTop, size: 9, font: fontBold, color: darkGray });
  page.drawText("Stk. pris", { x: colPrice, y: tableTop, size: 9, font: fontBold, color: darkGray });
  page.drawText("Beløb", { x: colAmount, y: tableTop, size: 9, font: fontBold, color: darkGray });
  y = tableTop - 20;

  // Table rows — with multi-page support
  let currentPage = page;
  for (const line of data.lines) {
    if (y < 80) {
      // Add new page and repeat table header
      currentPage = doc.addPage([595, 842]);
      y = height - margin;
      currentPage.drawRectangle({ x: margin, y: y - 4, width: 495, height: 18, color: lightGray });
      currentPage.drawText("Beskrivelse", { x: colDesc + 4, y, size: 9, font: fontBold, color: darkGray });
      currentPage.drawText("Antal", { x: colQty, y, size: 9, font: fontBold, color: darkGray });
      currentPage.drawText("Stk. pris", { x: colPrice, y, size: 9, font: fontBold, color: darkGray });
      currentPage.drawText("Beløb", { x: colAmount, y, size: 9, font: fontBold, color: darkGray });
      y -= 20;
    }
    const desc = line.description.length > 45 ? line.description.substring(0, 42) + "..." : line.description;
    currentPage.drawText(desc, { x: colDesc + 4, y, size: 9, font, color: darkGray });
    currentPage.drawText(formatDanish(line.quantity, 2), { x: colQty, y, size: 9, font, color: darkGray });
    currentPage.drawText(formatDanish(line.unitPrice, 2), { x: colPrice, y, size: 9, font, color: darkGray });
    currentPage.drawText(formatDanish(line.amount, 2), { x: colAmount, y, size: 9, font, color: darkGray });
    y -= 16;
  }

  // Ensure enough space for totals + bank details + note (~150px)
  if (y < 150) {
    currentPage = doc.addPage([595, 842]);
    y = height - margin;
  }

  // --- Separator ---
  y -= 8;
  currentPage.drawLine({ start: { x: colPrice - 20, y }, end: { x: 545, y }, thickness: 0.5, color: lightGray });
  y -= 16;

  // --- Totals ---
  currentPage.drawText("Subtotal ekskl. moms:", { x: colPrice - 20, y, size: 9, font, color: midGray });
  currentPage.drawText(`${formatDanish(data.subtotal)} ${data.currency}`, { x: colAmount, y, size: 9, font, color: darkGray });
  y -= 16;

  currentPage.drawText(`${formatDanish(data.vatRate, 0)}% moms:`, { x: colPrice - 20, y, size: 9, font, color: midGray });
  currentPage.drawText(`${formatDanish(data.vatAmount)} ${data.currency}`, { x: colAmount, y, size: 9, font, color: darkGray });
  y -= 4;
  currentPage.drawLine({ start: { x: colPrice - 20, y }, end: { x: 545, y }, thickness: 0.5, color: lightGray });
  y -= 16;

  currentPage.drawText("Total inkl. moms:", { x: colPrice - 20, y, size: 10, font: fontBold, color: darkGray });
  currentPage.drawText(`${formatDanish(data.total)} ${data.currency}`, { x: colAmount, y, size: 10, font: fontBold, color: darkGray });

  // --- Bank details ---
  y -= 40;
  if (data.companyBankReg || data.companyBankAccount) {
    currentPage.drawText("Betalingsoplysninger", { x: margin, y, size: 9, font: fontBold, color: darkGray });
    y -= 14;
    if (data.companyBankReg) {
      currentPage.drawText(`Reg.nr.: ${data.companyBankReg}`, { x: margin, y, size: 9, font, color: midGray });
      y -= 12;
    }
    if (data.companyBankAccount) {
      currentPage.drawText(`Kontonr.: ${data.companyBankAccount}`, { x: margin, y, size: 9, font, color: midGray });
      y -= 12;
    }
  }

  // --- Footer note ---
  if (data.note) {
    y -= 10;
    const noteLines = data.note.split("\n");
    for (const nl of noteLines) {
      if (y < 40) break;
      currentPage.drawText(nl, { x: margin, y, size: 8, font, color: midGray });
      y -= 11;
    }
  }

  return doc.save();
}
