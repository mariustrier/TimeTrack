import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  await db.user.update({
    where: { id: user.id },
    data: {
      deletionRequestedAt: new Date(),
      deletionReason: body.reason || null,
    },
  });

  return NextResponse.json({ success: true });
}
