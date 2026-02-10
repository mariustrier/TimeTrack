import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { supportAccessActionSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  try {
    const user = await requireSuperAdmin();
    const body = await req.json();
    const result = validate(supportAccessActionSchema, body);
    if (!result.success) return result.response;

    const access = await db.supportAccess.findUnique({
      where: { id: result.data.supportAccessId },
    });

    if (!access || access.requestedBy !== user.id) {
      return NextResponse.json({ error: "Access not found" }, { status: 404 });
    }

    if (access.status !== "granted") {
      return NextResponse.json({ error: "Access not granted" }, { status: 400 });
    }

    const updated = await db.supportAccess.update({
      where: { id: access.id },
      data: { status: "active", activatedAt: new Date() },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        companyId: access.companyId,
        entityType: "SupportAccess",
        entityId: access.id,
        action: "SUPPORT_ENTER",
        actorId: user.id,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[SUPPORT_ENTER]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
