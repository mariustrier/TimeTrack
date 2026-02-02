import { NextResponse } from "next/server";
import { requireManager } from "@/lib/auth";
import { generateInsights } from "@/lib/ai/generate-insights";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST() {
  try {
    const user = await requireManager();

    const limited = checkRateLimit(`insights:${user.companyId}`, { windowMs: 60000, maxRequests: 5 });
    if (limited) return limited;

    await generateInsights(user.companyId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[INSIGHTS_REFRESH_POST]", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
