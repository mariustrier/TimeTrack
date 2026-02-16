import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { createRoleSchema } from "@/lib/schemas";

export async function GET() {
  try {
    const user = await requireAdmin();

    const roles = await db.role.findMany({
      where: { companyId: user.companyId },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: { select: { users: true } },
      },
    });

    return NextResponse.json(roles);
  } catch (error) {
    console.error("[ROLES_GET]", error);

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

export async function POST(req: Request) {
  try {
    const user = await requireAdmin();

    const body = await req.json();
    const result = validate(createRoleSchema, body);
    if (!result.success) return result.response;
    const { name, defaultRate, color } = result.data;

    // Get max sort order
    const maxSortOrder = await db.role.aggregate({
      where: { companyId: user.companyId },
      _max: { sortOrder: true },
    });

    const role = await db.role.create({
      data: {
        name: name.trim(),
        sortOrder: (maxSortOrder._max.sortOrder ?? 0) + 1,
        companyId: user.companyId,
        defaultRate: defaultRate ?? undefined,
        color: color ?? undefined,
        isDefault: false,
      },
      include: {
        _count: { select: { users: true } },
      },
    });

    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    console.error("[ROLES_POST]", error);

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
