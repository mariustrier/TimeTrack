import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

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
    const { name, client, color, budgetHours, billable, active } = body;

    const updated = await db.project.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(client !== undefined && { client }),
        ...(color !== undefined && { color }),
        ...(budgetHours !== undefined && {
          budgetHours: budgetHours ? parseFloat(budgetHours) : null,
        }),
        ...(billable !== undefined && { billable }),
        ...(active !== undefined && { active }),
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

    await db.project.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PROJECT_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
