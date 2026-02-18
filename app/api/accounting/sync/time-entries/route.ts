import { NextResponse } from "next/server";
import { getAuthUser, isAdminOrManager } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { syncRequestSchema } from "@/lib/schemas";
import { pushApprovedTimeEntries } from "@/lib/accounting/sync";

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminOrManager(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const result = validate(syncRequestSchema, body);
    if (!result.success) return result.response;

    const summary = await pushApprovedTimeEntries(
      user.companyId,
      user.id,
      result.data.entryIds
    );

    return NextResponse.json(summary);
  } catch (error) {
    console.error("[SYNC_TIME_ENTRIES]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
