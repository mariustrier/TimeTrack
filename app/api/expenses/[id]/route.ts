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

    const expense = await db.expense.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });

    if (!expense) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const { amount, description, category, date, projectId, receiptUrl, receiptFileName, receiptFileSize } = body;

    // Admin can update any expense
    if (user.role === "admin") {
      if (projectId) {
        const project = await db.project.findFirst({
          where: { id: projectId, companyId: user.companyId },
        });
        if (!project) {
          return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }
      }

      const updated = await db.expense.update({
        where: { id: params.id },
        data: {
          ...(amount !== undefined && { amount: parseFloat(String(amount)) }),
          ...(description !== undefined && { description }),
          ...(category !== undefined && { category }),
          ...(date !== undefined && { date: new Date(date) }),
          ...(projectId !== undefined && { projectId }),
          ...(receiptUrl !== undefined && { receiptUrl: receiptUrl || null, receiptFileName: receiptFileName || null, receiptFileSize: receiptFileSize || null }),
        },
        include: {
          project: { select: { id: true, name: true, color: true } },
        },
      });
      return NextResponse.json(updated);
    }

    // Owner can only update draft or rejected expenses
    if (expense.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (expense.approvalStatus !== "draft" && expense.approvalStatus !== "rejected") {
      return NextResponse.json({ error: "Can only update draft or rejected expenses" }, { status: 400 });
    }

    if (projectId) {
      const project = await db.project.findFirst({
        where: { id: projectId, companyId: user.companyId },
      });
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    }

    const updated = await db.expense.update({
      where: { id: params.id },
      data: {
        ...(amount !== undefined && { amount: parseFloat(String(amount)) }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(date !== undefined && { date: new Date(date) }),
        ...(projectId !== undefined && { projectId }),
        ...(receiptUrl !== undefined && { receiptUrl: receiptUrl || null, receiptFileName: receiptFileName || null, receiptFileSize: receiptFileSize || null }),
      },
      include: {
        project: { select: { id: true, name: true, color: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[EXPENSE_PUT]", error);
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

    const expense = await db.expense.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });

    if (!expense) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Admin can delete any expense
    if (user.role !== "admin") {
      if (expense.userId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (expense.approvalStatus !== "draft") {
        return NextResponse.json({ error: "Can only delete draft expenses" }, { status: 400 });
      }
    }

    await db.expense.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[EXPENSE_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
