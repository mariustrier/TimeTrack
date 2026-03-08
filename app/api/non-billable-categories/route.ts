import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireAdmin();

    const categories = await db.nonBillableCategory.findMany({
      where: { companyId: user.companyId },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error("[NON_BILLABLE_CATEGORIES_GET]", error);

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
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Check for duplicate name
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

    // Get max sort order
    const maxSortOrder = await db.nonBillableCategory.aggregate({
      where: { companyId: user.companyId },
      _max: { sortOrder: true },
    });

    const category = await db.nonBillableCategory.create({
      data: {
        name: name.trim(),
        sortOrder: (maxSortOrder._max.sortOrder ?? 0) + 1,
        companyId: user.companyId,
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error("[NON_BILLABLE_CATEGORIES_POST]", error);

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
