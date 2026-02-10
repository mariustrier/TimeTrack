import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { supportAccessRequestSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  try {
    const user = await requireSuperAdmin();
    const body = await req.json();
    const result = validate(supportAccessRequestSchema, body);
    if (!result.success) return result.response;
    const { companyId } = result.data;

    // Can't request access to own company
    if (companyId === user.companyId) {
      return NextResponse.json({ error: "Cannot request access to your own company" }, { status: 400 });
    }

    // Check company exists
    const company = await db.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Check no active/pending/granted session exists
    const existing = await db.supportAccess.findFirst({
      where: {
        requestedBy: user.id,
        status: { in: ["pending", "granted", "active"] },
      },
    });
    if (existing) {
      return NextResponse.json({ error: "You already have an active support session" }, { status: 409 });
    }

    const access = await db.supportAccess.create({
      data: {
        companyId,
        requestedBy: user.id,
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        companyId,
        entityType: "SupportAccess",
        entityId: access.id,
        action: "SUPPORT_REQUEST",
        actorId: user.id,
      },
    });

    return NextResponse.json(access);
  } catch (error: any) {
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[SUPPORT_REQUEST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
