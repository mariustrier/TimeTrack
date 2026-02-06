import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

// GET time entries summary for resource allocation rollover calculations
export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admin/manager can view this data
    if (user.role !== "admin" && user.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 });
    }

    // Fetch time entries grouped by user, project, and date
    const entries = await db.timeEntry.findMany({
      where: {
        companyId: user.companyId,
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      select: {
        userId: true,
        projectId: true,
        date: true,
        hours: true,
      },
    });

    // Transform to a simpler format
    const result = entries.map((e) => ({
      userId: e.userId,
      projectId: e.projectId,
      date: e.date.toISOString().split("T")[0],
      hours: e.hours,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("[TIME_ENTRIES_FOR_ALLOCATIONS]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
