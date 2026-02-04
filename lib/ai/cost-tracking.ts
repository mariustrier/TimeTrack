import { db } from "@/lib/db";

const PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 0.1, output: 0.5 },
  "claude-sonnet-4-20250514": { input: 0.3, output: 1.5 },
};

const DAILY_LIMIT_CENTS = 500;
const MONTHLY_LIMIT_CENTS = 5000;

export async function trackUsage(
  companyId: string,
  endpoint: string,
  model: string,
  inputTokens: number,
  outputTokens: number
) {
  const pricing = PRICING[model] ?? { input: 0.3, output: 1.5 };

  const costCents =
    (inputTokens / 1000) * pricing.input +
    (outputTokens / 1000) * pricing.output;

  await db.aIApiUsage.create({
    data: {
      companyId,
      endpoint,
      model,
      inputTokens,
      outputTokens,
      costCents,
    },
  });

  return costCents;
}

export async function checkBudget(companyId: string): Promise<{
  allowed: boolean;
  dailyUsed: number;
  monthlyUsed: number;
  dailyLimit: number;
  monthlyLimit: number;
}> {
  const now = new Date();

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [dailyResult, monthlyResult] = await Promise.all([
    db.aIApiUsage.aggregate({
      where: {
        companyId,
        createdAt: { gte: startOfDay },
      },
      _sum: { costCents: true },
    }),
    db.aIApiUsage.aggregate({
      where: {
        companyId,
        createdAt: { gte: startOfMonth },
      },
      _sum: { costCents: true },
    }),
  ]);

  const dailyUsed = dailyResult._sum.costCents ?? 0;
  const monthlyUsed = monthlyResult._sum.costCents ?? 0;

  return {
    allowed: dailyUsed < DAILY_LIMIT_CENTS && monthlyUsed < MONTHLY_LIMIT_CENTS,
    dailyUsed,
    monthlyUsed,
    dailyLimit: DAILY_LIMIT_CENTS,
    monthlyLimit: MONTHLY_LIMIT_CENTS,
  };
}
