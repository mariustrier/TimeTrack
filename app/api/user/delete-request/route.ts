import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
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
  } catch (error) {
    console.error("[USER_DELETE_REQUEST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
