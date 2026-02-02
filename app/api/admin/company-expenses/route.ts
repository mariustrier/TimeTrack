import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

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
    const { amount, description, category, date, recurring, frequency, receiptUrl, receiptFileName, receiptFileSize } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
    }

    if (!description) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }

    if (!category) {
      return NextResponse.json({ error: "Category is required" }, { status: 400 });
    }

    const expense = await db.companyExpense.create({
      data: {
        amount: parseFloat(String(amount)),
        description,
        category,
        date: new Date(date),
        recurring: !!recurring,
        frequency: frequency || null,
        companyId: user.companyId,
        createdBy: user.id,
        ...(receiptUrl && { receiptUrl, receiptFileName, receiptFileSize }),
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error("[COMPANY_EXPENSES_POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
