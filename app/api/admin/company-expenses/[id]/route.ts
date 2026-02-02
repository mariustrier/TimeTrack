import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

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

    const expense = await db.companyExpense.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });

    if (!expense) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const { amount, description, category, date, recurring, frequency, receiptUrl, receiptFileName, receiptFileSize } = body;

    const updated = await db.companyExpense.update({
      where: { id: params.id },
      data: {
        ...(amount !== undefined && { amount: parseFloat(String(amount)) }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(date !== undefined && { date: new Date(date) }),
        ...(recurring !== undefined && { recurring: !!recurring }),
        ...(frequency !== undefined && { frequency: frequency || null }),
        ...(receiptUrl !== undefined && { receiptUrl: receiptUrl || null, receiptFileName: receiptFileName || null, receiptFileSize: receiptFileSize || null }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[COMPANY_EXPENSE_PUT]", error);
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

    const expense = await db.companyExpense.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });

    if (!expense) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.companyExpense.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[COMPANY_EXPENSE_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
