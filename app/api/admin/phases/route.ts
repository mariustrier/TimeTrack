import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { createPhaseSchema } from "@/lib/schemas";

export async function GET() {
  try {
    const user = await requireAdmin();

    const phases = await db.phase.findMany({
      where: { companyId: user.companyId },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(phases);
  } catch (error) {
    console.error("[ADMIN_PHASES_GET]", error);

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
    const result = validate(createPhaseSchema, body);
    if (!result.success) return result.response;
    const { name, color } = result.data;

    // Check for duplicate name
    const existing = await db.phase.findUnique({
      where: {
        companyId_name: {
          companyId: user.companyId,
          name: name.trim(),
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A phase with this name already exists" },
        { status: 400 }
      );
    }

    // Get max sort order
    const maxSortOrder = await db.phase.aggregate({
      where: { companyId: user.companyId },
      _max: { sortOrder: true },
    });

    const phase = await db.phase.create({
      data: {
        name: name.trim(),
        sortOrder: (maxSortOrder._max.sortOrder ?? 0) + 1,
        companyId: user.companyId,
        ...(color && { color }),
      },
    });

    return NextResponse.json(phase, { status: 201 });
  } catch (error) {
    console.error("[ADMIN_PHASES_POST]", error);

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
