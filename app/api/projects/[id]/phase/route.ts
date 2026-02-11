import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, isAdminOrManager } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { phaseWorkflowSchema } from "@/lib/schemas";

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdminOrManager(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const project = await db.project.findFirst({
      where: { id: params.id, companyId: user.companyId },
      include: { currentPhase: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!project.phasesEnabled) {
      return NextResponse.json({ error: "Phases not enabled for this project" }, { status: 400 });
    }

    const body = await req.json();
    const result = validate(phaseWorkflowSchema, body);
    if (!result.success) return result.response;
    const { action, phaseId } = result.data;

    const allPhases = await db.phase.findMany({
      where: { companyId: user.companyId, active: true },
      orderBy: { sortOrder: "asc" },
    });

    if (action === "complete") {
      if (!project.currentPhaseId) {
        return NextResponse.json({ error: "No current phase to complete" }, { status: 400 });
      }

      const currentIdx = allPhases.findIndex((p) => p.id === project.currentPhaseId);
      const nextPhase = currentIdx >= 0 && currentIdx < allPhases.length - 1
        ? allPhases[currentIdx + 1]
        : null;

      const updated = await db.project.update({
        where: { id: params.id },
        data: nextPhase
          ? { currentPhaseId: nextPhase.id }
          : { phaseCompleted: true, phaseCompletedAt: new Date() },
        include: { currentPhase: { select: { id: true, name: true, sortOrder: true, color: true } } },
      });

      await db.auditLog.create({
        data: {
          companyId: user.companyId,
          entityType: "Project",
          entityId: params.id,
          action: "PHASE_CHANGE",
          fromStatus: project.currentPhase?.name || null,
          toStatus: nextPhase?.name || "Completed",
          actorId: user.id,
          metadata: JSON.stringify({
            projectName: project.name,
            fromPhaseId: project.currentPhaseId,
            toPhaseId: nextPhase?.id || null,
            autoAdvance: true,
          }),
        },
      });

      return NextResponse.json(updated);
    }

    if (action === "setPhase") {
      if (!phaseId) {
        return NextResponse.json({ error: "phaseId required for setPhase" }, { status: 400 });
      }

      const targetPhase = allPhases.find((p) => p.id === phaseId);
      if (!targetPhase) {
        return NextResponse.json({ error: "Phase not found" }, { status: 404 });
      }

      const updated = await db.project.update({
        where: { id: params.id },
        data: {
          currentPhaseId: phaseId,
          phaseCompleted: false,
          phaseCompletedAt: null,
        },
        include: { currentPhase: { select: { id: true, name: true, sortOrder: true, color: true } } },
      });

      await db.auditLog.create({
        data: {
          companyId: user.companyId,
          entityType: "Project",
          entityId: params.id,
          action: "PHASE_CHANGE",
          fromStatus: project.currentPhase?.name || (project.phaseCompleted ? "Completed" : null),
          toStatus: targetPhase.name,
          actorId: user.id,
          metadata: JSON.stringify({
            projectName: project.name,
            fromPhaseId: project.currentPhaseId,
            toPhaseId: phaseId,
            autoAdvance: false,
          }),
        },
      });

      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[PROJECT_PHASE_PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
