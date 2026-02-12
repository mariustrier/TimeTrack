import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, isAdminOrManager } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { updateCompanyBillingSchema, accountingCredentialsSchema } from "@/lib/schemas";
import { encrypt } from "@/lib/accounting/encryption";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminOrManager(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const company = await db.company.findUnique({
      where: { id: user.companyId },
      select: {
        companyAddress: true,
        companyCvr: true,
        companyBankAccount: true,
        companyBankReg: true,
        defaultPaymentDays: true,
        invoiceFooterNote: true,
        invoicePrefix: true,
        accountingSystem: true,
        nextInvoiceNumber: true,
        name: true,
      },
    });

    return NextResponse.json(company);
  } catch (error) {
    console.error("[BILLING_SETTINGS_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminOrManager(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();

    // Handle accounting credentials separately
    if (body.accountingCredentials) {
      const credResult = validate(accountingCredentialsSchema, body.accountingCredentials);
      if (!credResult.success) return credResult.response;
      const encrypted = encrypt(JSON.stringify(credResult.data));
      await db.company.update({
        where: { id: user.companyId },
        data: {
          accountingSystem: credResult.data.system,
          accountingCredentials: encrypted,
        },
      });
    }

    // Handle disconnect: clearing accountingSystem also clears credentials
    if (body.accountingSystem === null) {
      await db.company.update({
        where: { id: user.companyId },
        data: {
          accountingSystem: null,
          accountingCredentials: null,
        },
      });
    }

    // Handle billing settings
    const settingsBody = { ...body };
    delete settingsBody.accountingCredentials;

    if (Object.keys(settingsBody).length > 0) {
      const result = validate(updateCompanyBillingSchema, settingsBody);
      if (!result.success) return result.response;

      await db.company.update({
        where: { id: user.companyId },
        data: result.data,
      });
    }

    // Return updated settings
    const updated = await db.company.findUnique({
      where: { id: user.companyId },
      select: {
        companyAddress: true,
        companyCvr: true,
        companyBankAccount: true,
        companyBankReg: true,
        defaultPaymentDays: true,
        invoiceFooterNote: true,
        invoicePrefix: true,
        accountingSystem: true,
        nextInvoiceNumber: true,
        name: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[BILLING_SETTINGS_PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
