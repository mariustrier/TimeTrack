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
