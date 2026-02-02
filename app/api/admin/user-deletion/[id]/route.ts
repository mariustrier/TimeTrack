import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targetUser = await db.user.findFirst({
    where: { id: params.id, companyId: user.companyId, deletionRequestedAt: { not: null }, deletedAt: null },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "Not found or no pending request" }, { status: 404 });
  }

  // Anonymize user data
  await db.$transaction([
    // Anonymize user record
    db.user.update({
      where: { id: params.id },
      data: {
        firstName: "Deleted",
        lastName: "User",
        email: `deleted-${params.id}@anonymized.local`,
        imageUrl: null,
        deletedAt: new Date(),
        deletionRequestedAt: null,
        deletionReason: null,
      },
    }),
    // Delete vacation requests
    db.vacationRequest.deleteMany({
      where: { userId: params.id },
    }),
    // Audit log
    db.auditLog.create({
      data: {
        companyId: user.companyId,
        entityType: "User",
        entityId: params.id,
        action: "ACCOUNT_DELETED",
        actorId: user.id,
        metadata: JSON.stringify({ anonymized: true, financialDataRetained: true }),
      },
    }),
  ]);

  return NextResponse.json({ success: true });
}

// Deny deletion
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  if (!body.reason) {
    return NextResponse.json({ error: "Denial reason required" }, { status: 400 });
  }

  const targetUser = await db.user.findFirst({
    where: { id: params.id, companyId: user.companyId, deletionRequestedAt: { not: null }, deletedAt: null },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "Not found or no pending request" }, { status: 404 });
  }

  await db.$transaction([
    db.user.update({
      where: { id: params.id },
      data: { deletionRequestedAt: null, deletionReason: null },
    }),
    db.auditLog.create({
      data: {
        companyId: user.companyId,
        entityType: "User",
        entityId: params.id,
        action: "DELETION_DENIED",
        actorId: user.id,
        metadata: JSON.stringify({ reason: body.reason }),
      },
    }),
  ]);

  return NextResponse.json({ success: true });
}
