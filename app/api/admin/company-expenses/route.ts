import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { createCompanyExpenseSchema } from "@/lib/schemas";

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    const where: Record<string, unknown> = {
      companyId: user.companyId,
      isDeleted: { not: true },
    };

    if (category) {
      where.category = category;
    }

    const expenses = await db.companyExpense.findMany({
      where,
      orderBy: { date: "desc" },
    });

    return NextResponse.json(expenses);
  } catch (error) {
    console.error("[COMPANY_EXPENSES_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const result = validate(createCompanyExpenseSchema, body);
    if (!result.success) return result.response;
    const { amount, description, category, date, recurring, frequency, receiptUrl, receiptFileName, receiptFileSize, expenseCategoryId } = result.data;

    // Validate category exists if expenseCategoryId is provided
    if (expenseCategoryId) {
      const cat = await db.expenseCategory.findFirst({
        where: { id: expenseCategoryId, companyId: user.companyId, active: true },
      });
      if (!cat) {
        return NextResponse.json({ error: "Category not found" }, { status: 400 });
      }
    }

    const expense = await db.companyExpense.create({
      data: {
        amount,
        description,
        category,
        date: new Date(date),
        recurring: !!recurring,
        frequency: frequency || null,
        companyId: user.companyId,
        createdBy: user.id,
        ...(expenseCategoryId && { expenseCategoryId }),
        ...(receiptUrl && { receiptUrl, receiptFileName, receiptFileSize }),
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error("[COMPANY_EXPENSES_POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
