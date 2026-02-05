import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { del } from "@vercel/blob";

export async function GET(
  _req: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    const user = await requireManager();

    // Verify project belongs to user's company
    const project = await db.project.findFirst({
      where: { id: params.projectId, companyId: user.companyId },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const contracts = await db.contract.findMany({
      where: { projectId: params.projectId },
      include: {
        uploadedBy: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(contracts);
  } catch (error) {
    console.error("[CONTRACTS_GET]", error);

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

export async function PUT(req: Request) {
  try {
    const user = await requireManager();

    const body = await req.json();
    const { contractId, maxHours, maxBudget, budgetCurrency, deadline, scopeDescription, scopeKeywords, exclusions, scopeAdditions } = body;

    if (!contractId) {
      return NextResponse.json({ error: "Contract ID is required" }, { status: 400 });
    }

    const contract = await db.contract.findUnique({
      where: { id: contractId },
      include: { project: { select: { companyId: true } } },
    });

    if (!contract || contract.project.companyId !== user.companyId) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    // If only updating scopeAdditions, don't overwrite extracted terms
    if (scopeAdditions !== undefined && maxHours === undefined && maxBudget === undefined) {
      const updated = await db.contract.update({
        where: { id: contractId },
        data: { scopeAdditions: scopeAdditions || null },
        include: { uploadedBy: { select: { firstName: true, lastName: true } } },
      });
      return NextResponse.json(updated);
    }

    const terms = {
      maxHours: maxHours != null ? parseFloat(maxHours) : null,
      maxBudget: maxBudget != null ? parseFloat(maxBudget) : null,
      budgetCurrency: budgetCurrency || null,
      deadline: deadline ? new Date(deadline) : null,
      scopeDescription: scopeDescription || null,
      scopeKeywords: scopeKeywords || [],
      exclusions: exclusions || [],
    };

    const updated = await db.contract.update({
      where: { id: contractId },
      data: {
        ...terms,
        extractedTerms: JSON.parse(JSON.stringify(terms)),
        extractedAt: new Date(),
      },
      include: { uploadedBy: { select: { firstName: true, lastName: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[CONTRACTS_PUT]", error);

    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message === "Forbidden") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireManager();

    // Only admins can delete contracts
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const contractId = searchParams.get("contractId");

    if (!contractId) {
      return NextResponse.json(
        { error: "Contract ID is required" },
        { status: 400 }
      );
    }

    // Verify contract exists and its project belongs to user's company
    const contract = await db.contract.findUnique({
      where: { id: contractId },
      include: {
        project: { select: { companyId: true } },
      },
    });

    if (!contract || contract.project.companyId !== user.companyId) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 }
      );
    }

    // Delete from Vercel Blob
    await del(contract.fileUrl);

    // Delete from DB
    await db.contract.delete({ where: { id: contractId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CONTRACTS_DELETE]", error);

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
