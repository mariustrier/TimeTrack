import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { seedDemoData } from "@/lib/demo-seed";

export async function POST() {
  try {
    const demoId = crypto.randomUUID().slice(0, 8);
    const email = `demo+${demoId}@cloudtimer.dk`;
    const password =
      crypto.randomUUID() + crypto.randomUUID().slice(0, 4).toUpperCase() + "!";

    // 1. Create Clerk user
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.createUser({
      emailAddress: [email],
      password,
      firstName: "Marta",
      lastName: "Krogh",
      publicMetadata: {
        isDemo: true,
        demoCreatedAt: new Date().toISOString(),
      },
      skipPasswordChecks: true,
    });

    // 2. Create Company
    const company = await db.company.create({
      data: {
        name: "Krogh & Partners Arkitekter",
        currency: "DKK",
        isDemo: true,
        demoExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // 3. Create admin User linked to Clerk
    const user = await db.user.create({
      data: {
        clerkId: clerkUser.id,
        email,
        firstName: "Marta",
        lastName: "Krogh",
        role: "admin",
        hourlyRate: 1150,
        costRate: 550,
        weeklyTarget: 37,
        isHourly: false,
        isDemo: true,
        locale: "da",
        companyId: company.id,
        acceptedTermsAt: new Date(),
        tourCompletedAt: new Date(),
        setupTourCompletedAt: new Date(),
      },
    });

    // 4. Seed demo data
    await seedDemoData(company.id, user.id);

    // 5. Create sign-in token
    const signInToken = await clerk.signInTokens.createSignInToken({
      userId: clerkUser.id,
      expiresInSeconds: 300,
    });

    return NextResponse.json({
      success: true,
      token: signInToken.token,
    });
  } catch (error: any) {
    console.error("[DEMO_CREATE]", error);
    return NextResponse.json(
      { error: error.message || "Failed to create demo" },
      { status: 500 }
    );
  }
}
