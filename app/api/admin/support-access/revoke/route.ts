import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { supportAccessActionSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  try {
    const user = await requireAdmin();
    const body = await req.json();
    const result = validate(supportAccessActionSchema, body);
    if (!result.success) return result.response;

    const access = await db.supportAccess.findUnique({
      where: { id: result.data.supportAccessId },
    });

    if (!access || access.companyId !== user.companyId) {
      return NextResponse.json({ error: "Access not found" }, { status: 404 });
    }

    if (!["pending", "granted", "active"].includes(access.status)) {
      return NextResponse.json({ error: "Session already expired" }, { status: 400 });
    }

    const action = access.status === "pending" ? "SUPPORT_DENY" : "SUPPORT_REVOKE";

    const updated = await db.supportAccess.update({
      where: { id: access.id },
      data: { status: "expired", expiredAt: new Date(), expiryReason: "admin_revoked" },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        companyId: user.companyId,
        entityType: "SupportAccess",
        entityId: access.id,
        action,
        actorId: user.id,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[SUPPORT_REVOKE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
