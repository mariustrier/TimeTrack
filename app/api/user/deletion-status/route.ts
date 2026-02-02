import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: {
      deletionRequestedAt: true,
      deletionReason: true,
      deletedAt: true,
    },
  });

  if (!dbUser) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Check if there's a denial audit log
  let deniedReason = null;
  if (!dbUser.deletionRequestedAt && !dbUser.deletedAt) {
    const denialLog = await db.auditLog.findFirst({
      where: {
        entityType: "User",
        entityId: user.id,
        action: "DELETION_DENIED",
      },
      orderBy: { createdAt: "desc" },
    });
    if (denialLog && denialLog.metadata) {
      try {
        const meta = JSON.parse(denialLog.metadata);
        deniedReason = meta.reason;
      } catch {}
    }
  }

  return NextResponse.json({
    requested: !!dbUser.deletionRequestedAt,
    requestedAt: dbUser.deletionRequestedAt,
    deleted: !!dbUser.deletedAt,
    denied: !!deniedReason,
    deniedReason,
  });
}
