import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { updateRoleSchema } from "@/lib/schemas";

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAdmin();

    const role = await db.role.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });

    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    const body = await req.json();
    const result = validate(updateRoleSchema, body);
    if (!result.success) return result.response;
    const { name, defaultRate, color } = result.data;

    const updated = await db.role.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(defaultRate !== undefined && { defaultRate: defaultRate }),
        ...(color !== undefined && { color: color }),
      },
      include: {
        _count: { select: { users: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[ROLE_PUT]", error);

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

    const role = await db.role.findFirst({
      where: { id: params.id, companyId: user.companyId },
      include: { _count: { select: { users: true } } },
    });

    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    if (role._count.users > 0) {
      return NextResponse.json(
        {
          error: `Kan ikke slette — ${role._count.users} medarbejder${role._count.users === 1 ? "" : "e"} er tilknyttet denne rolle. Flyt dem til en anden rolle først.`,
          memberCount: role._count.users,
        },
        { status: 400 }
      );
    }

    await db.role.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ROLE_DELETE]", error);

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
