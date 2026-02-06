import { db } from "@/lib/db";
import { getAnthropicClient } from "./client";
import { checkBudget, trackUsage } from "./cost-tracking";
import { gatherInsightData, InsightDataPackage } from "./insight-data-gatherer";
import { anonymizeInsightData, deanonymizeInsights, AnonymizationMap } from "./anonymize";

const INSIGHTS_MODEL = "claude-sonnet-4-20250514";

const SYSTEM_PROMPT = `You are a friendly, supportive business advisor for a professional services company. Analyze the provided team and project data to generate helpful insights.

Your tone should be warm and encouraging - like a trusted colleague, not a stern auditor. Use phrases like "Great opportunity", "Worth noting", "Nice work" rather than "WARNING" or "ALERT".

## Data You'll Receive

You'll receive structured data about:
- Team members and their weekly targets/utilization
- Workload patterns (overtime, weekend work, underutilization)
- Project status (budget usage, team distribution)
- Vacation schedules and capacity forecasts
- Productivity metrics (billable %, approval backlog)
- Optional: Contract data if available

## Insight Categories

Generate insights using these categories:
- CELEBRATION: Recognize achievements and positive trends
- OPPORTUNITY: Highlight capacity, growth potential, or efficiency gains
- INSIGHT: Provide non-obvious observations from the data
- SUGGESTION: Actionable recommendations for improvement
- HEADS_UP: Early warnings that need attention (not alarmist)

## Guidelines

1. Generate ONLY insights that provide real value - could be 1-2 or up to 8 depending on what's genuinely useful
2. If nothing important to report, it's fine to generate just 1-2 insights or even none
3. Don't pad with filler insights - quality over quantity
4. Prioritize by impact: wellbeing issues > project risks > productivity > celebrations
3. For small teams (1-5 people): Focus on individual patterns and personal workload
4. For larger teams (6+ people): Focus on team-wide patterns and distribution
5. Always include at least one positive insight if the data supports it
6. Be specific: use names, numbers, and dates when relevant
7. Make suggestions actionable and realistic
8. If data is sparse (new company, few entries), acknowledge this and suggest building habits

## DO NOT suggest these (they are unhelpful/obvious):
- "Focus on fewer projects" or "reduce context switching" - multiple projects is normal
- "Track your time more" - they're already using a time tracking app
- "Consider using time tracking" - obviously they already do
- Generic productivity advice that applies to everyone
- Suggestions that require hiring or major business changes

## Key Patterns to Look For

Wellbeing:
- Overwork: >40h/week for 3+ weeks = HEADS_UP
- Underutilization: <70% for 3+ weeks = OPPORTUNITY (available capacity)
- Weekend work: 3+ weekend days/month = HEADS_UP
- Missing time entries = SUGGESTION (gentle reminder)

Team Capacity:
- Uneven workload distribution = SUGGESTION (rebalance)
- Upcoming vacation gaps = HEADS_UP
- Available capacity = OPPORTUNITY

Projects:
- Budget >80% used = HEADS_UP
- Fast burn rate = INSIGHT
- Single-person dependency >80% = HEADS_UP (risk)

Productivity:
- Declining billable % = INSIGHT
- High billable week >85% = CELEBRATION
- Large approval backlog = SUGGESTION

Resource Planning:
- Overbooked users (allocated > capacity) = HEADS_UP with specific names
- Available capacity (users with 50%+ free time) = OPPORTUNITY (suggest projects)
- Understaffed projects (allocation < burn rate) = SUGGESTION (assign more resources)
- Low team utilization forecast = OPPORTUNITY (capacity for new work)
- Allocation gaps = SUGGESTION (fill specific days/weeks)

## Output Format

Return ONLY a JSON array. Each insight:
{
  "category": "OPPORTUNITY" | "INSIGHT" | "SUGGESTION" | "HEADS_UP" | "CELEBRATION",
  "title": "Short, friendly title (max 60 chars)",
  "description": "1-2 sentences explaining the insight",
  "suggestion": "Optional actionable recommendation",
  "relatedHours": Optional number if hours-related,
  "relatedAmount": Optional number if money-related
}`;

const SYSTEM_PROMPT_ANONYMIZED = SYSTEM_PROMPT.replace(
  "6. Be specific: use names, numbers, and dates when relevant",
  "6. Be specific: use the provided identifier labels (Employee A, Project Alpha, etc.) when referencing team members and projects. Use numbers and dates when relevant."
);

interface GeneratedInsight {
  category: "OPPORTUNITY" | "INSIGHT" | "SUGGESTION" | "HEADS_UP" | "CELEBRATION";
  title: string;
  description: string;
  suggestion?: string;
  relatedHours?: number;
  relatedAmount?: number;
}

function buildUserPrompt(data: InsightDataPackage): string {
  const teamSizeContext =
    data.team.members.length <= 5
      ? "This is a small team - focus on individual patterns and personal workload."
      : data.team.members.length <= 15
        ? "This is a medium-sized team - balance individual and team-wide insights."
        : "This is a larger team - focus on team-wide trends and significant outliers.";

  const sections: string[] = [];

  // Company context
  sections.push(`## Company: ${data.company.name}
${teamSizeContext}
Team size: ${data.team.members.length} members
Total weekly capacity: ${data.team.totalCapacityHoursWeekly} hours`);

  // Team members
  if (data.team.members.length > 0) {
    sections.push(`## Team Members
${JSON.stringify(
  data.team.members.map((m) => ({
    name: m.name,
    weeklyTarget: m.weeklyTarget,
    avgHoursLast4Weeks: m.avgHoursLast4Weeks,
    utilizationPercent: m.utilizationPercent,
  })),
  null,
  2
)}`);
  }

  // Workload alerts
  const hasWorkloadIssues =
    data.workloadMetrics.usersOverworked.length > 0 ||
    data.workloadMetrics.usersUnderutilized.length > 0 ||
    data.workloadMetrics.weekendWorkers.length > 0;

  if (hasWorkloadIssues) {
    sections.push(`## Workload Alerts
${data.workloadMetrics.usersOverworked.length > 0 ? `Overworked (>40h/week, 3+ weeks): ${JSON.stringify(data.workloadMetrics.usersOverworked)}` : ""}
${data.workloadMetrics.usersUnderutilized.length > 0 ? `Underutilized (<70%): ${JSON.stringify(data.workloadMetrics.usersUnderutilized)}` : ""}
${data.workloadMetrics.weekendWorkers.length > 0 ? `Weekend workers (3+ days this month): ${JSON.stringify(data.workloadMetrics.weekendWorkers)}` : ""}`);
  }

  // Vacations
  if (data.vacations.upcoming.length > 0 || data.vacations.capacityReductions.length > 0) {
    sections.push(`## Upcoming Vacations & Capacity
${data.vacations.upcoming.length > 0 ? `Upcoming: ${JSON.stringify(data.vacations.upcoming)}` : "No upcoming vacations"}
${data.vacations.capacityReductions.length > 0 ? `Reduced capacity days: ${JSON.stringify(data.vacations.capacityReductions)}` : ""}`);
  }

  // Projects
  if (data.projects.active.length > 0) {
    const projectsWithBudget = data.projects.active.filter((p) => p.budgetHours);
    const projectsSummary = data.projects.active.map((p) => ({
      name: p.name,
      budgetHours: p.budgetHours,
      hoursUsed: p.hoursUsed,
      percentUsed: p.percentUsed,
      weeklyBurnRate: p.weeklyBurnRate,
      teamSize: p.teamMembers.length,
    }));

    sections.push(`## Active Projects (${data.projects.active.length})
${JSON.stringify(projectsSummary, null, 2)}
${data.projects.singlePersonRisks.length > 0 ? `\nSingle-person dependency risks: ${JSON.stringify(data.projects.singlePersonRisks)}` : ""}`);
  }

  // Productivity
  sections.push(`## Productivity Metrics
Pending approvals: ${data.productivity.pendingApprovals}
${data.productivity.usersWithEntryGaps.length > 0 ? `Users with entry gaps (missed 3+ of last 5 days): ${JSON.stringify(data.productivity.usersWithEntryGaps)}` : ""}
${data.productivity.billablePercentByWeek.length > 0 ? `Billable % trend (last 4 weeks): ${JSON.stringify(data.productivity.billablePercentByWeek.slice(-4))}` : ""}`);

  // Contracts (optional)
  if (data.contracts.length > 0) {
    sections.push(`## Contracts (${data.contracts.length})
${JSON.stringify(data.contracts, null, 2)}`);
  }

  // Resource Planning
  const hasResourcePlanningData =
    data.resourcePlanning.allocations.length > 0 ||
    data.resourcePlanning.unassignedUsers.length > 0 ||
    data.resourcePlanning.understaffedProjects.length > 0;

  if (hasResourcePlanningData) {
    const resourcePlanningParts: string[] = [];

    if (data.resourcePlanning.allocations.length > 0) {
      resourcePlanningParts.push(`Current allocations (next 4 weeks): ${JSON.stringify(data.resourcePlanning.allocations.slice(0, 20))}`);
    }

    if (data.resourcePlanning.capacityForecast.length > 0) {
      resourcePlanningParts.push(`Capacity forecast issues: ${JSON.stringify(data.resourcePlanning.capacityForecast)}`);
    }

    if (data.resourcePlanning.unassignedUsers.length > 0) {
      resourcePlanningParts.push(`Users with available capacity this week: ${JSON.stringify(data.resourcePlanning.unassignedUsers)}`);
    }

    if (data.resourcePlanning.understaffedProjects.length > 0) {
      resourcePlanningParts.push(`Projects needing more resources: ${JSON.stringify(data.resourcePlanning.understaffedProjects)}`);
    }

    sections.push(`## Resource Planning
${resourcePlanningParts.join("\n")}`);
  }

  return sections.join("\n\n");
}

export async function generateInsights(companyId: string) {
  try {
    // 1. Check budget
    const budget = await checkBudget(companyId);
    if (!budget.allowed) {
      console.log(
        `[AI] Budget exceeded for company ${companyId}. Daily: ${budget.dailyUsed}/${budget.dailyLimit}, Monthly: ${budget.monthlyUsed}/${budget.monthlyLimit}`
      );
      return null;
    }

    // 2. Gather comprehensive data
    const data = await gatherInsightData(companyId);

    // 3. Skip if no team members
    if (data.team.members.length === 0) {
      console.log(`[AI] No team members for company ${companyId}`);
      return null;
    }

    // 3b. Check if anonymization is enabled
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { aiAnonymization: true },
    });
    const shouldAnonymize = company?.aiAnonymization ?? true;

    // 4. Conditionally anonymize data before building prompt
    let promptData = data;
    let anonMap: AnonymizationMap | null = null;
    if (shouldAnonymize) {
      const result = anonymizeInsightData(data);
      promptData = result.anonymizedData;
      anonMap = result.map;
    }

    const userPrompt = buildUserPrompt(promptData);

    // 5. Call Claude
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: INSIGHTS_MODEL,
      max_tokens: 2048,
      system: shouldAnonymize ? SYSTEM_PROMPT_ANONYMIZED : SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    // 6. Parse response
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      console.error("[AI] No text response from Claude");
      return null;
    }

    let insights: GeneratedInsight[];
    try {
      // Strip markdown code blocks if present
      let jsonText = textBlock.text.trim();
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      insights = JSON.parse(jsonText);
    } catch {
      console.error("[AI] Failed to parse insights JSON:", textBlock.text);
      return null;
    }

    // 6b. De-anonymize insights if anonymization was applied
    if (shouldAnonymize && anonMap) {
      insights = deanonymizeInsights(insights, anonMap);
    }

    // 7. Clear old non-dismissed insights and store new ones
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
            contractId: null,
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

    // 8. Track usage
    await trackUsage(
      companyId,
      "generate-insights",
      INSIGHTS_MODEL,
      response.usage.input_tokens,
      response.usage.output_tokens
    );

    console.log(
      `[AI] Generated ${created.length} insights for company ${companyId}`
    );

    return created;
  } catch (error) {
    console.error("[AI] Error generating insights:", error);
    return null;
  }
}
