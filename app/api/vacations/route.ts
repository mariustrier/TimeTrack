import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { createVacationSchema } from "@/lib/schemas";

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where: Record<string, unknown> = {
      companyId: user.companyId,
    };

    // Admins/managers see all; employees see only their own unless calendar mode
    if (user.role !== "admin" && user.role !== "manager" && !status) {
      where.userId = user.id;
    }

    // Filter by status
    if (status) {
      where.status = status;
    }

    // Filter by date range (overlapping)
    if (startDate && endDate) {
      where.AND = [
        { startDate: { lte: new Date(endDate) } },
        { endDate: { gte: new Date(startDate) } },
      ];
    }

    const requests = await db.vacationRequest.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, imageUrl: true } },
      },
      orderBy: { startDate: "asc" },
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error("[VACATIONS_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const result = validate(createVacationSchema, body);
    if (!result.success) return result.response;
    const { startDate, endDate, type, note } = result.data;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
    }

    const request = await db.vacationRequest.create({
      data: {
        userId: user.id,
        companyId: user.companyId,
        startDate: start,
        endDate: end,
        type: type || "vacation",
        note: note || null,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return NextResponse.json(request, { status: 201 });
  } catch (error) {
    console.error("[VACATIONS_POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
