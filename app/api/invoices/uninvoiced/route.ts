import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, isAdminOrManager } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminOrManager(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Get all projects with uninvoiced approved billable entries
    const projects = await db.project.findMany({
      where: {
        companyId: user.companyId,
        systemManaged: false,
        billable: true,
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

    const company = await db.company.findUnique({
      where: { id: user.companyId },
      select: { defaultHourlyRate: true },
    });

    const results = [];

    for (const project of projects) {
      const entries = await db.timeEntry.findMany({
        where: {
          projectId: project.id,
          companyId: user.companyId,
          approvalStatus: "approved",
          billingStatus: "billable",
          invoiceId: null,
          externallyInvoiced: { not: true },
        },
        select: {
          id: true,
          hours: true,
          date: true,
          userId: true,
          user: { select: { hourlyRate: true } },
        },
      });

      if (entries.length === 0) {
        // Check for uninvoiced expenses too
        const expCount = await db.expense.count({
          where: {
            projectId: project.id,
            companyId: user.companyId,
            approvalStatus: "approved",
            invoiceId: null,
            isDeleted: { not: true },
          },
        });
        if (expCount === 0) continue;
      }

      const uninvoicedHours = entries.reduce((s, e) => s + e.hours, 0);

      // Calculate amount based on rate mode
      let uninvoicedAmount = 0;
      if (project.rateMode === "EMPLOYEE_RATES") {
        uninvoicedAmount = entries.reduce((s, e) => s + e.hours * (e.user.hourlyRate || 0), 0);
      } else if (project.rateMode === "PROJECT_RATE" && project.projectRate) {
        uninvoicedAmount = uninvoicedHours * project.projectRate;
      } else {
        uninvoicedAmount = uninvoicedHours * (company?.defaultHourlyRate || 0);
      }

      // Uninvoiced expenses
      const expAgg = await db.expense.aggregate({
        where: {
          projectId: project.id,
          companyId: user.companyId,
          approvalStatus: "approved",
          invoiceId: null,
          isDeleted: { not: true },
        },
        _sum: { amount: true },
        _count: true,
      });

      const uniqueEmployees = new Set(entries.map((e) => e.userId));
      const dates = entries.map((e) => new Date(e.date).getTime());

      results.push({
        projectId: project.id,
        projectName: project.name,
        client: project.client || "",
        color: project.color,
        uninvoicedHours: Math.round(uninvoicedHours * 100) / 100,
        uninvoicedAmount: Math.round(uninvoicedAmount * 100) / 100,
        uninvoicedExpenses: Math.round((expAgg._sum.amount || 0) * 100) / 100,
        oldestEntry: dates.length > 0 ? new Date(Math.min(...dates)).toISOString() : null,
        employeeCount: uniqueEmployees.size,
        entryCount: entries.length,
        expenseCount: expAgg._count,
      });
    }

    // Sort by oldest entry (most stale first)
    results.sort((a, b) => {
      if (!a.oldestEntry) return 1;
      if (!b.oldestEntry) return -1;
      return new Date(a.oldestEntry).getTime() - new Date(b.oldestEntry).getTime();
    });

    // Fetch OUTSIDE_CONTRACT entries (tillægsydelser) grouped by project
    const outsideContractResults = [];
    const allProjects = await db.project.findMany({
      where: {
        companyId: user.companyId,
        systemManaged: false,
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

    for (const project of allProjects) {
      const ocEntries = await db.timeEntry.findMany({
        where: {
          projectId: project.id,
          companyId: user.companyId,
          approvalStatus: "approved",
          billingType: "OUTSIDE_CONTRACT" as string,
          invoiceId: null,
          externallyInvoiced: { not: true },
        } as Record<string, unknown>,
        select: {
          id: true,
          hours: true,
          date: true,
          userId: true,
          user: { select: { hourlyRate: true } },
        },
      });

      if (ocEntries.length === 0) continue;

      const ocHours = ocEntries.reduce((s, e) => s + e.hours, 0);
      let ocAmount = 0;
      if (project.rateMode === "EMPLOYEE_RATES") {
        ocAmount = ocEntries.reduce((s, e) => s + e.hours * (e.user.hourlyRate || 0), 0);
      } else if (project.rateMode === "PROJECT_RATE" && project.projectRate) {
        ocAmount = ocHours * project.projectRate;
      } else {
        ocAmount = ocHours * (company?.defaultHourlyRate || 0);
      }

      const uniqueEmployees = new Set(ocEntries.map((e) => e.userId));
      const dates = ocEntries.map((e) => new Date(e.date).getTime());

      outsideContractResults.push({
        projectId: project.id,
        projectName: project.name,
        client: project.client || "",
        color: project.color,
        hours: Math.round(ocHours * 100) / 100,
        amount: Math.round(ocAmount * 100) / 100,
        oldestEntry: dates.length > 0 ? new Date(Math.min(...dates)).toISOString() : null,
        employeeCount: uniqueEmployees.size,
        entryCount: ocEntries.length,
      });
    }

    outsideContractResults.sort((a, b) => {
      if (!a.oldestEntry) return 1;
      if (!b.oldestEntry) return -1;
      return new Date(a.oldestEntry).getTime() - new Date(b.oldestEntry).getTime();
    });

    return NextResponse.json({ projects: results, outsideContractProjects: outsideContractResults });
  } catch (error) {
    console.error("[UNINVOICED_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
