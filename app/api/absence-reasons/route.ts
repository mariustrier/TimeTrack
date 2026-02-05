import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireAuth();

    // Get only absence reasons assigned to this user
    const reasons = await db.absenceReason.findMany({
      where: {
        companyId: user.companyId,
        active: true,
        users: {
          some: {
            id: user.id,
          },
        },
      },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    return NextResponse.json(reasons);
  } catch (error) {
    console.error("[ABSENCE_REASONS_GET]", error);

    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
