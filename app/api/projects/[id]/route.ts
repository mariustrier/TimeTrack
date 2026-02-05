import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { updateProjectSchema } from "@/lib/schemas";

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const project = await db.project.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });
    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const result = validate(updateProjectSchema, body);
    if (!result.success) return result.response;
    const { name, client, color, budgetHours, billable, currency, pricingType, fixedPrice, rateMode, projectRate, locked, archived } = result.data;

    // Prevent deactivating system-managed projects
    if (project.systemManaged && body.active === false) {
      return NextResponse.json(
        { error: "Cannot deactivate system-managed projects" },
        { status: 403 }
      );
    }

    // Prevent locking/archiving system-managed projects
    if (project.systemManaged && (locked === true || archived === true)) {
      return NextResponse.json(
        { error: "Cannot lock or archive system-managed projects" },
        { status: 403 }
      );
    }

    const updated = await db.project.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(client !== undefined && { client }),
        ...(color !== undefined && { color }),
        ...(budgetHours !== undefined && {
          budgetHours: budgetHours ?? null,
        }),
        ...(billable !== undefined && { billable }),
        ...(body.active !== undefined && { active: body.active }),
        ...(currency !== undefined && { currency: currency || null }),
        ...(pricingType !== undefined && { pricingType }),
        ...(fixedPrice !== undefined && { fixedPrice: fixedPrice ?? null }),
        ...(rateMode !== undefined && { rateMode }),
        ...(projectRate !== undefined && { projectRate: projectRate ?? null }),
        // Lock state
        ...(locked !== undefined && {
          locked,
          lockedAt: locked ? new Date() : null,
          lockedBy: locked ? user.id : null,
        }),
        // Archive state
        ...(archived !== undefined && {
          archived,
          archivedAt: archived ? new Date() : null,
          archivedBy: archived ? user.id : null,
        }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PROJECT_PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const project = await db.project.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });
    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Prevent deleting system-managed projects
    if (project.systemManaged) {
      return NextResponse.json(
        { error: "Cannot delete system-managed projects" },
        { status: 403 }
      );
    }

    await db.project.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PROJECT_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
