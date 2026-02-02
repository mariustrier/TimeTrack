import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await requireSuperAdmin();

    const companies = await db.company.findMany({
      include: {
        _count: {
          select: {
            users: true,
            timeEntries: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      companies.map((c) => ({
        id: c.id,
        name: c.name,
        currency: c.currency,
        createdAt: c.createdAt,
        userCount: c._count.users,
        entryCount: c._count.timeEntries,
      }))
    );
  } catch (error) {
    console.error("[SUPER_ADMIN_COMPANIES]", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
