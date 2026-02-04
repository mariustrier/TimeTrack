import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { extractContractTerms } from "@/lib/ai/extract-terms";
import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const user = await requireManager();

    const limited = checkRateLimit(`extract:${user.companyId}`, { windowMs: 60000, maxRequests: 5 });
    if (limited) return limited;

    const body = await req.json();
    const { contractId, skipAnonymization } = body;

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

    const result = await extractContractTerms(contractId, user.companyId, {
      skipAnonymization: !!skipAnonymization,
    });

    return NextResponse.json(result);
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

    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
