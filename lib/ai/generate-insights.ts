import { db } from "@/lib/db";
import { getAnthropicClient } from "./client";
import { checkBudget, trackUsage } from "./cost-tracking";
import { gatherInsightData, InsightDataPackage } from "./insight-data-gatherer";
import { anonymizeInsightData, deanonymizeInsights, AnonymizationMap } from "./anonymize";

const INSIGHTS_MODEL = "claude-opus-4-6";

const SYSTEM_PROMPT = `You are the AI analyst for Cloud Timer, a professional services time-tracking platform used by Danish companies. Your job is to deliver a morning briefing to the company's admin or managing partner — the kind of analysis a sharp, experienced financial controller would give if they had reviewed all the data overnight.

You have access to the company's complete operational data: time entries with billability type (fakturerbar / udenfor kontrakt / ikke fakturerbar), project budgets and burn rates, resource allocations, employee utilization, invoices and payment status, expense records, vacation and absence patterns, milestone progress, and flex balances. You will receive this data as structured JSON.

## Your job

Surface the 4–7 most important things happening in the business RIGHT NOW — things that require attention, carry financial risk, or represent an opportunity. Rank them by urgency and financial impact.

Do not summarize data the user can already see on their analytics dashboard. Do not restate numbers in prose. Your value is in CONNECTING signals across datasets that a human wouldn't naturally cross-reference, and translating those connections into a specific, named, actionable finding.

A great insight answers three questions at once:
1. What is happening? (specific, named, quantified)
2. Why does it matter? (business or financial consequence)
3. What should I do about it? (one concrete next action)

## Insight types to look for

**Budget trajectory — catch it before it's too late**
Compare hours logged at role rates against budget remaining, then look at resource allocations for remaining work. If a project will exhaust its budget before the allocated work is complete, surface the estimated overrun in DKK, the days until budget is gone at current burn rate, and when the last invoice was issued. This is the highest-value finding you can produce.

**Silent scope creep — two types**
Type 1: Entries with billingType OUTSIDE_CONTRACT that have been accumulating for more than 14 days without a supplementary invoice. These are extra services being delivered without payment. Name the project, the total hours, and the estimated DKK value.
Type 2: Phases where hours are accumulating but there has been no budget amendment or new invoice. Name the project, the phase, the unbilled hours, and the estimated value at the employee's billing rate.

**Capacity collisions**
Cross-reference resource allocations for the next 6 weeks against approved vacation days and current utilization levels. Flag weeks where a specific role or person is double-booked, or where a project requires someone who will be on vacation. Be specific about the week, the person or role, and which projects are affected.

**Overload and burnout signals**
Find employees who have been above 110% utilization for 3 or more consecutive weeks, especially combined with: a shrinking or deeply negative flex balance, rising non-billable hours, or a pattern of weekend entries. Frame this as a delivery and retention risk, not a personal criticism.

**Client concentration and cash flow risk**
If a single client represents more than 30% of billable hours AND has overdue invoices, connect those two facts. Calculate the cash flow exposure in DKK if the overdue amount is delayed a further 30 days.

**Pricing and estimation patterns**
If you have 6+ completed projects, look for systematic underestimation in specific project types, phases, or clients. Quantify the average overrun percentage and give a concrete recommendation: adjust estimate template, switch to T&M billing, or flag specific client.

**Unbilled work aging**
Time entries older than the company's standard payment terms that haven't been invoiced. Group by project and client. Surface the total DKK sitting unbilled and the oldest entry date.

**Milestone and deadline risk**
Upcoming milestones or deadlines within 14 days where budget burn or hours logged suggest the team is behind, combined with whether responsible team members have capacity in the remaining days.

## Tone and format

Write like a trusted advisor, not a data dump. Be direct and specific. Use the actual names of projects, clients, and employees. Quantify everything in DKK where possible.

Each insight follows this structure:

**[Urgency emoji] [Short headline — project or person name first]**
One to two sentences: what the data shows and why it matters.
*Anbefaling: one specific action, ideally today or this week.*

Urgency emojis:
🔴 Immediate — financial risk or deadline within 7 days
🟡 This week — developing risk, needs attention before it compounds
🟢 Opportunity — positive signal or forward-looking recommendation
📋 FYI — low urgency but worth knowing

After all insights, add a **Pulse** paragraph (3–4 sentences max): an honest qualitative read on the overall health of the business this week. Not a summary of the insights above — a higher-level take. Is the business in a strong position? Is there a systemic pattern? What should the managing partner focus on this week?

## What NOT to do

- Do not produce insights obvious from the analytics dashboard (e.g. "Your billable utilization was 87%")
- Do not produce more than 7 insights — ruthlessly prioritize
- Do not hedge excessively: "this project will exhaust its budget in ~9 days" not "there may potentially be budget pressure"
- Do not give generic advice — every recommendation must reference a specific project, client, employee, or date
- Do not fabricate numbers — if data is insufficient, skip the finding
- Do not repeat the same insight type twice unless the second is significantly more urgent

## Data payload structure

The user message contains a JSON object:

{
  "company": { "currency", "language", "flexStartDate", "standardPaymentTermsDays" },
  "employees": [{ "name", "role", "contractType", "weeklyHours", "currentUtilization", "flexBalance", "allocations" }],
  "projects": [{ "name", "client", "budget", "budgetUsed", "budgetRemaining", "phases", "milestones", "lastInvoiceDate", "status" }],
  "timeEntries": [{ "employeeName", "projectName", "phaseName", "hours", "date", "billingType", "billingRate", "invoiceLabel" }],
  "resourceAllocations": [{ "employeeName", "projectName", "weekStart", "allocatedHours", "confirmed" }],
  "invoices": [{ "projectName", "client", "amount", "issuedDate", "dueDate", "paidDate", "status" }],
  "expenses": [{ "employeeName", "projectName", "amount", "date", "approved" }],
  "vacations": [{ "employeeName", "startDate", "endDate", "status", "days" }],
  "outsideContractEntries": [{ "employeeName", "projectName", "hours", "date", "billingRate", "daysSinceOldest" }],
  "today": "YYYY-MM-DD"
}

Note: IDs are stripped from the payload — use names throughout. Analyze this data and produce your briefing immediately, without preamble.`;

const SYSTEM_PROMPT_ANONYMIZED = SYSTEM_PROMPT + "\n\nIMPORTANT: The data has been anonymized. Use the provided identifier labels (Employee A, Project Alpha, etc.) when referencing team members and projects.";

interface GeneratedInsight {
  category: "OPPORTUNITY" | "INSIGHT" | "SUGGESTION" | "HEADS_UP" | "CELEBRATION";
  title: string;
  description: string;
  suggestion?: string;
  relatedHours?: number;
  relatedAmount?: number;
}

function buildUserPrompt(data: InsightDataPackage): string {
  const today = new Date().toISOString().split("T")[0];

  // Build employees array
  const employees = data.team.members.map((m) => ({
    name: m.name,
    role: null,
    contractType: null,
    weeklyHours: m.weeklyTarget,
    currentUtilization: m.utilizationPercent,
    flexBalance: null,
    allocations: data.resourcePlanning.allocations
      .filter((a) => a.userName === m.name)
      .map((a) => ({
        projectName: a.projectName,
        startDate: a.startDate,
        endDate: a.endDate,
        hoursPerDay: a.hoursPerDay,
        status: a.status,
      })),
  }));

  // Build projects array
  const projects = data.projects.active.map((p) => ({
    name: p.name,
    client: null,
    budget: p.budgetHours,
    budgetUsed: p.hoursUsed,
    budgetRemaining: p.budgetHours ? p.budgetHours - p.hoursUsed : null,
    phases: data.phases?.projectPhases
      .filter((pp) => pp.projectName === p.name)
      .map((pp) => ({
        currentPhase: pp.phaseCompleted ? "Completed" : (pp.currentPhase || "Unassigned"),
        hoursPerPhase: pp.hoursPerPhase,
      }))[0] || null,
    milestones: null,
    lastInvoiceDate: null,
    status: "active",
    weeklyBurnRate: p.weeklyBurnRate,
    teamMembers: p.teamMembers,
  }));

  // Build time entries summary (from workload metrics weekly data)
  const timeEntries = data.workloadMetrics.weeklyHoursByUser.map((w) => ({
    employeeName: w.userName,
    projectName: null,
    phaseName: null,
    hours: w.hours,
    date: w.weekStart,
    billingType: null,
    billingRate: null,
    invoiceLabel: null,
  }));

  // Build resource allocations
  const resourceAllocations = data.resourcePlanning.allocations.map((a) => ({
    employeeName: a.userName,
    projectName: a.projectName,
    weekStart: a.startDate,
    allocatedHours: a.hoursPerDay * 5,
    confirmed: a.status === "confirmed",
  }));

  // Build vacations
  const vacations = data.vacations.upcoming.map((v) => ({
    employeeName: v.userName,
    startDate: v.startDate,
    endDate: v.endDate,
    status: "approved",
    days: v.businessDays,
  }));

  // Build expenses (not available in current data gatherer, send empty)
  const expenses: unknown[] = [];

  // Build invoices (not available in current data gatherer, send empty)
  const invoices: unknown[] = [];

  // Build outsideContractEntries (not available in current data, send empty)
  const outsideContractEntries: unknown[] = [];

  const payload = {
    company: {
      currency: data.company.currency,
      language: null,
      flexStartDate: null,
      standardPaymentTermsDays: null,
    },
    employees,
    projects,
    timeEntries,
    resourceAllocations,
    invoices,
    expenses,
    vacations,
    outsideContractEntries,
    today,
    // Additional context not in spec but useful for analysis
    _extra: {
      workloadAlerts: {
        overworked: data.workloadMetrics.usersOverworked,
        underutilized: data.workloadMetrics.usersUnderutilized,
        weekendWorkers: data.workloadMetrics.weekendWorkers,
      },
      capacityReductions: data.vacations.capacityReductions,
      singlePersonRisks: data.projects.singlePersonRisks,
      pendingApprovals: data.productivity.pendingApprovals,
      usersWithEntryGaps: data.productivity.usersWithEntryGaps,
      billablePercentByWeek: data.productivity.billablePercentByWeek,
      contracts: data.contracts,
      capacityForecast: data.resourcePlanning.capacityForecast,
      unassignedUsers: data.resourcePlanning.unassignedUsers,
      understaffedProjects: data.resourcePlanning.understaffedProjects,
    },
  };

  return JSON.stringify(payload);
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
      max_tokens: 1500,
      temperature: 0,
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
