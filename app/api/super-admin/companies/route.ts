import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await requireSuperAdmin();

    const [companies, importedCounts, latestImports] = await Promise.all([
      db.company.findMany({
        where: { isDemo: false },
        include: {
          _count: {
            select: {
              users: true,
              timeEntries: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      // Count imported (externally invoiced) entries per company
      db.timeEntry.groupBy({
        by: ["companyId"],
        where: { externallyInvoiced: true },
        _count: { id: true },
      }),
      // Get latest import date per company
      db.auditLog.findMany({
        where: { action: "IMPORT" },
        orderBy: { createdAt: "desc" },
        distinct: ["companyId"],
        select: { companyId: true, createdAt: true },
      }),
    ]);

    const importedCountMap: Record<string, number> = {};
    importedCounts.forEach((row) => {
      importedCountMap[row.companyId] = row._count.id;
    });

    const lastImportMap: Record<string, string> = {};
    latestImports.forEach((row) => {
      lastImportMap[row.companyId] = row.createdAt.toISOString();
    });

    return NextResponse.json(
      companies.map((c) => ({
        id: c.id,
        name: c.name,
        currency: c.currency,
        createdAt: c.createdAt,
        userCount: c._count.users,
        entryCount: c._count.timeEntries,
        importedEntryCount: importedCountMap[c.id] || 0,
        lastImportDate: lastImportMap[c.id] || null,
        accountingSystem: c.accountingSystem || null,
      }))
    );
  } catch (error) {
    console.error("[SUPER_ADMIN_COMPANIES]", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
