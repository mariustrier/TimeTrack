import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { createActivitySchema, updateActivitySchema } from "@/lib/schemas";

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

    const activities = await db.projectActivity.findMany({
      where: { projectId: params.id },
      include: {
        assignedUser: {
          select: { id: true, firstName: true, lastName: true, imageUrl: true },
        },
        phase: {
          select: { id: true, name: true, color: true },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { startDate: "asc" }],
    });

    const result = activities.map((activity) => ({
      ...activity,
      assignedUserName: activity.assignedUser
        ? `${activity.assignedUser.firstName} ${activity.assignedUser.lastName}`
        : null,
      phaseName: activity.phase?.name ?? null,
      phaseColor: activity.phase?.color ?? null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("[ACTIVITIES_GET]", error);
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
    const result = validate(createActivitySchema, body);
    if (!result.success) return result.response;

    const {
      name,
      phaseId,
      categoryName,
      assignedUserId,
      startDate,
      endDate,
      status,
      color,
      note,
      sortOrder,
    } = result.data;

    // Get max sortOrder if not provided
    let order = sortOrder;
    if (order === undefined) {
      const maxOrder = await db.projectActivity.aggregate({
        where: { projectId: params.id },
        _max: { sortOrder: true },
      });
      order = (maxOrder._max.sortOrder || 0) + 1;
    }

    const activity = await db.projectActivity.create({
      data: {
        projectId: params.id,
        companyId: user.companyId,
        name,
        phaseId: phaseId ?? null,
        categoryName: categoryName ?? null,
        assignedUserId: assignedUserId ?? null,
        startDate: new Date(startDate + "T00:00:00"),
        endDate: new Date(endDate + "T00:00:00"),
        status: status ?? "not_started",
        color: color ?? null,
        note: note ?? null,
        sortOrder: order,
      },
    });

    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    console.error("[ACTIVITIES_POST]", error);
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
    const { activityId, ...updateData } = body;

    if (!activityId) {
      return NextResponse.json({ error: "activityId required" }, { status: 400 });
    }

    // Verify activity belongs to a project in user's company
    const activity = await db.projectActivity.findFirst({
      where: { id: activityId },
      include: { project: true },
    });

    if (!activity || activity.project.companyId !== user.companyId) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    const result = validate(updateActivitySchema, updateData);
    if (!result.success) return result.response;

    const {
      name,
      phaseId,
      categoryName,
      assignedUserId,
      startDate,
      endDate,
      status,
      color,
      note,
      sortOrder,
    } = result.data;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (phaseId !== undefined) data.phaseId = phaseId;
    if (categoryName !== undefined) data.categoryName = categoryName;
    if (assignedUserId !== undefined) data.assignedUserId = assignedUserId;
    if (startDate !== undefined) data.startDate = new Date(startDate + "T00:00:00");
    if (endDate !== undefined) data.endDate = new Date(endDate + "T00:00:00");
    if (status !== undefined) data.status = status;
    if (color !== undefined) data.color = color;
    if (note !== undefined) data.note = note;
    if (sortOrder !== undefined) data.sortOrder = sortOrder;

    const updated = await db.projectActivity.update({
      where: { id: activityId },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[ACTIVITIES_PUT]", error);
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
    const activityId = searchParams.get("activityId");

    if (!activityId) {
      return NextResponse.json({ error: "activityId required" }, { status: 400 });
    }

    // Verify activity belongs to a project in user's company
    const activity = await db.projectActivity.findFirst({
      where: { id: activityId },
      include: { project: true },
    });

    if (!activity || activity.project.companyId !== user.companyId) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    await db.projectActivity.delete({
      where: { id: activityId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ACTIVITIES_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
