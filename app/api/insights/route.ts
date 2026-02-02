import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireManager } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await requireManager();

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    const where: Record<string, unknown> = {
      companyId: user.companyId,
      dismissed: false,
    };

    if (category) {
      where.category = category;
    }

    const insights = await db.contractInsight.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(insights);
  } catch (error) {
    console.error("[INSIGHTS_GET]", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
