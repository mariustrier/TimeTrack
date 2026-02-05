import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { getWeekBounds } from "@/lib/week-helpers";
import { validate } from "@/lib/validate";
import { createTimeEntrySchema } from "@/lib/schemas";

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

    return NextResponse.json({
      entries,
      meta: {
        weeklyTarget: user.weeklyTarget,
      },
    });
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
    const result = validate(createTimeEntrySchema, body);
    if (!result.success) return result.response;
    const {
      hours,
      date,
      comment,
      projectId,
      billingStatus,
      mileageKm,
      mileageStartAddress,
      mileageEndAddress,
      mileageStops,
      mileageRoundTrip,
      mileageSource,
      absenceReasonId,
    } = result.data;

    const project = await db.project.findFirst({
      where: { id: projectId, companyId: user.companyId },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Validate absence entries
    const isAbsenceProject = project.systemType === "absence";
    if (isAbsenceProject && !absenceReasonId) {
      return NextResponse.json(
        { error: "Absence reason is required for absence entries" },
        { status: 400 }
      );
    }

    // Block adding entries to weeks that have non-draft entries
    const entryDate = new Date(date);
    const { weekStart, weekEnd } = getWeekBounds(entryDate);
    const existingNonDraft = await db.timeEntry.findFirst({
      where: {
        userId: user.id,
        companyId: user.companyId,
        date: { gte: weekStart, lte: weekEnd },
        approvalStatus: { not: "draft" },
      },
    });

    if (existingNonDraft) {
      return NextResponse.json(
        { error: "Cannot add entries to a submitted or approved week" },
        { status: 400 }
      );
    }

    // Default billing status from project's billable flag
    // Absence entries are always non-billable
    const defaultBillingStatus = isAbsenceProject
      ? "non_billable"
      : project.billable
        ? "billable"
        : "non_billable";

    const entry = await db.timeEntry.create({
      data: {
        hours,
        date: entryDate,
        comment: comment || null,
        userId: user.id,
        projectId,
        companyId: user.companyId,
        billingStatus: isAbsenceProject ? "non_billable" : (billingStatus || defaultBillingStatus),
        mileageKm: mileageKm ?? null,
        mileageStartAddress: mileageStartAddress ?? null,
        mileageEndAddress: mileageEndAddress ?? null,
        mileageStops: mileageStops ?? [],
        mileageRoundTrip: mileageRoundTrip ?? false,
        mileageSource: mileageSource ?? null,
        absenceReasonId: isAbsenceProject ? absenceReasonId : null,
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
