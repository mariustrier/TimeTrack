import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireManager } from "@/lib/auth";

export async function POST() {
  try {
    const user = await requireManager();

    const result = await db.contractInsight.updateMany({
      where: {
        companyId: user.companyId,
        dismissed: false,
      },
      data: {
        dismissed: true,
        dismissedById: user.id,
        dismissedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error("[INSIGHTS_DISMISS_ALL_POST]", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
