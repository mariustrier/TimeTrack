import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireAdmin();

    const reasons = await db.absenceReason.findMany({
      where: { companyId: user.companyId },
      orderBy: { sortOrder: "asc" },
      include: {
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(reasons);
  } catch (error) {
    console.error("[ADMIN_ABSENCE_REASONS_GET]", error);

    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message === "Forbidden") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAdmin();

    const body = await req.json();
    const { name, code } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Check for duplicate name
    const existing = await db.absenceReason.findUnique({
      where: {
        companyId_name: {
          companyId: user.companyId,
          name: name.trim(),
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A reason with this name already exists" },
        { status: 400 }
      );
    }

    // Get max sort order
    const maxSortOrder = await db.absenceReason.aggregate({
      where: { companyId: user.companyId },
      _max: { sortOrder: true },
    });

    const reason = await db.absenceReason.create({
      data: {
        name: name.trim(),
        code: code?.trim() || null,
        sortOrder: (maxSortOrder._max.sortOrder ?? 0) + 1,
        companyId: user.companyId,
      },
      include: {
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(reason);
  } catch (error) {
    console.error("[ADMIN_ABSENCE_REASONS_POST]", error);

    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message === "Forbidden") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
