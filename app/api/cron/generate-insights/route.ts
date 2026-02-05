import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateInsights } from "@/lib/ai/generate-insights";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only generate insights for companies with activity in the last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const companies = await db.company.findMany({
      where: {
        lastActivityAt: {
          gte: twentyFourHoursAgo,
        },
      },
    });

    let processed = 0;
    for (const company of companies) {
      try {
        await generateInsights(company.id);
        processed++;
      } catch (error) {
        console.error(`[CRON_INSIGHTS] Failed for company ${company.id}:`, error);
      }
    }

    return NextResponse.json({ success: true, processed, skipped: 0 });
  } catch (error) {
    console.error("[CRON_GENERATE_INSIGHTS]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
