import { NextResponse } from "next/server";
import { getAuthUser, isAdminOrManager } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-error";
import { parseEconomicFile } from "@/lib/economic-import";

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdminOrManager(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const limited = checkRateLimit(`import:${user.companyId}`, {
      windowMs: 60000,
      maxRequests: 5,
    });
    if (limited) return limited;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const mappingsRaw = formData.get("mappings") as string | null;
    const settingsRaw = formData.get("projectSettings") as string | null;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }
    if (!mappingsRaw || !settingsRaw) {
      return NextResponse.json(
        { error: "Mappings and project settings are required" },
        { status: 400 }
      );
    }

    let mappings: {
      employees: Record<string, string>;
      categories: Record<string, string>;
    };
    let projectSettings: {
      name: string;
      client?: string;
      color?: string;
      budgetHours?: number;
      existingProjectId?: string;
    };

    try {
      mappings = JSON.parse(mappingsRaw);
      projectSettings = JSON.parse(settingsRaw);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in mappings or settings" },
        { status: 400 }
      );
    }

    if (!projectSettings.name?.trim()) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 }
      );
    }

    // Parse the Excel file
    const buffer = await file.arrayBuffer();
    let importData;
    try {
      importData = parseEconomicFile(buffer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to parse file";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // Validate mapped user IDs belong to this company
    const mappedUserIds = Object.values(mappings.employees).filter(Boolean);
    if (mappedUserIds.length === 0) {
      return NextResponse.json(
        { error: "At least one employee must be mapped" },
        { status: 400 }
      );
    }

    const companyUsers = await db.user.findMany({
      where: { companyId: user.companyId, id: { in: mappedUserIds }, deletedAt: null },
      select: { id: true },
    });
    const validUserIds = new Set(companyUsers.map((u) => u.id));

    for (const userId of mappedUserIds) {
      if (!validUserIds.has(userId)) {
        return NextResponse.json(
          { error: `User ${userId} not found in company` },
          { status: 400 }
        );
      }
    }

    // Validate existing project if specified
    if (projectSettings.existingProjectId) {
      const existing = await db.project.findFirst({
        where: {
          id: projectSettings.existingProjectId,
          companyId: user.companyId,
        },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Existing project not found" },
          { status: 404 }
        );
      }
    }

    // Validate phase mappings if provided
    const categoryPhaseMap = new Map<number, { id: string; name: string; color: string }>();
    if (mappings.categories && Object.keys(mappings.categories).length > 0) {
      const phaseIds = Object.values(mappings.categories).filter(Boolean);
      if (phaseIds.length > 0) {
        const phases = await db.phase.findMany({
          where: { companyId: user.companyId, id: { in: phaseIds } },
          select: { id: true, name: true, color: true },
        });
        const phaseMap = new Map(phases.map((p) => [p.id, { name: p.name, color: p.color }]));
        for (const [catNum, phaseId] of Object.entries(mappings.categories)) {
          if (phaseId && phaseMap.has(phaseId)) {
            const phaseData = phaseMap.get(phaseId)!;
            categoryPhaseMap.set(Number(catNum), {
              id: phaseId,
              name: phaseData.name,
              color: phaseData.color,
            });
          }
        }
      }
    }

    // Build the employee name → userId map
    const employeeMap = new Map<string, string>();
    for (const [name, userId] of Object.entries(mappings.employees)) {
      if (userId) employeeMap.set(name, userId);
    }

    // Filter entries to only those with mapped employees
    const entriesToImport = importData.timeEntries.filter((e) =>
      employeeMap.has(e.employeeName)
    );

    const now = new Date();

    // Execute import in a transaction
    const result = await db.$transaction(async (tx) => {
      // Create or use existing project
      let projectId: string;
      if (projectSettings.existingProjectId) {
        projectId = projectSettings.existingProjectId;
      } else {
        const project = await tx.project.create({
          data: {
            name: projectSettings.name,
            client: projectSettings.client || null,
            color: projectSettings.color || "#3B82F6",
            budgetHours: projectSettings.budgetHours || null,
            billable: true,
            companyId: user.companyId,
          },
        });
        projectId = project.id;
      }

      // Build userId → total imported hours map
      const userHoursMap = new Map<string, number>();
      for (const entry of entriesToImport) {
        const uid = employeeMap.get(entry.employeeName);
        if (uid) {
          userHoursMap.set(uid, (userHoursMap.get(uid) || 0) + entry.hours);
        }
      }

      // Upsert allocations for mapped employees (replace hours, not add)
      const uniqueMappedUserIds = Array.from(new Set(mappedUserIds));
      for (const userId of uniqueMappedUserIds) {
        const employeeHours = userHoursMap.get(userId) || 0;
        await tx.projectAllocation.upsert({
          where: { projectId_userId: { projectId, userId } },
          update: { hours: employeeHours },
          create: {
            projectId,
            userId,
            hours: employeeHours,
            companyId: user.companyId,
          },
        });
      }

      // Delete existing entries for mapped employees on this project
      await tx.timeEntry.deleteMany({
        where: {
          projectId,
          companyId: user.companyId,
          userId: { in: uniqueMappedUserIds },
        },
      });

      // Create time entries in bulk
      if (entriesToImport.length > 0) {
        await tx.timeEntry.createMany({
          data: entriesToImport.map((entry) => {
            const userId = employeeMap.get(entry.employeeName)!;
            const phase = categoryPhaseMap.get(entry.categoryNumber);
            return {
              date: new Date(entry.date),
              hours: entry.hours,
              comment: entry.description || null,
              userId,
              projectId,
              companyId: user.companyId,
              approvalStatus: "approved",
              submittedAt: now,
              submittedBy: user.id,
              approvedAt: now,
              approvedBy: user.id,
              billingStatus: "billable",
              externallyInvoiced: true,
              phaseId: phase?.id || null,
              phaseName: phase?.name || null,
            };
          }),
        });
      }

      // Auto-create timeline activities from phase-mapped categories
      let activitiesCreated = 0;
      if (categoryPhaseMap.size > 0) {
        // Delete previously imported activities on re-import
        await tx.projectActivity.deleteMany({
          where: {
            projectId,
            companyId: user.companyId,
            note: { startsWith: "Imported from e-conomic" },
          },
        });

        // Compute per-category date ranges from imported entries
        const categoryDateRanges: Record<string, {
          minDate: string;
          maxDate: string;
          categoryName: string;
          entryCount: number;
          totalHours: number;
        }> = {};

        entriesToImport.forEach((entry) => {
          const key = String(entry.categoryNumber);
          if (!categoryDateRanges[key]) {
            categoryDateRanges[key] = {
              minDate: entry.date,
              maxDate: entry.date,
              categoryName: entry.categoryName,
              entryCount: 0,
              totalHours: 0,
            };
          }
          const range = categoryDateRanges[key];
          if (entry.date < range.minDate) range.minDate = entry.date;
          if (entry.date > range.maxDate) range.maxDate = entry.date;
          range.entryCount += 1;
          range.totalHours += entry.hours;
        });

        // Create ProjectActivity for each category mapped to a phase
        const categoryKeys = Object.keys(categoryDateRanges);
        for (let i = 0; i < categoryKeys.length; i++) {
          const catNum = Number(categoryKeys[i]);
          const phase = categoryPhaseMap.get(catNum);
          if (!phase) continue;

          const range = categoryDateRanges[categoryKeys[i]];
          const endDate = new Date(range.maxDate + "T00:00:00");
          const status = endDate < now ? "complete" : "in_progress";

          await tx.projectActivity.create({
            data: {
              projectId,
              companyId: user.companyId,
              name: range.categoryName,
              phaseId: phase.id,
              categoryName: range.categoryName,
              startDate: new Date(range.minDate + "T00:00:00"),
              endDate,
              status,
              color: phase.color,
              note: `Imported from e-conomic: ${range.entryCount} entries, ${range.totalHours.toFixed(1)} hours`,
              sortOrder: activitiesCreated,
            },
          });
          activitiesCreated++;
        }
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          companyId: user.companyId,
          entityType: "PROJECT",
          entityId: projectId,
          action: "IMPORT",
          actorId: user.id,
          metadata: JSON.stringify({
            source: "e-conomic",
            projectNumber: importData.projectNumber,
            entriesImported: entriesToImport.length,
            employeesMapped: uniqueMappedUserIds.length,
            totalHours: entriesToImport.reduce((s, e) => s + e.hours, 0),
            categoriesMapped: categoryPhaseMap.size,
            activitiesCreated,
          }),
        },
      });

      // Return project data
      const project = await tx.project.findUnique({
        where: { id: projectId },
        select: { id: true, name: true, client: true, color: true },
      });

      return { project, activitiesCreated };
    });

    return NextResponse.json({
      project: result.project,
      stats: {
        entries: entriesToImport.length,
        employees: Array.from(new Set(mappedUserIds)).length,
        hours: entriesToImport.reduce((s, e) => s + e.hours, 0),
        activitiesCreated: result.activitiesCreated,
      },
    });
  } catch (error) {
    return apiError(error, { label: "PROJECT_IMPORT" });
  }
}
