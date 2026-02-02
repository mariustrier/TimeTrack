import { db } from "@/lib/db";
import { getAnthropicClient } from "./client";
import { checkBudget, trackUsage } from "./cost-tracking";

const INSIGHTS_MODEL = "claude-sonnet-4-20250514";

const SYSTEM_PROMPT = `You are a friendly, supportive business advisor for a professional services company. Analyze the provided contract terms and time tracking data to generate helpful insights.

Your tone should be warm and encouraging — like a trusted colleague, not a stern auditor. Use phrases like "Great opportunity", "Worth noting", "Nice work" rather than "WARNING" or "ALERT".

Generate 3-8 insights as a JSON array. Each insight should have:
- category: one of "OPPORTUNITY", "INSIGHT", "SUGGESTION", "HEADS_UP", "CELEBRATION"
- title: short, friendly title (max 60 chars)
- description: 1-2 sentences explaining the insight
- suggestion: optional actionable suggestion
- relatedHours: optional number if related to hours
- relatedAmount: optional number if related to money

Focus on:
- Budget utilization (approaching limits = HEADS_UP, well under = OPPORTUNITY)
- Deadline proximity (upcoming = HEADS_UP)
- Team productivity patterns (good trends = CELEBRATION)
- Scope alignment (time spent matching contract scope = INSIGHT)
- Optimization opportunities (SUGGESTION)

Return ONLY the JSON array, no other text.`;

interface GeneratedInsight {
  category: "OPPORTUNITY" | "INSIGHT" | "SUGGESTION" | "HEADS_UP" | "CELEBRATION";
  title: string;
  description: string;
  suggestion?: string;
  relatedHours?: number;
  relatedAmount?: number;
}

export async function generateInsights(companyId: string) {
  try {
    const budget = await checkBudget(companyId);
    if (!budget.allowed) {
      console.log(
        `[AI] Budget exceeded for company ${companyId}. Daily: ${budget.dailyUsed}/${budget.dailyLimit}, Monthly: ${budget.monthlyUsed}/${budget.monthlyLimit}`
      );
      return null;
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [contracts, recentEntries, teamMembers] = await Promise.all([
      db.contract.findMany({
        where: {
          project: { companyId },
          extractedAt: { not: null },
        },
        include: {
          project: {
            include: {
              timeEntries: {
                where: { date: { gte: thirtyDaysAgo } },
                select: { hours: true },
              },
            },
          },
        },
      }),
      db.timeEntry.findMany({
        where: {
          companyId,
          date: { gte: thirtyDaysAgo },
        },
        include: { project: true },
      }),
      db.user.count({
        where: { companyId },
      }),
    ]);

    const contractSummaries = contracts.map((c) => {
      const hoursUsed = c.project.timeEntries.reduce(
        (sum, e) => sum + e.hours,
        0
      );
      return {
        name: c.project.name,
        maxHours: c.maxHours,
        maxBudget: c.maxBudget,
        deadline: c.deadline?.toISOString() ?? null,
        scope: c.scopeDescription,
        hoursUsed,
      };
    });

    const timeByProject: Record<string, number> = {};
    for (const entry of recentEntries) {
      const projectName = entry.project.name;
      timeByProject[projectName] = (timeByProject[projectName] ?? 0) + entry.hours;
    }

    const summaryData = {
      contracts: contractSummaries,
      recentTimeBreakdown: timeByProject,
      teamSize: teamMembers,
    };

    const client = getAnthropicClient();

    const response = await client.messages.create({
      model: INSIGHTS_MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Here is the current data for analysis:\n\n${JSON.stringify(summaryData, null, 2)}`,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      console.error("[AI] No text response from Claude");
      return null;
    }

    const insights: GeneratedInsight[] = JSON.parse(textBlock.text);

    await db.contractInsight.deleteMany({
      where: {
        companyId,
        dismissed: false,
      },
    });

    const created = await Promise.all(
      insights.map((insight) =>
        db.contractInsight.create({
          data: {
            companyId,
            category: insight.category,
            title: insight.title,
            description: insight.description,
            suggestion: insight.suggestion ?? null,
            relatedHours: insight.relatedHours ?? null,
            relatedAmount: insight.relatedAmount ?? null,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        })
      )
    );

    await trackUsage(
      companyId,
      "generate-insights",
      INSIGHTS_MODEL,
      response.usage.input_tokens,
      response.usage.output_tokens
    );

    return created;
  } catch (error) {
    console.error("[AI] Error generating insights:", error);
    return null;
  }
}
