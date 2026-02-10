import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireAdmin();

    const sessions = await db.supportAccess.findMany({
      where: {
        companyId: user.companyId,
        status: { in: ["pending", "granted", "active"] },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(sessions);
  } catch (error: any) {
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[ADMIN_SUPPORT_ACCESS_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
