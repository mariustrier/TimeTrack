import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, isAdminOrManager } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdminOrManager(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const members = await db.user.findMany({
      where: { companyId: user.companyId },
      orderBy: { firstName: "asc" },
    });

    return NextResponse.json(members);
  } catch (error) {
    console.error("[TEAM_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { email, firstName, lastName, role, employmentType, hourlyRate, costRate, weeklyTarget } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const existing = await db.user.findFirst({
      where: { email, companyId: user.companyId },
    });
    if (existing) {
      return NextResponse.json({ error: "User already exists" }, { status: 409 });
    }

    const member = await db.user.create({
      data: {
        clerkId: `pending_${Date.now()}`,
        email,
        firstName: firstName || null,
        lastName: lastName || null,
        role: role || "employee",
        employmentType: employmentType || "employee",
        hourlyRate: hourlyRate ? parseFloat(hourlyRate) : 0,
        costRate: costRate ? parseFloat(costRate) : 0,
        weeklyTarget: weeklyTarget ? parseFloat(weeklyTarget) : 40,
        companyId: user.companyId,
      },
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    console.error("[TEAM_POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
