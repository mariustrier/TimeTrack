import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

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

    const existingUser = await db.user.findUnique({
      where: { clerkId: userId },
    });

    if (existingUser) {
      return NextResponse.json({ user: existingUser });
    }

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
    // Sygdom and Ferie are universal (assigned to all employees)
    // Barns 1. sygedag and Barsel are only for employees with children
    const [sygdomReason, ferieReason] = await Promise.all([
      db.absenceReason.create({
        data: { name: "Sygdom", code: "SICK", isDefault: true, sortOrder: 1, companyId: company.id },
      }),
      db.absenceReason.create({
        data: { name: "Ferie", code: "VACATION", isDefault: true, sortOrder: 4, companyId: company.id },
      }),
    ]);

    // Create child-related reasons (not assigned by default)
    await db.absenceReason.createMany({
      data: [
        { name: "Barns 1. sygedag", code: "CHILD_SICK", isDefault: true, sortOrder: 2, companyId: company.id },
        { name: "Barsel", code: "PARENTAL", isDefault: true, sortOrder: 3, companyId: company.id },
      ],
    });

    // Create user and connect universal absence reasons
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
