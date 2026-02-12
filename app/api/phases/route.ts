import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireAuth();

    const phases = await db.phase.findMany({
      where: {
        companyId: user.companyId,
        active: true,
      },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        color: true,
        sortOrder: true,
      },
    });

    return NextResponse.json(phases);
  } catch (error) {
    console.error("[PHASES_GET]", error);

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
