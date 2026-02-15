import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function POST() {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { clerkId: userId },
      include: { company: { select: { id: true, isDemo: true } } },
    });

    if (!user || !user.company?.isDemo) {
      return NextResponse.json({ error: "Not a demo account" }, { status: 403 });
    }

    await db.company.update({
      where: { id: user.company.id },
      data: { demoExpiresAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[DEMO_EXIT]", error);
    return NextResponse.json(
      { error: error.message || "Failed to exit demo" },
      { status: 500 }
    );
  }
}
