import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { createProjectPhaseSchema, updateProjectPhaseSchema } from "@/lib/schemas";
import { addDays, differenceInDays, format } from "date-fns";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const project = await db.project.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });
    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const projectPhases = await db.projectPhase.findMany({
      where: { projectId: params.id },
      include: {
        phase: { select: { id: true, name: true, color: true, sortOrder: true } },
      },
      orderBy: { phase: { sortOrder: "asc" } },
    });

    return NextResponse.json(projectPhases);
  } catch (error) {
    console.error("[PROJECT_PHASES_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin" && user.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const project = await db.project.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });
    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();

    // Auto-populate mode
    if (body.action === "auto-populate") {
      if (!project.startDate || !project.endDate) {
        return NextResponse.json(
          { error: "Project must have start and end dates to auto-populate phases" },
          { status: 400 }
        );
      }

      // Get active phases for the company
      const phases = await db.phase.findMany({
        where: { companyId: user.companyId, active: true },
        orderBy: { sortOrder: "asc" },
      });

      if (phases.length === 0) {
        return NextResponse.json(
          { error: "No active phases found" },
          { status: 400 }
        );
      }

      // Delete existing project phases
      await db.projectPhase.deleteMany({ where: { projectId: params.id } });

      // Distribute project duration equally among phases
      const totalDays = differenceInDays(project.endDate, project.startDate);
      const daysPerPhase = Math.max(1, Math.floor(totalDays / phases.length));

      const created = [];
      let currentStart = project.startDate;

      for (let i = 0; i < phases.length; i++) {
        const isLast = i === phases.length - 1;
        const phaseEnd = isLast
          ? project.endDate
          : addDays(currentStart, daysPerPhase);

        // Determine status based on current phase
        let status = "active";
        if (project.currentPhaseId) {
          const currentPhaseIndex = phases.findIndex((p) => p.id === project.currentPhaseId);
          if (currentPhaseIndex >= 0) {
            if (i < currentPhaseIndex) status = "completed";
            else if (i > currentPhaseIndex) status = "active";
          }
        }

        const pp = await db.projectPhase.create({
          data: {
            projectId: params.id,
            phaseId: phases[i].id,
            startDate: currentStart,
            endDate: phaseEnd,
            status,
          },
          include: {
            phase: { select: { id: true, name: true, color: true, sortOrder: true } },
          },
        });

        created.push(pp);
        currentStart = addDays(phaseEnd, 1);
      }

      return NextResponse.json(created, { status: 201 });
    }

    // Normal create
    const result = validate(createProjectPhaseSchema, body);
    if (!result.success) return result.response;
    const { phaseId, startDate, endDate, status } = result.data;

    // Verify phase belongs to company
    const phase = await db.phase.findFirst({
      where: { id: phaseId, companyId: user.companyId },
    });
    if (!phase) {
      return NextResponse.json({ error: "Phase not found" }, { status: 404 });
    }

    const projectPhase = await db.projectPhase.create({
      data: {
        projectId: params.id,
        phaseId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: status || "active",
      },
      include: {
        phase: { select: { id: true, name: true, color: true, sortOrder: true } },
      },
    });

    return NextResponse.json(projectPhase, { status: 201 });
  } catch (error) {
    console.error("[PROJECT_PHASES_POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin" && user.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const result = validate(updateProjectPhaseSchema, body);
    if (!result.success) return result.response;
    const { projectPhaseId, startDate, endDate, status } = result.data;

    const existing = await db.projectPhase.findFirst({
      where: { id: projectPhaseId, projectId: params.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await db.projectPhase.update({
      where: { id: projectPhaseId },
      data: {
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(status && { status }),
      },
      include: {
        phase: { select: { id: true, name: true, color: true, sortOrder: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PROJECT_PHASES_PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin" && user.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const projectPhaseId = url.searchParams.get("projectPhaseId");
    if (!projectPhaseId) {
      return NextResponse.json({ error: "projectPhaseId required" }, { status: 400 });
    }

    const existing = await db.projectPhase.findFirst({
      where: { id: projectPhaseId, projectId: params.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.projectPhase.delete({ where: { id: projectPhaseId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PROJECT_PHASES_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
