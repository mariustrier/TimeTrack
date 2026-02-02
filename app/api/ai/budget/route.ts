import { NextResponse } from "next/server";
import { requireManager } from "@/lib/auth";
import { checkBudget } from "@/lib/ai/cost-tracking";

export async function GET() {
  try {
    const user = await requireManager();

    const budget = await checkBudget(user.companyId);

    return NextResponse.json(budget);
  } catch (error) {
    console.error("[AI_BUDGET_GET]", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
