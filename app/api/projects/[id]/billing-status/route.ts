import { NextResponse } from "next/server";
import { requireManager } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError } from "@/lib/api-error";

/** GET — Billing status breakdown for a project */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireManager();
    const projectId = params.id;

    // Verify project belongs to company
    const project = await db.project.findFirst({
      where: { id: projectId, companyId: user.companyId },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get all time entries with economic activity data for this project
    const entries = await db.timeEntry.findMany({
      where: {
        projectId,
        companyId: user.companyId,
        importSource: "economic",
      },
      select: {
        id: true,
        hours: true,
        billingStatus: true,
        externallyInvoiced: true,
        economicActivityNumber: true,
        economicActivityName: true,
        economicSalgspris: true,
        economicBilag: true,
        tilbudCategoryId: true,
        userId: true,
        date: true,
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (entries.length === 0) {
      return NextResponse.json({
        summary: {
          totalHours: 0,
          billableHours: 0,
          nonBillableHours: 0,
          invoicedHours: 0,
          uninvoicedBillableHours: 0,
          invoicedAmount: 0,
        },
        byActivity: [],
        byEmployee: [],
        recentInvoices: [],
      });
    }

    // Summary
    let totalHours = 0;
    let billableHours = 0;
    let nonBillableHours = 0;
    let invoicedHours = 0;
    let invoicedAmount = 0;

    // By activity
    const activityMap = new Map<
      number,
      {
        activityNumber: number;
        activityName: string;
        totalHours: number;
        billableHours: number;
        nonBillableHours: number;
        invoicedHours: number;
        invoicedAmount: number;
        tilbudCategoryId: string | null;
      }
    >();

    // By employee
    const employeeMap = new Map<
      string,
      {
        userId: string;
        name: string;
        totalHours: number;
        billableHours: number;
        nonBillableHours: number;
      }
    >();

    entries.forEach((entry) => {
      totalHours += entry.hours;
      const isBillable = entry.billingStatus === "billable" || entry.billingStatus === "included";

      if (isBillable) {
        billableHours += entry.hours;
        if (entry.externallyInvoiced) {
          invoicedHours += entry.hours;
          invoicedAmount += entry.economicSalgspris || 0;
        }
      } else {
        nonBillableHours += entry.hours;
      }

      // Activity breakdown
      const actNum = entry.economicActivityNumber || 0;
      if (actNum > 0) {
        const existing = activityMap.get(actNum);
        if (existing) {
          existing.totalHours += entry.hours;
          if (isBillable) existing.billableHours += entry.hours;
          else existing.nonBillableHours += entry.hours;
          if (entry.externallyInvoiced) {
            existing.invoicedHours += entry.hours;
            existing.invoicedAmount += entry.economicSalgspris || 0;
          }
        } else {
          activityMap.set(actNum, {
            activityNumber: actNum,
            activityName: entry.economicActivityName || `Activity ${actNum}`,
            totalHours: entry.hours,
            billableHours: isBillable ? entry.hours : 0,
            nonBillableHours: isBillable ? 0 : entry.hours,
            invoicedHours: entry.externallyInvoiced ? entry.hours : 0,
            invoicedAmount: entry.externallyInvoiced ? (entry.economicSalgspris || 0) : 0,
            tilbudCategoryId: entry.tilbudCategoryId,
          });
        }
      }

      // Employee breakdown
      const empEntry = employeeMap.get(entry.userId);
      const empName = `${entry.user.firstName || ""} ${entry.user.lastName || ""}`.trim() || entry.userId;
      if (empEntry) {
        empEntry.totalHours += entry.hours;
        if (isBillable) empEntry.billableHours += entry.hours;
        else empEntry.nonBillableHours += entry.hours;
      } else {
        employeeMap.set(entry.userId, {
          userId: entry.userId,
          name: empName,
          totalHours: entry.hours,
          billableHours: isBillable ? entry.hours : 0,
          nonBillableHours: isBillable ? 0 : entry.hours,
        });
      }
    });

    // Recent invoiced entries (unique bilag numbers)
    const invoicedEntries = entries
      .filter((e) => e.externallyInvoiced && e.economicBilag)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const seenBilag = new Set<string>();
    const recentInvoices: { date: string; bilag: string; amount: number }[] = [];
    invoicedEntries.forEach((entry) => {
      const bilag = entry.economicBilag || "";
      if (!seenBilag.has(bilag)) {
        seenBilag.add(bilag);
        recentInvoices.push({
          date: entry.date.toISOString().slice(0, 10),
          bilag,
          amount: entry.economicSalgspris || 0,
        });
      }
    });

    const uninvoicedBillableHours = billableHours - invoicedHours;

    return NextResponse.json({
      summary: {
        totalHours: parseFloat(totalHours.toFixed(1)),
        billableHours: parseFloat(billableHours.toFixed(1)),
        nonBillableHours: parseFloat(nonBillableHours.toFixed(1)),
        invoicedHours: parseFloat(invoicedHours.toFixed(1)),
        uninvoicedBillableHours: parseFloat(uninvoicedBillableHours.toFixed(1)),
        invoicedAmount: parseFloat(invoicedAmount.toFixed(2)),
      },
      byActivity: Array.from(activityMap.values())
        .sort((a, b) => a.activityNumber - b.activityNumber)
        .map((a) => ({
          ...a,
          totalHours: parseFloat(a.totalHours.toFixed(1)),
          billableHours: parseFloat(a.billableHours.toFixed(1)),
          nonBillableHours: parseFloat(a.nonBillableHours.toFixed(1)),
          invoicedHours: parseFloat(a.invoicedHours.toFixed(1)),
          invoicedAmount: parseFloat(a.invoicedAmount.toFixed(2)),
        })),
      byEmployee: Array.from(employeeMap.values())
        .sort((a, b) => b.totalHours - a.totalHours)
        .map((e) => ({
          ...e,
          totalHours: parseFloat(e.totalHours.toFixed(1)),
          billableHours: parseFloat(e.billableHours.toFixed(1)),
          nonBillableHours: parseFloat(e.nonBillableHours.toFixed(1)),
        })),
      recentInvoices: recentInvoices.slice(0, 10),
    });
  } catch (error) {
    return apiError(error, { label: "BILLING_STATUS_GET" });
  }
}
