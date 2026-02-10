import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";

export async function POST() {
  try {
    const user = await requireSuperAdmin();

    // Find the active session for this super admin
    const access = await db.supportAccess.findFirst({
      where: { requestedBy: user.id, status: "active" },
    });

    if (!access) {
      return NextResponse.json({ error: "No active session" }, { status: 404 });
    }

    const updated = await db.supportAccess.update({
      where: { id: access.id },
      data: { status: "expired", expiredAt: new Date(), expiryReason: "manual_exit" },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        companyId: access.companyId,
        entityType: "SupportAccess",
        entityId: access.id,
        action: "SUPPORT_EXIT",
        actorId: user.id,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[SUPPORT_EXIT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
