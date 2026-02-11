import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { updateTeamMemberSchema } from "@/lib/schemas";

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const member = await db.user.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });
    if (!member) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const result = validate(updateTeamMemberSchema, body);
    if (!result.success) return result.response;
    const { firstName, lastName, role, employmentType, hourlyRate, costRate, weeklyTarget, isHourly, vacationDays } = result.data;

    const updated = await db.user.update({
      where: { id: params.id },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(role !== undefined && { role }),
        ...(employmentType !== undefined && { employmentType }),
        ...(hourlyRate !== undefined && { hourlyRate }),
        ...(costRate !== undefined && { costRate }),
        ...(weeklyTarget !== undefined && { weeklyTarget }),
        ...(isHourly !== undefined && { isHourly }),
        ...(vacationDays !== undefined && { vacationDays }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[TEAM_PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (params.id === user.id) {
      return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
    }

    const member = await db.user.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });
    if (!member) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.user.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[TEAM_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
