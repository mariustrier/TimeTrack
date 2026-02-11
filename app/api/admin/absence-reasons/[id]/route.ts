import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAdmin();

    const reason = await db.absenceReason.findFirst({
      where: {
        id: params.id,
        companyId: user.companyId,
      },
    });

    if (!reason) {
      return NextResponse.json(
        { error: "Absence reason not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { name, code, active, sortOrder, userIds } = body;

    // If updating name, check for duplicates
    if (name && name.trim() !== reason.name) {
      const existing = await db.absenceReason.findUnique({
        where: {
          companyId_name: {
            companyId: user.companyId,
            name: name.trim(),
          },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "A reason with this name already exists" },
          { status: 400 }
        );
      }
    }

    // If userIds provided, verify all users belong to the same company
    if (userIds !== undefined) {
      const validUsers = await db.user.findMany({
        where: {
          id: { in: userIds },
          companyId: user.companyId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (validUsers.length !== userIds.length) {
        return NextResponse.json(
          { error: "Invalid user IDs" },
          { status: 400 }
        );
      }
    }

    const updated = await db.absenceReason.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(code !== undefined && { code: code?.trim() || null }),
        ...(active !== undefined && { active }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(userIds !== undefined && {
          users: {
            set: userIds.map((id: string) => ({ id })),
          },
        }),
      },
      include: {
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[ADMIN_ABSENCE_REASON_PUT]", error);

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

    const reason = await db.absenceReason.findFirst({
      where: {
        id: params.id,
        companyId: user.companyId,
      },
    });

    if (!reason) {
      return NextResponse.json(
        { error: "Absence reason not found" },
        { status: 404 }
      );
    }

    // Cannot delete system default reasons
    if (reason.isDefault) {
      return NextResponse.json(
        { error: "Cannot delete system default reasons" },
        { status: 403 }
      );
    }

    // Check if reason is used by any time entries
    const usageCount = await db.timeEntry.count({
      where: { absenceReasonId: params.id },
    });

    if (usageCount > 0) {
      // Soft delete by setting active to false
      await db.absenceReason.update({
        where: { id: params.id },
        data: { active: false },
      });

      return NextResponse.json({
        success: true,
        softDeleted: true,
        message: "Reason deactivated because it has existing time entries",
      });
    }

    // Hard delete if not used
    await db.absenceReason.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ADMIN_ABSENCE_REASON_DELETE]", error);

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
