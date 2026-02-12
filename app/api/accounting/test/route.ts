import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, isAdminOrManager } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { accountingCredentialsSchema } from "@/lib/schemas";
import { getAccountingAdapter } from "@/lib/accounting/adapter";
import { decrypt } from "@/lib/accounting/encryption";
import type { AccountingCredentials } from "@/lib/accounting/types";

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminOrManager(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();

    let credentials: AccountingCredentials;

    // If only system is provided (no tokens), use saved credentials from DB
    const hasManualCredentials = body.accessToken || body.appSecretToken || body.agreementGrantToken || body.clientId;
    if (body.system && !hasManualCredentials) {
      const company = await db.company.findUnique({
        where: { id: user.companyId },
        select: { accountingCredentials: true, accountingSystem: true },
      });

      if (!company?.accountingCredentials || company.accountingSystem !== body.system) {
        return NextResponse.json({ ok: false, error: "No saved credentials for this system" });
      }

      const decrypted = decrypt(company.accountingCredentials);
      credentials = JSON.parse(decrypted) as AccountingCredentials;
    } else {
      const result = validate(accountingCredentialsSchema, body);
      if (!result.success) return result.response;
      credentials = result.data as AccountingCredentials;
    }

    const adapter = getAccountingAdapter(credentials);
    const testResult = await adapter.testConnection();

    return NextResponse.json(testResult);
  } catch (error) {
    console.error("[ACCOUNTING_TEST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
