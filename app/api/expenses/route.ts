import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, isAdminOrManager } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const projectId = searchParams.get("projectId");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {
      companyId: user.companyId,
    };

    // Regular users see only their own expenses
    if (!isAdminOrManager(user.role)) {
      where.userId = user.id;
    }

    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
      where.date = dateFilter;
    }

    if (projectId) {
      where.projectId = projectId;
    }

    if (status) {
      where.approvalStatus = status;
    }

    const expenses = await db.expense.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, color: true } },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(expenses);
  } catch (error) {
    console.error("[EXPENSES_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { amount, description, category, date, projectId, receiptUrl, receiptFileName, receiptFileSize } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
    }

    if (!description) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }

    if (!projectId) {
      return NextResponse.json({ error: "Project is required" }, { status: 400 });
    }

    // Validate project belongs to user's company
    const project = await db.project.findFirst({
      where: { id: projectId, companyId: user.companyId },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check auto-approve threshold
    const company = await db.company.findUnique({
      where: { id: user.companyId },
      select: { expenseAutoApproveThreshold: true },
    });

    const threshold = company?.expenseAutoApproveThreshold;
    const autoApprove = threshold !== null && threshold !== undefined && amount <= threshold;

    const expense = await db.expense.create({
      data: {
        amount: parseFloat(String(amount)),
        description,
        category: category || "other",
        date: new Date(date),
        userId: user.id,
        projectId,
        companyId: user.companyId,
        approvalStatus: autoApprove ? "approved" : "draft",
        ...(autoApprove && { approvedAt: new Date() }),
        ...(receiptUrl && { receiptUrl, receiptFileName, receiptFileSize }),
      },
      include: {
        project: { select: { id: true, name: true, color: true } },
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error("[EXPENSES_POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
