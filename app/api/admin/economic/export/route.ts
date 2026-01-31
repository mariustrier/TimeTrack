import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

function formatDate(date: Date): string {
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
}

function formatAmount(amount: number): string {
  return amount.toFixed(2).replace(".", ",");
}

function escapeCsvField(val: string): string {
  if (val.includes(";") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 });
    }

    const [company, timeEntries] = await Promise.all([
      db.company.findUnique({ where: { id: user.companyId } }),
      db.timeEntry.findMany({
        where: {
          companyId: user.companyId,
          date: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
          project: { billable: true },
        },
        include: {
          user: { select: { firstName: true, lastName: true, hourlyRate: true } },
          project: { select: { name: true } },
        },
        orderBy: { date: "asc" },
      }),
    ]);

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    if (!company.economicRevenueAccount) {
      return NextResponse.json(
        { error: "Revenue account not configured. Please save your e-conomic settings first." },
        { status: 400 }
      );
    }

    // Build CSV header
    const headers = ["Type", "Dato", "Bilagsnr", "Beløb", "Konto"];
    if (company.economicCounterAccount) headers.push("Modkonto");
    if (company.economicVatCode) headers.push("Momskode");
    headers.push("Valuta", "Tekst");

    // Build CSV rows
    const rows: string[] = [];
    let voucherNr = 1;

    for (const entry of timeEntries) {
      const amount = entry.hours * entry.user.hourlyRate;
      const employeeName = `${entry.user.firstName || ""} ${entry.user.lastName || ""}`.trim();
      const text = [entry.project.name, employeeName, entry.comment].filter(Boolean).join(" - ");

      const fields = [
        "Finansbilag",
        formatDate(entry.date),
        voucherNr.toString(),
        formatAmount(amount),
        company.economicRevenueAccount,
      ];

      if (company.economicCounterAccount) fields.push(company.economicCounterAccount);
      if (company.economicVatCode) fields.push(company.economicVatCode);
      fields.push(company.economicCurrency || "DKK");
      fields.push(text);

      rows.push(fields.map(escapeCsvField).join(";"));
      voucherNr++;
    }

    // UTF-8 BOM + header + rows
    const bom = "\uFEFF";
    const csv = bom + headers.map(escapeCsvField).join(";") + "\n" + rows.join("\n");

    const filename = `e-conomic-export-${startDate}-to-${endDate}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[ECONOMIC_EXPORT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
