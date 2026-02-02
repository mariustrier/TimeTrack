import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json().catch(() => ({}));

    if (body.reset) {
      await db.user.update({
        where: { id: user.id },
        data: { tourCompletedAt: null },
      });
      return NextResponse.json({ success: true, reset: true });
    }

    await db.user.update({
      where: { id: user.id },
      data: { tourCompletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
