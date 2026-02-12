import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      role: user.role,
      vacationDays: user.vacationDays,
      vacationTrackingUnit: user.vacationTrackingUnit,
      vacationHoursPerYear: user.vacationHoursPerYear,
      weeklyTarget: user.weeklyTarget,
      isHourly: user.isHourly,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error("[USER_ME_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
