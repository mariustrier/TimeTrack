import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/accounting/encryption";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    // Read state from secure cookie (set during authorize step)
    const cookieStore = await cookies();
    const state = cookieStore.get("economic_oauth_state")?.value || null;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://cloudtimer.dk";
    const errorRedirect = `${baseUrl}/billing?tab=settings&error=oauth`;

    if (!token || !state) {
      const res = NextResponse.redirect(errorRedirect);
      res.cookies.delete("economic_oauth_state");
      return res;
    }

    // Validate state
    const oauthState = await db.oAuthState.findUnique({
      where: { state },
    });

    if (!oauthState || oauthState.provider !== "e-conomic" || oauthState.expiresAt < new Date()) {
      // Clean up if found but expired
      if (oauthState) {
        await db.oAuthState.delete({ where: { id: oauthState.id } });
      }
      const res = NextResponse.redirect(errorRedirect);
      res.cookies.delete("economic_oauth_state");
      return res;
    }

    // Delete used state and clear cookie
    await db.oAuthState.delete({ where: { id: oauthState.id } });

    const appSecretToken = process.env.ECONOMIC_APP_SECRET_TOKEN;
    if (!appSecretToken) {
      const res = NextResponse.redirect(errorRedirect);
      res.cookies.delete("economic_oauth_state");
      return res;
    }

    // Test the connection before saving
    const testRes = await fetch("https://restapi.e-conomic.com/self", {
      headers: {
        "X-AppSecretToken": appSecretToken,
        "X-AgreementGrantToken": token,
        "Content-Type": "application/json",
      },
    });

    if (!testRes.ok) {
      const res = NextResponse.redirect(`${baseUrl}/billing?tab=settings&error=connection`);
      res.cookies.delete("economic_oauth_state");
      return res;
    }

    // Encrypt and save credentials
    const credentials = {
      system: "e-conomic" as const,
      appSecretToken,
      agreementGrantToken: token,
    };

    const encrypted = encrypt(JSON.stringify(credentials));
    await db.company.update({
      where: { id: oauthState.companyId },
      data: {
        accountingSystem: "e-conomic",
        accountingCredentials: encrypted,
      },
    });

    const res = NextResponse.redirect(`${baseUrl}/billing?tab=settings&connected=e-conomic`);
    res.cookies.delete("economic_oauth_state");
    return res;
  } catch (error) {
    console.error("[ECONOMIC_CALLBACK]", error);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://cloudtimer.dk";
    const res = NextResponse.redirect(`${baseUrl}/billing?tab=settings&error=oauth`);
    res.cookies.delete("economic_oauth_state");
    return res;
  }
}
