import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { reorderRolesSchema } from "@/lib/schemas";

export async function PUT(req: Request) {
  try {
    const user = await requireAdmin();

    const body = await req.json();
    const result = validate(reorderRolesSchema, body);
    if (!result.success) return result.response;
    const { orderedIds } = result.data;

    // Verify all IDs belong to this company
    const roles = await db.role.findMany({
      where: { companyId: user.companyId, id: { in: orderedIds } },
      select: { id: true },
    });

    if (roles.length !== orderedIds.length) {
      return NextResponse.json(
        { error: "Invalid role IDs" },
        { status: 400 }
      );
    }

    // Update sortOrder for each role
    await Promise.all(
      orderedIds.map((id, index) =>
        db.role.update({
          where: { id },
          data: { sortOrder: index + 1 },
        })
      )
    );

    const updated = await db.role.findMany({
      where: { companyId: user.companyId },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: { select: { users: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[ROLES_REORDER]", error);

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
