import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { extractContractTerms } from "@/lib/ai/extract-terms";

export async function POST(req: Request) {
  try {
    const user = await requireManager();

    const body = await req.json();
    const { contractId } = body;

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

    const updatedContract = await extractContractTerms(contractId, user.companyId);

    return NextResponse.json(updatedContract);
  } catch (error) {
    console.error("[CONTRACT_EXTRACT]", error);

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
