import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { updateExpenseCategorySchema } from "@/lib/schemas";

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

    const category = await db.expenseCategory.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });
    if (!category) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const result = validate(updateExpenseCategorySchema, body);
    if (!result.success) return result.response;
    const { name, active } = result.data;

    // Check for duplicate name if renaming
    if (name && name !== category.name) {
      const existing = await db.expenseCategory.findFirst({
        where: { companyId: user.companyId, name, active: true, id: { not: params.id } },
      });
      if (existing) {
        return NextResponse.json({ error: "Category already exists" }, { status: 400 });
      }
    }

    const updated = await db.expenseCategory.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(active !== undefined && { active }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[EXPENSE_CATEGORY_PUT]", error);
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

    const category = await db.expenseCategory.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });
    if (!category) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Check if any expenses use this category
    const usageCount = await db.companyExpense.count({
      where: { expenseCategoryId: params.id, isDeleted: { not: true } },
    });

    if (usageCount > 0) {
      // Soft-delete: deactivate instead
      await db.expenseCategory.update({
        where: { id: params.id },
        data: { active: false },
      });
      return NextResponse.json({ deactivated: true });
    }

    // Hard delete if unused
    await db.expenseCategory.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[EXPENSE_CATEGORY_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
