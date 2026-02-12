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
    const { amount, description, category, date, recurring, frequency, receiptUrl, receiptFileName, receiptFileSize, amendmentReason, expenseCategoryId } = body;

    // Bogføringsloven: finalized expenses require an amendment reason
    if (expense.isFinalized) {
      if (!amendmentReason) {
        return NextResponse.json(
          { error: "Amendment reason is required to modify a finalized expense" },
          { status: 400 }
        );
      }

      // Snapshot old values before update
      const oldValues = {
        amount: expense.amount,
        description: expense.description,
        category: expense.category,
        date: expense.date,
        recurring: expense.recurring,
        frequency: expense.frequency,
      };

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
          ...(expenseCategoryId !== undefined && { expenseCategoryId: expenseCategoryId || null }),
        },
      });

      // Compute changes for audit trail
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      if (amount !== undefined && parseFloat(String(amount)) !== oldValues.amount) {
        changes.amount = { from: oldValues.amount, to: parseFloat(String(amount)) };
      }
      if (description !== undefined && description !== oldValues.description) {
        changes.description = { from: oldValues.description, to: description };
      }
      if (category !== undefined && category !== oldValues.category) {
        changes.category = { from: oldValues.category, to: category };
      }
      if (date !== undefined && new Date(date).toISOString() !== new Date(oldValues.date).toISOString()) {
        changes.date = { from: oldValues.date, to: new Date(date) };
      }
      if (recurring !== undefined && !!recurring !== oldValues.recurring) {
        changes.recurring = { from: oldValues.recurring, to: !!recurring };
      }
      if (frequency !== undefined && (frequency || null) !== oldValues.frequency) {
        changes.frequency = { from: oldValues.frequency, to: frequency || null };
      }

      await db.auditLog.create({
        data: {
          companyId: user.companyId,
          entityType: "CompanyExpense",
          entityId: expense.id,
          action: "AMEND",
          actorId: user.id,
          metadata: JSON.stringify({
            reason: amendmentReason,
            changes,
          }),
        },
      });

      return NextResponse.json(updated);
    }

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
        ...(expenseCategoryId !== undefined && { expenseCategoryId: expenseCategoryId || null }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[COMPANY_EXPENSE_PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
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

    // Bogføringsloven: finalized expenses are soft-deleted with audit trail
    if (expense.isFinalized) {
      let voidReason: string | undefined;
      try {
        const body = await req.json();
        voidReason = body.voidReason;
      } catch {
        // no body provided
      }

      if (!voidReason) {
        return NextResponse.json(
          { error: "Void reason is required to delete a finalized expense" },
          { status: 400 }
        );
      }

      await db.companyExpense.update({
        where: { id: params.id },
        data: { isDeleted: true, deletedAt: new Date(), deletedBy: user.id },
      });

      await db.auditLog.create({
        data: {
          companyId: user.companyId,
          entityType: "CompanyExpense",
          entityId: expense.id,
          action: "VOID",
          actorId: user.id,
          metadata: JSON.stringify({ reason: voidReason }),
        },
      });

      return NextResponse.json({ success: true });
    }

    await db.companyExpense.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[COMPANY_EXPENSE_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
