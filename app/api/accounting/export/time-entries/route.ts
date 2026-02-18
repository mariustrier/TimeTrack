import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, isAdminOrManager } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminOrManager(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const entries = await db.timeEntry.findMany({
      where: {
        companyId: user.companyId,
        approvalStatus: "approved",
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        project: { select: { name: true, client: true } },
      },
      orderBy: { date: "asc" },
    });

    // Build CSV
    const headers = [
      "Date",
      "Employee",
      "Email",
      "Project",
      "Client",
      "Hours",
      "Description",
      "Billing Status",
      "Phase",
      "Synced",
    ];

    const rows = entries.map((e) => [
      e.date.toISOString().split("T")[0],
      `${e.user.firstName || ""} ${e.user.lastName || ""}`.trim(),
      e.user.email,
      e.project.name,
      e.project.client || "",
      e.hours.toString(),
      (e.comment || "").replace(/"/g, '""'),
      e.billingStatus,
      e.phaseName || "",
      e.accountingSyncedAt ? "Yes" : "No",
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    // Log the export
    const company = await db.company.findUnique({
      where: { id: user.companyId },
      select: { accountingSystem: true },
    });

    await db.syncLog.create({
      data: {
        companyId: user.companyId,
        syncType: "time_entries",
        direction: "export",
        system: company?.accountingSystem || "csv",
        status: "success",
        itemCount: entries.length,
        triggeredBy: user.id,
        completedAt: new Date(),
      },
    });

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="time-entries-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("[EXPORT_TIME_ENTRIES]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
