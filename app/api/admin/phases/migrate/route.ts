import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { phaseMigrationSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const result = validate(phaseMigrationSchema, body);
    if (!result.success) return result.response;
    const { assignments, backfillRanges } = result.data;

    // Validate all referenced phases belong to this company
    const phaseIds = [
      ...assignments.filter((a) => a.phaseId).map((a) => a.phaseId!),
      ...(backfillRanges || []).map((r) => r.phaseId),
    ];
    if (phaseIds.length > 0) {
      const validPhases = await db.phase.findMany({
        where: { id: { in: phaseIds }, companyId: user.companyId },
        select: { id: true, name: true },
      });
      const validIds = new Set(validPhases.map((p) => p.id));
      const invalid = phaseIds.find((id) => !validIds.has(id));
      if (invalid) {
        return NextResponse.json({ error: "Invalid phase ID" }, { status: 400 });
      }
    }

    // Apply project assignments
    for (const assignment of assignments) {
      const project = await db.project.findFirst({
        where: { id: assignment.projectId, companyId: user.companyId },
      });
      if (!project || project.systemManaged) continue;

      if (assignment.phaseId) {
        await db.project.update({
          where: { id: assignment.projectId },
          data: {
            phasesEnabled: true,
            currentPhaseId: assignment.phaseId,
            phaseCompleted: false,
            phaseCompletedAt: null,
          },
        });
      } else {
        await db.project.update({
          where: { id: assignment.projectId },
          data: {
            phasesEnabled: false,
            currentPhaseId: null,
            phaseCompleted: false,
            phaseCompletedAt: null,
          },
        });
      }
    }

    // Apply backfill ranges
    if (backfillRanges && backfillRanges.length > 0) {
      // Validate no overlapping ranges for same project
      const rangesByProject: Record<string, typeof backfillRanges> = {};
      for (const range of backfillRanges) {
        if (!rangesByProject[range.projectId]) rangesByProject[range.projectId] = [];
        rangesByProject[range.projectId].push(range);
      }

      for (const [, ranges] of Object.entries(rangesByProject)) {
        const sorted = ranges.sort((a, b) => a.from.localeCompare(b.from));
        for (let i = 1; i < sorted.length; i++) {
          if (sorted[i].from < sorted[i - 1].to) {
            return NextResponse.json({ error: "Overlapping date ranges" }, { status: 400 });
          }
        }
      }

      // Get phase names for backfill
      const phaseMap = new Map<string, string>();
      if (phaseIds.length > 0) {
        const phases = await db.phase.findMany({
          where: { id: { in: phaseIds }, companyId: user.companyId },
          select: { id: true, name: true },
        });
        phases.forEach((p) => phaseMap.set(p.id, p.name));
      }

      let totalUpdated = 0;
      for (const range of backfillRanges) {
        const updated = await db.timeEntry.updateMany({
          where: {
            projectId: range.projectId,
            companyId: user.companyId,
            date: {
              gte: new Date(range.from),
              lte: new Date(range.to),
            },
          },
          data: {
            phaseId: range.phaseId,
            phaseName: phaseMap.get(range.phaseId) || null,
          },
        });
        totalUpdated += updated.count;
      }

      // Audit log for backfill
      if (totalUpdated > 0) {
        await db.auditLog.create({
          data: {
            companyId: user.companyId,
            entityType: "Project",
            entityId: "bulk",
            action: "PHASE_BACKFILL",
            actorId: user.id,
            metadata: JSON.stringify({
              rangeCount: backfillRanges.length,
              entriesUpdated: totalUpdated,
            }),
          },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PHASES_MIGRATE_POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
