import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiError } from "@/lib/api-error";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find the "ready" tilbud for this project
    const tilbud = await db.tilbudDocument.findFirst({
      where: {
        projectId: params.id,
        companyId: user.companyId,
        status: "ready",
      },
      select: { id: true },
    });

    if (!tilbud) {
      return NextResponse.json({ categories: [] });
    }

    // Fetch all active categories with usedHours aggregation
    const categories = await db.tilbudCategory.findMany({
      where: {
        tilbudId: tilbud.id,
        companyId: user.companyId,
        isActive: true,
      },
      orderBy: { sortOrder: "asc" },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { timeEntries: true } },
        timeEntries: {
          select: { hours: true },
        },
      },
    });

    // Build flat list with usedHours and parentName
    const result = categories.map((cat) => {
      const usedHours = cat.timeEntries.reduce(
        (sum, e) => sum + (e.hours || 0),
        0
      );
      const { timeEntries: _te, parent, _count, ...catData } = cat;
      return {
        ...catData,
        parentId: parent?.id ?? null,
        parentName: parent?.name ?? null,
        usedHours,
        entryCount: _count.timeEntries,
      };
    });

    return NextResponse.json({ categories: result });
  } catch (error) {
    return apiError(error, { label: "TILBUD_CATEGORIES_GET" });
  }
}
