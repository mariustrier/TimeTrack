import { NextResponse } from "next/server";
import { getAuthUser, isAdminOrManager } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { accountingCredentialsSchema } from "@/lib/schemas";
import { getAccountingAdapter } from "@/lib/accounting/adapter";
import type { AccountingCredentials } from "@/lib/accounting/types";

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminOrManager(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const result = validate(accountingCredentialsSchema, body);
    if (!result.success) return result.response;

    const credentials = result.data as AccountingCredentials;
    const adapter = getAccountingAdapter(credentials);
    const testResult = await adapter.testConnection();

    return NextResponse.json(testResult);
  } catch (error) {
    console.error("[ACCOUNTING_TEST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
