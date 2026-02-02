import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireManager } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireManager();

    const count = await db.contractInsight.count({
      where: {
        companyId: user.companyId,
        dismissed: false,
      },
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error("[INSIGHTS_COUNT_GET]", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
