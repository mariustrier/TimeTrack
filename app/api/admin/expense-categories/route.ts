import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { createExpenseCategorySchema } from "@/lib/schemas";

const DEFAULT_CATEGORIES = [
  { name: "Rent", sortOrder: 1 },
  { name: "Insurance", sortOrder: 2 },
  { name: "Utilities", sortOrder: 3 },
  { name: "Software Subscriptions", sortOrder: 4 },
  { name: "Salaries & Benefits", sortOrder: 5 },
  { name: "Other", sortOrder: 6 },
];

async function ensureDefaultCategories(companyId: string) {
  const count = await db.expenseCategory.count({ where: { companyId } });
  if (count === 0) {
    await db.expenseCategory.createMany({
      data: DEFAULT_CATEGORIES.map((cat) => ({
        ...cat,
        isDefault: true,
        companyId,
      })),
    });
  }
}

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await ensureDefaultCategories(user.companyId);

    const categories = await db.expenseCategory.findMany({
      where: {
        companyId: user.companyId,
        active: true,
      },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        isDefault: true,
        sortOrder: true,
        active: true,
      },
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error("[EXPENSE_CATEGORIES_GET]", error);
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
    const result = validate(createExpenseCategorySchema, body);
    if (!result.success) return result.response;
    const { name } = result.data;

    // Check for duplicate name
    const existing = await db.expenseCategory.findFirst({
      where: { companyId: user.companyId, name, active: true },
    });
    if (existing) {
      return NextResponse.json({ error: "Category already exists" }, { status: 400 });
    }

    // Get next sortOrder
    const maxOrder = await db.expenseCategory.aggregate({
      where: { companyId: user.companyId },
      _max: { sortOrder: true },
    });

    const category = await db.expenseCategory.create({
      data: {
        name,
        companyId: user.companyId,
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("[EXPENSE_CATEGORIES_POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
