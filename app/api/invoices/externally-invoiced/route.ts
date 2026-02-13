import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, isAdminOrManager } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminOrManager(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const company = await db.company.findUnique({
      where: { id: user.companyId },
      select: { accountingSystem: true, defaultHourlyRate: true },
    });

    // Get all externally invoiced entries grouped by project
    const projects = await db.project.findMany({
      where: {
        companyId: user.companyId,
        timeEntries: {
          some: { externallyInvoiced: true },
        },
      },
      select: {
        id: true,
        name: true,
        client: true,
        color: true,
        rateMode: true,
        projectRate: true,
      },
    });

    const results = [];

    for (const project of projects) {
      const entries = await db.timeEntry.findMany({
        where: {
          projectId: project.id,
          companyId: user.companyId,
          externallyInvoiced: true,
        },
        select: {
          id: true,
          hours: true,
          userId: true,
          user: { select: { hourlyRate: true } },
        },
      });

      if (entries.length === 0) continue;

      const totalHours = entries.reduce((s, e) => s + e.hours, 0);

      let totalAmount = 0;
      if (project.rateMode === "EMPLOYEE_RATES") {
        totalAmount = entries.reduce((s, e) => s + e.hours * (e.user.hourlyRate || 0), 0);
      } else if (project.rateMode === "PROJECT_RATE" && project.projectRate) {
        totalAmount = totalHours * project.projectRate;
      } else {
        totalAmount = totalHours * (company?.defaultHourlyRate || 0);
      }

      const uniqueEmployees = new Set(entries.map((e) => e.userId));

      results.push({
        projectId: project.id,
        projectName: project.name,
        client: project.client || "",
        color: project.color,
        totalHours: Math.round(totalHours * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100,
        employeeCount: uniqueEmployees.size,
        entryCount: entries.length,
      });
    }

    return NextResponse.json({
      projects: results,
      accountingSystem: company?.accountingSystem || null,
    });
  } catch (error) {
    console.error("[EXTERNALLY_INVOICED_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
