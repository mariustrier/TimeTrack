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
        economicRevenueAccount: true,
        economicCounterAccount: true,
        economicVatCode: true,
        economicCurrency: true,
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
    const { currency, economicRevenueAccount, economicCounterAccount, economicVatCode, economicCurrency } = body;

    const data: Record<string, unknown> = {
      economicRevenueAccount: economicRevenueAccount || null,
      economicCounterAccount: economicCounterAccount || null,
      economicVatCode: economicVatCode || null,
      economicCurrency: economicCurrency || "DKK",
    };

    if (currency !== undefined) {
      data.currency = currency || "USD";
    }

    const company = await db.company.update({
      where: { id: user.companyId },
      data,
      select: {
        currency: true,
        economicRevenueAccount: true,
        economicCounterAccount: true,
        economicVatCode: true,
        economicCurrency: true,
      },
    });

    return NextResponse.json(company);
  } catch (error) {
    console.error("[ECONOMIC_SETTINGS_PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
