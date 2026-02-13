import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { reorderActivitiesSchema } from "@/lib/schemas";

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

    // Verify project belongs to company
    const project = await db.project.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await req.json();
    const result = validate(reorderActivitiesSchema, body);
    if (!result.success) return result.response;

    const { orderedIds } = result.data;

    const updates = orderedIds.map((id, index) =>
      db.projectActivity.update({ where: { id }, data: { sortOrder: index } })
    );
    await db.$transaction(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ACTIVITIES_REORDER_PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
