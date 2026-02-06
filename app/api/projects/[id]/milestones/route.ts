import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { createMilestoneSchema, updateMilestoneSchema } from "@/lib/schemas";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify project belongs to company
    const project = await db.project.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const milestones = await db.projectMilestone.findMany({
      where: { projectId: params.id },
      orderBy: [{ sortOrder: "asc" }, { dueDate: "asc" }],
    });

    return NextResponse.json(milestones);
  } catch (error) {
    console.error("[MILESTONES_GET]", error);
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

    // Verify project belongs to company
    const project = await db.project.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await req.json();
    const result = validate(createMilestoneSchema, body);
    if (!result.success) return result.response;

    const { title, dueDate, sortOrder } = result.data;

    // Get max sortOrder if not provided
    let order = sortOrder;
    if (order === undefined) {
      const maxOrder = await db.projectMilestone.aggregate({
        where: { projectId: params.id },
        _max: { sortOrder: true },
      });
      order = (maxOrder._max.sortOrder || 0) + 1;
    }

    const milestone = await db.projectMilestone.create({
      data: {
        projectId: params.id,
        title,
        dueDate: new Date(dueDate),
        sortOrder: order,
      },
    });

    return NextResponse.json(milestone, { status: 201 });
  } catch (error) {
    console.error("[MILESTONES_POST]", error);
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
    const { milestoneId, ...updateData } = body;

    if (!milestoneId) {
      return NextResponse.json({ error: "milestoneId required" }, { status: 400 });
    }

    // Verify milestone belongs to a project in user's company
    const milestone = await db.projectMilestone.findFirst({
      where: { id: milestoneId },
      include: { project: true },
    });

    if (!milestone || milestone.project.companyId !== user.companyId) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    const result = validate(updateMilestoneSchema, updateData);
    if (!result.success) return result.response;

    const { title, dueDate, completed, sortOrder } = result.data;

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (dueDate !== undefined) data.dueDate = new Date(dueDate);
    if (sortOrder !== undefined) data.sortOrder = sortOrder;
    if (completed !== undefined) {
      data.completed = completed;
      data.completedAt = completed ? new Date() : null;
    }

    const updated = await db.projectMilestone.update({
      where: { id: milestoneId },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[MILESTONES_PUT]", error);
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

    const { searchParams } = new URL(req.url);
    const milestoneId = searchParams.get("milestoneId");

    if (!milestoneId) {
      return NextResponse.json({ error: "milestoneId required" }, { status: 400 });
    }

    // Verify milestone belongs to a project in user's company
    const milestone = await db.projectMilestone.findFirst({
      where: { id: milestoneId },
      include: { project: true },
    });

    if (!milestone || milestone.project.companyId !== user.companyId) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    await db.projectMilestone.delete({
      where: { id: milestoneId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[MILESTONES_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
