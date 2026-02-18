import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, isAdminOrManager } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { expenseCategoryMappingSchema } from "@/lib/schemas";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminOrManager(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const mappings = await db.expenseCategoryMapping.findMany({
      where: { companyId: user.companyId },
      orderBy: { category: "asc" },
    });

    return NextResponse.json(mappings);
  } catch (error) {
    console.error("[EXPENSE_CATEGORY_MAPPINGS_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminOrManager(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const result = validate(expenseCategoryMappingSchema, body);
    if (!result.success) return result.response;

    const { category, externalAccountId, externalAccountName } = result.data;

    const mapping = await db.expenseCategoryMapping.upsert({
      where: { companyId_category: { companyId: user.companyId, category } },
      update: { externalAccountId, externalAccountName },
      create: {
        companyId: user.companyId,
        category,
        externalAccountId,
        externalAccountName,
      },
    });

    return NextResponse.json(mapping, { status: 201 });
  } catch (error) {
    console.error("[EXPENSE_CATEGORY_MAPPINGS_POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
