import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, isAdminOrManager } from "@/lib/auth";
import crypto from "crypto";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminOrManager(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const clientId = process.env.DINERO_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json({ error: "Dinero app not configured" }, { status: 500 });
    }

    // Generate state token for CSRF protection
    const state = crypto.randomBytes(32).toString("hex");
    await db.oAuthState.create({
      data: {
        state,
        companyId: user.companyId,
        provider: "dinero",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
    });

    // Clean up expired states
    await db.oAuthState.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://cloudtimer.dk";
    const redirectUri = `${baseUrl}/api/accounting/dinero/callback`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "dineropublicapi:read dineropublicapi:write offline_access",
      state,
    });

    const url = `https://connect.visma.com/connect/authorize?${params.toString()}`;

    return NextResponse.json({ url });
  } catch (error) {
    console.error("[DINERO_AUTHORIZE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
