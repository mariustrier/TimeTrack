import { NextResponse } from "next/server";
import { cleanupExpiredDemos } from "@/lib/demo-cleanup";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await cleanupExpiredDemos();

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[CRON_CLEANUP_DEMOS]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
