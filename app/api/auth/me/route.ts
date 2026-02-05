import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const user = await requireAuth();

    // Update company's last activity timestamp (fire and forget, don't block response)
    db.company.update({
      where: { id: user.companyId },
      data: { lastActivityAt: new Date() },
    }).catch(() => {
      // Silently ignore errors - this is non-critical
    });

    return NextResponse.json({
      id: user.id,
      role: user.role,
      companyId: user.companyId,
    });
  } catch (error) {
    console.error("[AUTH_ME_GET]", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
