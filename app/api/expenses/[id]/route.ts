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
    const { amount, description, category, date, projectId, receiptUrl, receiptFileName, receiptFileSize, amendmentReason } = body;

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
        projectId: expense.projectId,
      };

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
      if (projectId !== undefined && projectId !== oldValues.projectId) {
        changes.projectId = { from: oldValues.projectId, to: projectId };
      }

      await db.auditLog.create({
        data: {
          companyId: user.companyId,
          entityType: "Expense",
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

    if (expense.approvalStatus !== "draft" && expense.approvalStatus !== "submitted" && expense.approvalStatus !== "rejected") {
      return NextResponse.json({ error: "Can only update draft, submitted, or rejected expenses" }, { status: 400 });
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

      await db.expense.update({
        where: { id: params.id },
        data: { isDeleted: true, deletedAt: new Date(), deletedBy: user.id },
      });

      await db.auditLog.create({
        data: {
          companyId: user.companyId,
          entityType: "Expense",
          entityId: expense.id,
          action: "VOID",
          actorId: user.id,
          metadata: JSON.stringify({ reason: voidReason }),
        },
      });

      return NextResponse.json({ success: true });
    }

    // Admin can delete any expense
    if (user.role !== "admin") {
      if (expense.userId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (expense.approvalStatus !== "draft" && expense.approvalStatus !== "submitted") {
        return NextResponse.json({ error: "Can only delete draft or submitted expenses" }, { status: 400 });
      }
    }

    await db.expense.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[EXPENSE_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
