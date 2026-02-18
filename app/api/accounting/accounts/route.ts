import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, isAdminOrManager } from "@/lib/auth";
import { getAccountingAdapter } from "@/lib/accounting/adapter";
import { decrypt } from "@/lib/accounting/encryption";
import type { AccountingCredentials } from "@/lib/accounting/types";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminOrManager(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const company = await db.company.findUnique({
      where: { id: user.companyId },
      select: { accountingSystem: true, accountingCredentials: true },
    });

    if (!company?.accountingSystem || !company.accountingCredentials) {
      return NextResponse.json({ error: "No accounting system connected" }, { status: 400 });
    }

    const credentials: AccountingCredentials = JSON.parse(decrypt(company.accountingCredentials));
    const adapter = getAccountingAdapter(credentials);
    const accounts = await adapter.listAccounts();

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error("[ACCOUNTING_ACCOUNTS]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
