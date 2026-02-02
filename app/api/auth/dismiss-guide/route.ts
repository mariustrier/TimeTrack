import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const { pageId } = await request.json();

    if (!pageId || typeof pageId !== "string") {
      return NextResponse.json({ error: "pageId required" }, { status: 400 });
    }

    // Only add if not already dismissed
    if (!user.dismissedGuides.includes(pageId)) {
      await db.user.update({
        where: { id: user.id },
        data: {
          dismissedGuides: { push: pageId },
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
