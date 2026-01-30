import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const userId = searchParams.get("userId");

    const where: Record<string, unknown> = {
      companyId: user.companyId,
    };

    if (user.role !== "admin") {
      where.userId = user.id;
    } else if (userId) {
      where.userId = userId;
    }

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const entries = await db.timeEntry.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, color: true, billable: true } },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { date: "asc" },
    });

    return NextResponse.json(entries);
  } catch (error) {
    console.error("[TIME_ENTRIES_GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { hours, date, comment, projectId } = body;

    if (!hours || !date || !projectId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const project = await db.project.findFirst({
      where: { id: projectId, companyId: user.companyId },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const entry = await db.timeEntry.create({
      data: {
        hours: parseFloat(hours),
        date: new Date(date),
        comment: comment || null,
        userId: user.id,
        projectId,
        companyId: user.companyId,
      },
      include: {
        project: { select: { id: true, name: true, color: true, billable: true } },
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("[TIME_ENTRIES_POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
