import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { updatePhaseSchema } from "@/lib/schemas";

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAdmin();

    const phase = await db.phase.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });

    if (!phase) {
      return NextResponse.json({ error: "Phase not found" }, { status: 404 });
    }

    const body = await req.json();
    const result = validate(updatePhaseSchema, body);
    if (!result.success) return result.response;
    const { name, active, applyGlobally } = result.data;

    // If updating name, check for duplicates
    if (name && name.trim() !== phase.name) {
      const existing = await db.phase.findUnique({
        where: {
          companyId_name: {
            companyId: user.companyId,
            name: name.trim(),
          },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "A phase with this name already exists" },
          { status: 400 }
        );
      }
    }

    const updated = await db.phase.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(active !== undefined && { active }),
      },
    });

    // If rename + applyGlobally, update all existing time entries
    if (name && name.trim() !== phase.name && applyGlobally) {
      const updateResult = await db.timeEntry.updateMany({
        where: { phaseId: params.id, companyId: user.companyId },
        data: { phaseName: name.trim() },
      });

      // Audit log for global rename
      await db.auditLog.create({
        data: {
          companyId: user.companyId,
          entityType: "Phase",
          entityId: params.id,
          action: "RENAME_GLOBAL",
          fromStatus: phase.name,
          toStatus: name.trim(),
          actorId: user.id,
          metadata: JSON.stringify({
            affectedEntryCount: updateResult.count,
          }),
        },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[ADMIN_PHASE_PUT]", error);

    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message === "Forbidden") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAdmin();

    const phase = await db.phase.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });

    if (!phase) {
      return NextResponse.json({ error: "Phase not found" }, { status: 404 });
    }

    // Check if phase is currentPhaseId on any project
    const projectsUsingPhase = await db.project.count({
      where: { currentPhaseId: params.id, companyId: user.companyId },
    });

    if (projectsUsingPhase > 0) {
      // Unset currentPhaseId on those projects
      await db.project.updateMany({
        where: { currentPhaseId: params.id, companyId: user.companyId },
        data: { currentPhaseId: null },
      });
    }

    // Check if phase has time entries
    const entryCount = await db.timeEntry.count({
      where: { phaseId: params.id },
    });

    if (entryCount > 0) {
      // Soft delete
      await db.phase.update({
        where: { id: params.id },
        data: { active: false },
      });

      await db.auditLog.create({
        data: {
          companyId: user.companyId,
          entityType: "Phase",
          entityId: params.id,
          action: "PHASE_DELETE",
          fromStatus: "active",
          toStatus: "deactivated",
          actorId: user.id,
          metadata: JSON.stringify({
            phaseName: phase.name,
            affectedEntryCount: entryCount,
            affectedProjectCount: projectsUsingPhase,
          }),
        },
      });

      return NextResponse.json({
        success: true,
        softDeleted: true,
        message: "Phase deactivated because it has existing time entries",
      });
    }

    // Hard delete
    await db.phase.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ADMIN_PHASE_DELETE]", error);

    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message === "Forbidden") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
