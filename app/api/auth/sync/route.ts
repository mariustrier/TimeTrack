import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seedDefaultRoles } from "@/lib/seed-roles";

export async function POST(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 1. Check if user already exists with this Clerk ID
    const existingUser = await db.user.findUnique({
      where: { clerkId: userId },
    });

    if (existingUser) {
      if (existingUser.deletedAt) {
        return NextResponse.json({ error: "Account has been deactivated" }, { status: 403 });
      }
      return NextResponse.json({ user: existingUser });
    }

    // 2. Check if there's a pending invitation for this email
    const email = (clerkUser.emailAddresses[0]?.emailAddress || "").toLowerCase();
    if (email) {
      const pendingUser = await db.user.findFirst({
        where: {
          email,
          clerkId: { startsWith: "pending_" },
          deletedAt: null,
        },
      });

      if (pendingUser) {
        // Claim the pending user record
        const updatedUser = await db.user.update({
          where: { id: pendingUser.id },
          data: {
            clerkId: userId,
            firstName: clerkUser.firstName || pendingUser.firstName,
            lastName: clerkUser.lastName || pendingUser.lastName,
            imageUrl: clerkUser.imageUrl || null,
          },
        });

        return NextResponse.json({ user: updatedUser, wasPending: true });
      }
    }

    // 3. No existing user and no pending invitation — create new company
    const body = await req.json();
    const { companyName, currency } = body;

    if (!companyName) {
      return NextResponse.json(
        { error: "Company name is required" },
        { status: 400 }
      );
    }

    const company = await db.company.create({
      data: {
        name: companyName,
        currency: currency || "USD",
      },
    });

    // Seed 7 default roles
    await seedDefaultRoles(company.id);

    // Create system-managed Absence project
    await db.project.create({
      data: {
        name: "Absence",
        color: "#9CA3AF",
        billable: false,
        systemType: "absence",
        systemManaged: true,
        companyId: company.id,
      },
    });

    // Create default absence reasons
    const [sygdomReason, ferieReason] = await Promise.all([
      db.absenceReason.create({
        data: { name: "Sygdom", code: "SICK", isDefault: true, sortOrder: 1, companyId: company.id },
      }),
      db.absenceReason.create({
        data: { name: "Ferie", code: "VACATION", isDefault: true, sortOrder: 4, companyId: company.id },
      }),
    ]);

    await db.absenceReason.createMany({
      data: [
        { name: "Barns 1. sygedag", code: "CHILD_SICK", isDefault: true, sortOrder: 2, companyId: company.id },
        { name: "Barsel", code: "PARENTAL", isDefault: true, sortOrder: 3, companyId: company.id },
      ],
    });

    const user = await db.user.create({
      data: {
        clerkId: userId,
        email: clerkUser.emailAddresses[0]?.emailAddress || "",
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        imageUrl: clerkUser.imageUrl,
        role: "admin",
        companyId: company.id,
        absenceReasons: {
          connect: [
            { id: sygdomReason.id },
            { id: ferieReason.id },
          ],
        },
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("[AUTH_SYNC]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
