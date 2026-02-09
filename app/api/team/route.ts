import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, isAdminOrManager } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { createTeamMemberSchema } from "@/lib/schemas";
import { sendInvitationEmail } from "@/lib/email";

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
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        imageUrl: true,
        role: true,
        employmentType: true,
        hourlyRate: true,
        costRate: true,
        weeklyTarget: true,
        vacationDays: true,
        companyId: true,
        createdAt: true,
      },
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
    const result = validate(createTeamMemberSchema, body);
    if (!result.success) return result.response;
    const { email, firstName, lastName, role, employmentType, hourlyRate, costRate, weeklyTarget } = result.data;

    const normalizedEmail = email.toLowerCase();
    const existing = await db.user.findFirst({
      where: { email: normalizedEmail, companyId: user.companyId },
    });
    if (existing) {
      return NextResponse.json({ error: "User already exists" }, { status: 409 });
    }

    const member = await db.user.create({
      data: {
        clerkId: `pending_${Date.now()}`,
        email: normalizedEmail,
        firstName: firstName || null,
        lastName: lastName || null,
        role: role || "employee",
        employmentType: employmentType || "employee",
        hourlyRate: hourlyRate ?? 0,
        costRate: costRate ?? 0,
        weeklyTarget: weeklyTarget ?? 40,
        companyId: user.companyId,
      },
    });

    // Send invitation email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://cloudtimer.dk";
    const inviterName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

    let emailSent = false;
    try {
      await sendInvitationEmail({
        to: normalizedEmail,
        inviterName,
        companyName: user.company.name,
        signUpUrl: `${appUrl}/sign-up`,
      });
      emailSent = true;
    } catch (emailError) {
      console.error("[TEAM_POST] Failed to send invitation email:", emailError);
    }

    return NextResponse.json({ ...member, emailSent }, { status: 201 });
  } catch (error) {
    console.error("[TEAM_POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
