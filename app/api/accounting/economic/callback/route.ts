import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/accounting/encryption";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const state = searchParams.get("state");

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://cloudtimer.dk";
    const errorRedirect = `${baseUrl}/billing?tab=settings&error=oauth`;

    if (!token || !state) {
      return NextResponse.redirect(errorRedirect);
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
      return NextResponse.redirect(errorRedirect);
    }

    // Delete used state
    await db.oAuthState.delete({ where: { id: oauthState.id } });

    const appSecretToken = process.env.ECONOMIC_APP_SECRET_TOKEN;
    if (!appSecretToken) {
      return NextResponse.redirect(errorRedirect);
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
      return NextResponse.redirect(`${baseUrl}/billing?tab=settings&error=connection`);
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

    return NextResponse.redirect(`${baseUrl}/billing?tab=settings&connected=e-conomic`);
  } catch (error) {
    console.error("[ECONOMIC_CALLBACK]", error);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://cloudtimer.dk";
    return NextResponse.redirect(`${baseUrl}/billing?tab=settings&error=oauth`);
  }
}
