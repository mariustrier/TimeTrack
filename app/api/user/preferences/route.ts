import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      locale: user.locale,
      role: user.role,
      notifyApprovals: user.notifyApprovals,
      notifyVacations: user.notifyVacations,
      notifyWeeklyDigest: user.notifyWeeklyDigest,
    });
  } catch (error) {
    console.error("[USER_PREFERENCES_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const allowedFields: Record<string, unknown> = {};

    if (typeof body.firstName === "string") allowedFields.firstName = body.firstName.trim();
    if (typeof body.lastName === "string") allowedFields.lastName = body.lastName.trim();
    if (body.locale === "en" || body.locale === "da") allowedFields.locale = body.locale;
    if (typeof body.notifyApprovals === "boolean") allowedFields.notifyApprovals = body.notifyApprovals;
    if (typeof body.notifyVacations === "boolean") allowedFields.notifyVacations = body.notifyVacations;
    if (typeof body.notifyWeeklyDigest === "boolean") allowedFields.notifyWeeklyDigest = body.notifyWeeklyDigest;

    if (Object.keys(allowedFields).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await db.user.update({
      where: { id: user.id },
      data: allowedFields,
      select: {
        firstName: true,
        lastName: true,
        email: true,
        locale: true,
        notifyApprovals: true,
        notifyVacations: true,
        notifyWeeklyDigest: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[USER_PREFERENCES_PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
