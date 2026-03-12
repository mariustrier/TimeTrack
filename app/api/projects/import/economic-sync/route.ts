import { NextResponse } from "next/server";
import { requireManager } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { validate } from "@/lib/validate";
import { economicSyncConfirmSchema } from "@/lib/schemas";
import { db } from "@/lib/db";
import { apiError } from "@/lib/api-error";
import { Prisma } from "@prisma/client";
import { parseProjektkort } from "@/lib/economic-projektkort-parser";
import { parseOmsaetningsstatistik } from "@/lib/economic-omsaetning-parser";
import { matchEmployees, matchTilbudCategories, matchInvoiceCategories } from "@/lib/economic-matching";

/** POST — Parse uploaded files and return extracted data with auto-suggested mappings */
export async function POST(req: Request) {
  try {
    const user = await requireManager();

    const rateLimitResponse = checkRateLimit(
      `economic-sync:${user.companyId}`,
      { windowMs: 60_000, maxRequests: 5 }
    );
    if (rateLimitResponse) return rateLimitResponse;

    const formData = await req.formData();
    const projektkortFile = formData.get("projektkort") as File | null;
    const omsaetningFile = formData.get("omsaetning") as File | null;
    const projectId = formData.get("projectId") as string | null;

    if (!projektkortFile) {
      return NextResponse.json(
        { error: "Projektkort file is required" },
        { status: 400 }
      );
    }

    // Parse Projektkort
    const projektkortBuffer = await projektkortFile.arrayBuffer();
    const projektkortData = parseProjektkort(projektkortBuffer);

    // Parse Omsætningsstatistik if provided
    let omsaetningData = null;
    if (omsaetningFile) {
      const omsaetningBuffer = await omsaetningFile.arrayBuffer();
      omsaetningData = parseOmsaetningsstatistik(omsaetningBuffer);
    }

    // Fetch team members for employee matching
    const team = await db.user.findMany({
      where: { companyId: user.companyId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    // Get unique employee names from projektkort
    const economicNames = Array.from(
      new Set(
        projektkortData.activities.flatMap((a) =>
          a.entries.map((e) => e.employeeName)
        )
      )
    ).filter(Boolean);

    // Auto-match employees
    const employeeMappings = matchEmployees(economicNames, team);

    // Build suggested mappings response
    const suggestedMappings: {
      employees: { economicName: string; suggestedUserId: string | null }[];
      tilbudCategories?: { activityNumber: number; suggestedCategoryId: string | null }[];
      invoiceCategories?: { categoryNumber: number; suggestedActivityNumber: number | null }[];
    } = {
      employees: economicNames.map((name) => ({
        economicName: name,
        suggestedUserId: employeeMappings[name] || null,
      })),
    };

    // If omsaetning data, suggest invoice category mappings
    if (omsaetningData) {
      const activityInfos = projektkortData.activities.map((a) => ({
        number: a.number,
        name: a.name,
      }));
      const catInfos = omsaetningData.categories.map((c) => ({
        number: c.number,
        name: c.name,
      }));
      const invoiceMappings = matchInvoiceCategories(catInfos, activityInfos);

      suggestedMappings.invoiceCategories = omsaetningData.categories.map((cat) => ({
        categoryNumber: cat.number,
        suggestedActivityNumber: invoiceMappings[cat.number] ?? null,
      }));
    }

    return NextResponse.json({
      projektkortData,
      omsaetningData,
      suggestedMappings,
      team: team.map((t) => ({
        id: t.id,
        firstName: t.firstName,
        lastName: t.lastName,
        email: t.email,
      })),
    });
  } catch (error) {
    return apiError(error, { label: "ECONOMIC_SYNC_POST" });
  }
}

/** PUT — Confirm import and create time entries */
export async function PUT(req: Request) {
  try {
    const user = await requireManager();

    const body = await req.json();
    const result = validate(economicSyncConfirmSchema, body);
    if (!result.success) return result.response;

    const data = result.data;

    const importResult = await db.$transaction(async (tx) => {
      // 1. Create or find project
      let projectId = data.projectId;

      if (!projectId && data.newProject) {
        const project = await tx.project.create({
          data: {
            name: data.newProject.name,
            client: data.newProject.clientName || null,
            color: data.newProject.color || "#3B82F6",
            budgetHours: data.newProject.budgetHours || null,
            companyId: user.companyId,
          },
        });
        projectId = project.id;
      }

      if (!projectId) {
        throw new Error("Either projectId or newProject must be provided");
      }

      // Verify project belongs to company
      const project = await tx.project.findFirst({
        where: { id: projectId, companyId: user.companyId },
      });
      if (!project) {
        throw new Error("Project not found");
      }

      // 2. Delete existing imported entries for mapped employees (re-import safe)
      const mappedUserIds = Object.values(data.employeeMappings).filter(Boolean);
      if (mappedUserIds.length > 0) {
        await tx.timeEntry.deleteMany({
          where: {
            projectId,
            companyId: user.companyId,
            userId: { in: mappedUserIds },
            importSource: "economic",
          },
        });
      }

      // 3. Compute stats
      let totalBillableHours = 0;
      let totalNonBillableHours = 0;
      let totalInvoicedHours = 0;
      let totalInvoicedAmount = 0;
      let createdEntries = 0;

      // Build invoice mapping: activityNumber → invoiced hours
      const invoicedHoursPerActivity: Record<number, number> = {};
      if (data.omsaetningData && data.invoiceMappings) {
        const omsaetning = data.omsaetningData;
        Object.entries(data.invoiceMappings).forEach(([catNumStr, actNum]) => {
          if (actNum == null) return;
          const catNum = parseInt(catNumStr);
          const cat = omsaetning.categories?.find(
            (c: { number: number }) => c.number === catNum
          );
          if (cat) {
            invoicedHoursPerActivity[actNum] =
              (invoicedHoursPerActivity[actNum] || 0) + (cat.subtotal?.hours || 0);
            totalInvoicedAmount += cat.subtotal?.revenue || 0;
          }
        });
      }

      // 4. Create time entries per activity
      const projektkort = data.projektkortData;
      const entriesToCreate: Prisma.TimeEntryCreateManyInput[] = [];

      (projektkort.activities || []).forEach(
        (activity: {
          number: number;
          name: string;
          entries: {
            date: string;
            bilag: string;
            employeeName: string;
            description: string;
            hours: number;
            kostpris: number;
            salgspris: number;
            isBillable: boolean;
          }[];
        }) => {
          const actNumStr = String(activity.number);
          const classification = data.activityClassifications[actNumStr];
          if (!classification) return;

          const tilbudCategoryId = classification.tilbudCategoryId || null;
          let invoicedHoursRemaining = invoicedHoursPerActivity[activity.number] || 0;

          activity.entries.forEach((entry) => {
            const userId = data.employeeMappings[entry.employeeName];
            if (!userId) return; // Skip unmapped employees

            // Determine billing status
            let billingStatus: string;
            if (classification.billingStatus === "nonBillable") {
              billingStatus = "non_billable";
            } else if (classification.billingStatus === "billable") {
              billingStatus = "billable";
            } else {
              // Mixed: use per-entry salgspris
              billingStatus = entry.salgspris > 0 ? "billable" : "non_billable";
            }

            // Track hours
            if (billingStatus === "billable") {
              totalBillableHours += entry.hours;
            } else {
              totalNonBillableHours += entry.hours;
            }

            // Mark as externally invoiced if within invoiced hours budget
            let externallyInvoiced = false;
            if (
              billingStatus === "billable" &&
              invoicedHoursRemaining > 0
            ) {
              externallyInvoiced = true;
              invoicedHoursRemaining -= entry.hours;
              totalInvoicedHours += entry.hours;
            }

            entriesToCreate.push({
              hours: entry.hours,
              date: new Date(entry.date),
              comment: entry.description || null,
              userId,
              projectId: projectId!,
              companyId: user.companyId,
              approvalStatus: "approved",
              billingStatus,
              importSource: "economic",
              externallyInvoiced,
              invoicedAt: externallyInvoiced ? new Date() : null,
              tilbudCategoryId,
              economicActivityNumber: activity.number,
              economicActivityName: activity.name,
              economicSalgspris: entry.salgspris,
              economicKostpris: entry.kostpris,
              economicBilag: entry.bilag || null,
            });

            createdEntries++;
          });
        }
      );

      // Batch create entries
      if (entriesToCreate.length > 0) {
        await tx.timeEntry.createMany({ data: entriesToCreate });
      }

      // 5. Create ImportBatch record
      const totalRegisteredHours = totalBillableHours + totalNonBillableHours;

      const importBatch = await tx.importBatch.create({
        data: {
          companyId: user.companyId,
          importedBy: user.id,
          source: "economic_sync",
          fileName: projektkort.projectName || "e-conomic sync import",
          status: "completed",
          projectCount: 1,
          memberCount: mappedUserIds.length,
          timeEntryCount: createdEntries,
          absenceCount: 0,
          totalHours: totalRegisteredHours,
          stats: {
            projectId,
            createdEntries,
            totalBillableHours,
            totalNonBillableHours,
            totalInvoicedHours,
            totalInvoicedAmount,
          },
          omsaetningData: data.omsaetningData || undefined,
          activityClassifications: data.activityClassifications,
          tilbudMappings: data.categoryMappings || undefined,
          invoiceMappings: data.invoiceMappings || undefined,
          totalRegisteredHours,
          totalBillableHours,
          totalNonBillableHours,
          totalInvoicedHours,
          totalInvoicedAmount,
        },
      });

      // Update created entries with importBatchId
      if (entriesToCreate.length > 0) {
        await tx.timeEntry.updateMany({
          where: {
            projectId: projectId!,
            companyId: user.companyId,
            importSource: "economic",
            importBatchId: null,
          },
          data: { importBatchId: importBatch.id },
        });
      }

      // 6. Upsert project allocations for mapped employees
      const allocationPromises = mappedUserIds.map((userId) =>
        tx.projectAllocation.upsert({
          where: {
            projectId_userId: { projectId: projectId!, userId },
          },
          create: {
            projectId: projectId!,
            userId,
            companyId: user.companyId,
            hours: 0,
          },
          update: {},
        })
      );
      await Promise.all(allocationPromises);

      // 7. Audit log
      await tx.auditLog.create({
        data: {
          companyId: user.companyId,
          entityType: "ImportBatch",
          entityId: importBatch.id,
          action: "ECONOMIC_PROJECT_SYNC",
          actorId: user.id,
          metadata: JSON.stringify({
            projectId,
            createdEntries,
            totalBillableHours,
            totalNonBillableHours,
            totalInvoicedHours,
          }),
        },
      });

      return {
        importBatch,
        stats: {
          createdEntries,
          billableHours: totalBillableHours,
          nonBillableHours: totalNonBillableHours,
          invoicedHours: totalInvoicedHours,
          invoicedAmount: totalInvoicedAmount,
        },
      };
    });

    return NextResponse.json(importResult);
  } catch (error) {
    return apiError(error, { label: "ECONOMIC_SYNC_PUT" });
  }
}
