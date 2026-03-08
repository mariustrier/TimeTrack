import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAdmin();

    const category = await db.nonBillableCategory.findFirst({
      where: {
        id: params.id,
        companyId: user.companyId,
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { name, sortOrder, active } = body;

    // If updating name, check for duplicates
    if (name && name.trim() !== category.name) {
      const existing = await db.nonBillableCategory.findUnique({
        where: {
          companyId_name: {
            companyId: user.companyId,
            name: name.trim(),
          },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "A category with this name already exists" },
          { status: 400 }
        );
      }
    }

    const updated = await db.nonBillableCategory.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(active !== undefined && { active }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[NON_BILLABLE_CATEGORY_PATCH]", error);

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

    const category = await db.nonBillableCategory.findFirst({
      where: {
        id: params.id,
        companyId: user.companyId,
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // Hard delete — if a foreign key constraint prevents deletion
    // (e.g., time entries referencing this category in the future),
    // Prisma will throw and we fall back to soft-delete.
    try {
      await db.nonBillableCategory.delete({
        where: { id: params.id },
      });
    } catch {
      // Soft delete by setting active to false (category is in use)
      await db.nonBillableCategory.update({
        where: { id: params.id },
        data: { active: false },
      });

      return NextResponse.json({
        success: true,
        softDeleted: true,
        message: "Category deactivated because it is in use",
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[NON_BILLABLE_CATEGORY_DELETE]", error);

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
