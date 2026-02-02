import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import JSZip from "jszip";

function sanitize(str: string): string {
  return str.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 50);
}

function getExtension(url: string, fallback = "bin"): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split(".").pop();
    if (ext && ext.length <= 5) return ext;
  } catch {}
  return fallback;
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

    const from = new Date(startDate);
    const to = new Date(endDate);
    to.setHours(23, 59, 59, 999);

    const [employeeExpenses, companyExpenses] = await Promise.all([
      db.expense.findMany({
        where: {
          companyId: user.companyId,
          receiptUrl: { not: null },
          date: { gte: from, lte: to },
        },
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
        orderBy: { date: "asc" },
      }),
      db.companyExpense.findMany({
        where: {
          companyId: user.companyId,
          receiptUrl: { not: null },
          date: { gte: from, lte: to },
        },
        orderBy: { date: "asc" },
      }),
    ]);

    const totalReceipts = employeeExpenses.length + companyExpenses.length;
    if (totalReceipts === 0) {
      return NextResponse.json({ error: "No receipts found in this period" }, { status: 404 });
    }

    const zip = new JSZip();

    // Include company logo if available
    const company = await db.company.findUnique({
      where: { id: user.companyId },
      select: { logoUrl: true },
    });
    if (company?.logoUrl) {
      try {
        const logoRes = await fetch(company.logoUrl);
        if (logoRes.ok) {
          const logoBuffer = await logoRes.arrayBuffer();
          const logoExt = getExtension(company.logoUrl, "png");
          zip.file(`company-logo.${logoExt}`, logoBuffer);
        }
      } catch {
        // Skip if logo download fails
      }
    }

    const empFolder = zip.folder("employee-expenses")!;
    const compFolder = zip.folder("company-expenses")!;

    // Download and add employee expense receipts
    for (const expense of employeeExpenses) {
      if (!expense.receiptUrl) continue;
      try {
        const res = await fetch(expense.receiptUrl);
        if (!res.ok) continue;
        const buffer = await res.arrayBuffer();
        const name = [
          sanitize(`${expense.user.firstName || ""}_${expense.user.lastName || ""}`),
          expense.date.toISOString().split("T")[0],
          sanitize(String(expense.amount)),
          sanitize(expense.category),
        ].join("_");
        const ext = getExtension(expense.receiptUrl);
        empFolder.file(`${name}.${ext}`, buffer);
      } catch {
        // Skip failed downloads
      }
    }

    // Download and add company expense receipts
    for (const expense of companyExpenses) {
      if (!expense.receiptUrl) continue;
      try {
        const res = await fetch(expense.receiptUrl);
        if (!res.ok) continue;
        const buffer = await res.arrayBuffer();
        const name = [
          "company",
          expense.date.toISOString().split("T")[0],
          sanitize(expense.category),
          sanitize(expense.description.substring(0, 30)),
        ].join("_");
        const ext = getExtension(expense.receiptUrl);
        compFolder.file(`${name}.${ext}`, buffer);
      } catch {
        // Skip failed downloads
      }
    }

    const zipArrayBuffer = await zip.generateAsync({ type: "arraybuffer" });

    return new NextResponse(zipArrayBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="receipts-${startDate}-${endDate}.zip"`,
      },
    });
  } catch (error) {
    console.error("[EXPORT_RECEIPTS]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
