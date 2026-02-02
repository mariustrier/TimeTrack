import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateInsights } from "@/lib/ai/generate-insights";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const companies = await db.company.findMany();

    for (const company of companies) {
      try {
        await generateInsights(company.id);
      } catch (error) {
        console.error(`[CRON_INSIGHTS] Failed for company ${company.id}:`, error);
      }
    }

    return NextResponse.json({ success: true, processed: companies.length });
  } catch (error) {
    console.error("[CRON_GENERATE_INSIGHTS]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
