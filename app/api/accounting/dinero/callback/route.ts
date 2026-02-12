import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/accounting/encryption";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://cloudtimer.dk";
    const errorRedirect = `${baseUrl}/billing?tab=settings&error=oauth`;

    // User denied access
    if (error) {
      return NextResponse.redirect(`${baseUrl}/billing?tab=settings&error=denied`);
    }

    if (!code || !state) {
      return NextResponse.redirect(errorRedirect);
    }

    // Validate state
    const oauthState = await db.oAuthState.findUnique({
      where: { state },
    });

    if (!oauthState || oauthState.provider !== "dinero" || oauthState.expiresAt < new Date()) {
      if (oauthState) {
        await db.oAuthState.delete({ where: { id: oauthState.id } });
      }
      return NextResponse.redirect(errorRedirect);
    }

    // Delete used state
    await db.oAuthState.delete({ where: { id: oauthState.id } });

    const clientId = process.env.DINERO_CLIENT_ID;
    const clientSecret = process.env.DINERO_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return NextResponse.redirect(errorRedirect);
    }

    const redirectUri = `${baseUrl}/api/accounting/dinero/callback`;

    // Exchange code for tokens
    const tokenRes = await fetch("https://connect.visma.com/connect/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      console.error("[DINERO_CALLBACK] Token exchange failed:", tokenRes.status);
      return NextResponse.redirect(`${baseUrl}/billing?tab=settings&error=token`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in || 3600;
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Fetch organizations to get the organizationId
    const orgsRes = await fetch("https://api.dinero.dk/v1/organizations", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    let organizationId = "";
    if (orgsRes.ok) {
      const orgsData = await orgsRes.json();
      // Use the first organization (most users have one)
      if (Array.isArray(orgsData) && orgsData.length > 0) {
        organizationId = String(orgsData[0].id || orgsData[0].organizationId || "");
      }
    }

    if (!organizationId) {
      console.error("[DINERO_CALLBACK] Could not determine organization ID");
      return NextResponse.redirect(`${baseUrl}/billing?tab=settings&error=organization`);
    }

    // Encrypt and save credentials
    const credentials = {
      system: "dinero" as const,
      accessToken,
      refreshToken,
      tokenExpiresAt,
      organizationId,
      clientId,
      clientSecret,
    };

    const encrypted = encrypt(JSON.stringify(credentials));
    await db.company.update({
      where: { id: oauthState.companyId },
      data: {
        accountingSystem: "dinero",
        accountingCredentials: encrypted,
      },
    });

    return NextResponse.redirect(`${baseUrl}/billing?tab=settings&connected=dinero`);
  } catch (error) {
    console.error("[DINERO_CALLBACK]", error);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://cloudtimer.dk";
    return NextResponse.redirect(`${baseUrl}/billing?tab=settings&error=oauth`);
  }
}
