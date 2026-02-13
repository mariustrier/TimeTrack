import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, isAdminOrManager } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { createVacationSchema } from "@/lib/schemas";
import { createVacationEntries } from "@/lib/vacation-entries";

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
        user: { select: { id: true, firstName: true, lastName: true, email: true, imageUrl: true, vacationTrackingUnit: true, weeklyTarget: true } },
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
    const { startDate, endDate, type, note, userId: targetUserId } = result.data;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
    }

    // Admin/manager can create on behalf of an employee
    let effectiveUserId = user.id;
    const isOnBehalf = targetUserId && targetUserId !== user.id;
    if (isOnBehalf) {
      if (!isAdminOrManager(user.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const targetUser = await db.user.findFirst({
        where: { id: targetUserId, companyId: user.companyId, deletedAt: null },
      });
      if (!targetUser) {
        return NextResponse.json({ error: "Target user not found" }, { status: 404 });
      }
      effectiveUserId = targetUserId;
    }

    const request = await db.vacationRequest.create({
      data: {
        userId: effectiveUserId,
        companyId: user.companyId,
        startDate: start,
        endDate: end,
        type: type || "vacation",
        note: note || null,
        // Auto-approve when admin creates on behalf
        ...(isOnBehalf && {
          status: "approved",
          reviewedBy: user.id,
          reviewedAt: new Date(),
        }),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    // Auto-create absence time entries when approved on behalf
    if (isOnBehalf) {
      await createVacationEntries(
        { userId: effectiveUserId, startDate: start, endDate: end, type: type || "vacation" },
        user.companyId,
      );
    }

    return NextResponse.json(request, { status: 201 });
  } catch (error) {
    console.error("[VACATIONS_POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
