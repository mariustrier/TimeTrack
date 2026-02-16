import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError } from "@/lib/api-error";

export async function POST() {
  try {
    await requireSuperAdmin();

    // Find all projects that have imported entries with phase mappings
    // but don't yet have import-generated activities
    const importedEntries = await db.timeEntry.findMany({
      where: {
        externallyInvoiced: true,
        phaseId: { not: null },
      },
      select: {
        projectId: true,
        companyId: true,
        phaseId: true,
        phaseName: true,
        date: true,
        hours: true,
      },
    });

    if (importedEntries.length === 0) {
      return NextResponse.json({ projectsProcessed: 0, activitiesCreated: 0 });
    }

    // Group entries by projectId → phaseId → date ranges
    const projectPhaseData: Record<string, {
      companyId: string;
      phases: Record<string, {
        phaseName: string;
        minDate: string;
        maxDate: string;
        entryCount: number;
        totalHours: number;
      }>;
    }> = {};

    importedEntries.forEach((entry) => {
      if (!entry.phaseId) return;
      const dateStr = entry.date.toISOString().slice(0, 10);

      if (!projectPhaseData[entry.projectId]) {
        projectPhaseData[entry.projectId] = {
          companyId: entry.companyId,
          phases: {},
        };
      }

      const proj = projectPhaseData[entry.projectId];
      if (!proj.phases[entry.phaseId]) {
        proj.phases[entry.phaseId] = {
          phaseName: entry.phaseName || "Unknown",
          minDate: dateStr,
          maxDate: dateStr,
          entryCount: 0,
          totalHours: 0,
        };
      }

      const phase = proj.phases[entry.phaseId];
      if (dateStr < phase.minDate) phase.minDate = dateStr;
      if (dateStr > phase.maxDate) phase.maxDate = dateStr;
      phase.entryCount += 1;
      phase.totalHours += entry.hours;
    });

    // Check which projects already have import-generated activities
    const projectIds = Object.keys(projectPhaseData);
    const existingActivities = await db.projectActivity.findMany({
      where: {
        projectId: { in: projectIds },
        note: { startsWith: "Imported from e-conomic" },
      },
      select: { projectId: true },
    });

    const projectsWithActivities = new Set(existingActivities.map((a) => a.projectId));

    // Fetch phase colors
    const allPhaseIds = new Set<string>();
    projectIds.forEach((pid) => {
      Object.keys(projectPhaseData[pid].phases).forEach((phaseId) => {
        allPhaseIds.add(phaseId);
      });
    });

    const phases = await db.phase.findMany({
      where: { id: { in: Array.from(allPhaseIds) } },
      select: { id: true, color: true },
    });
    const phaseColorMap: Record<string, string> = {};
    phases.forEach((p) => {
      phaseColorMap[p.id] = p.color;
    });

    // Create activities for projects that don't have them yet
    const now = new Date();
    let totalActivitiesCreated = 0;
    let projectsProcessed = 0;

    for (let i = 0; i < projectIds.length; i++) {
      const projectId = projectIds[i];
      if (projectsWithActivities.has(projectId)) continue;

      const proj = projectPhaseData[projectId];
      const phaseKeys = Object.keys(proj.phases);
      let sortOrder = 0;

      for (let j = 0; j < phaseKeys.length; j++) {
        const phaseId = phaseKeys[j];
        const data = proj.phases[phaseId];
        const endDate = new Date(data.maxDate + "T00:00:00");
        const status = endDate < now ? "complete" : "in_progress";

        await db.projectActivity.create({
          data: {
            projectId,
            companyId: proj.companyId,
            name: data.phaseName,
            phaseId,
            categoryName: data.phaseName,
            startDate: new Date(data.minDate + "T00:00:00"),
            endDate,
            status,
            color: phaseColorMap[phaseId] || "#3B82F6",
            note: `Imported from e-conomic: ${data.entryCount} entries, ${data.totalHours.toFixed(1)} hours`,
            sortOrder,
          },
        });
        sortOrder++;
        totalActivitiesCreated++;
      }
      projectsProcessed++;
    }

    return NextResponse.json({
      projectsProcessed,
      activitiesCreated: totalActivitiesCreated,
    });
  } catch (error) {
    return apiError(error, { label: "SUPER_ADMIN_BACKFILL_ACTIVITIES" });
  }
}
