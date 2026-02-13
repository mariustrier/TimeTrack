import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const company = await db.company.findUnique({
      where: { id: user.companyId },
      select: {
        currency: true,
        defaultHourlyRate: true,
        useUniversalRate: true,
        economicRevenueAccount: true,
        economicCounterAccount: true,
        economicVatCode: true,
        economicCurrency: true,
        expenseAutoApproveThreshold: true,
        aiAnonymization: true,
        logoUrl: true,
        phasesEnabled: true,
        flexStartDate: true,
      },
    });

    return NextResponse.json(company);
  } catch (error) {
    console.error("[ECONOMIC_SETTINGS_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { currency, defaultHourlyRate, useUniversalRate, economicRevenueAccount, economicCounterAccount, economicVatCode, economicCurrency, expenseAutoApproveThreshold, aiAnonymization } = body;

    const data: Record<string, unknown> = {
      defaultHourlyRate: defaultHourlyRate ? parseFloat(defaultHourlyRate) : null,
      economicRevenueAccount: economicRevenueAccount || null,
      economicCounterAccount: economicCounterAccount || null,
      economicVatCode: economicVatCode || null,
      economicCurrency: economicCurrency || "DKK",
    };

    if (currency !== undefined) {
      data.currency = currency || "USD";
    }
    if (useUniversalRate !== undefined) {
      data.useUniversalRate = !!useUniversalRate;
    }
    if (expenseAutoApproveThreshold !== undefined) {
      data.expenseAutoApproveThreshold = expenseAutoApproveThreshold !== null ? parseFloat(expenseAutoApproveThreshold) : null;
    }
    if (aiAnonymization !== undefined) {
      data.aiAnonymization = !!aiAnonymization;
    }
    if (body.phasesEnabled !== undefined) {
      data.phasesEnabled = !!body.phasesEnabled;

      // When enabling phases for the first time, create 4 default phases
      if (body.phasesEnabled) {
        const existingPhases = await db.phase.count({
          where: { companyId: user.companyId },
        });
        if (existingPhases === 0) {
          await db.phase.createMany({
            data: [
              { name: "Phase 1", sortOrder: 1, companyId: user.companyId },
              { name: "Phase 2", sortOrder: 2, companyId: user.companyId },
              { name: "Phase 3", sortOrder: 3, companyId: user.companyId },
              { name: "Phase 4", sortOrder: 4, companyId: user.companyId },
            ],
          });
        }
      }
    }
    if (body.flexStartDate !== undefined) {
      data.flexStartDate = body.flexStartDate ? new Date(body.flexStartDate) : null;
    }

    const company = await db.company.update({
      where: { id: user.companyId },
      data,
      select: {
        currency: true,
        defaultHourlyRate: true,
        useUniversalRate: true,
        economicRevenueAccount: true,
        economicCounterAccount: true,
        economicVatCode: true,
        economicCurrency: true,
        expenseAutoApproveThreshold: true,
        aiAnonymization: true,
        phasesEnabled: true,
        flexStartDate: true,
      },
    });

    return NextResponse.json(company);
  } catch (error) {
    console.error("[ECONOMIC_SETTINGS_PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
