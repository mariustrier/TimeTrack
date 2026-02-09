import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, isAdminOrManager } from "@/lib/auth";
import { getDailyTarget } from "@/lib/calculations";
import type { CustomHoliday } from "@/lib/holidays";

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

    if (!isAdminOrManager(user.role)) {
      where.userId = user.id;
    } else if (userId) {
      where.userId = userId;
    } else {
      where.userId = user.id;
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
        phase: { select: { id: true, name: true } },
      },
      orderBy: { date: "asc" },
    });

    // Resolve target user for flex balance (may differ from logged-in user when admin views an employee)
    const targetUserId = (isAdminOrManager(user.role) && userId) ? userId : user.id;
    const targetUser = targetUserId !== user.id
      ? await db.user.findFirst({ where: { id: targetUserId, companyId: user.companyId }, select: { id: true, weeklyTarget: true, createdAt: true } })
      : user;

    if (!targetUser) {
      return NextResponse.json({ error: "Target user not found" }, { status: 404 });
    }

    // Calculate cumulative flex balance prior to the requested week
    let priorFlexBalance: number | null = null;
    if (startDate) {
      const weekStartDate = new Date(startDate);
      const userStart = targetUser.createdAt;

      // Only calculate if the user existed before this week
      if (userStart < weekStartDate) {
        // Sum all hours the target user worked before the current week
        const priorHoursAgg = await db.timeEntry.aggregate({
          where: {
            userId: targetUser.id,
            companyId: user.companyId,
            date: { gte: userStart, lt: weekStartDate },
          },
          _sum: { hours: true },
        });
        const totalWorked = priorHoursAgg._sum.hours || 0;

        // Fetch company holiday config for holiday-aware flex calculation
        const company = await db.company.findUnique({
          where: { id: user.companyId },
          select: { disabledHolidays: true },
        });
        const companyCustomHolidays = await db.companyHoliday.findMany({
          where: { companyId: user.companyId },
        });
        const disabledCodes = company?.disabledHolidays ?? [];
        const customHols: CustomHoliday[] = companyCustomHolidays.map((ch) => ({
          name: ch.name,
          month: ch.month,
          day: ch.day,
          year: ch.year,
        }));

        // Count expected hours (Mon-Fri minus holidays)
        const wt = targetUser.weeklyTarget;
        let expected = 0;
        const d = new Date(userStart);
        d.setHours(0, 0, 0, 0);
        const end = new Date(weekStartDate);
        end.setHours(0, 0, 0, 0);
        while (d < end) {
          expected += getDailyTarget(d, wt, disabledCodes, customHols);
          d.setDate(d.getDate() + 1);
        }

        priorFlexBalance = Math.round((totalWorked - expected) * 100) / 100;
      } else {
        priorFlexBalance = 0;
      }
    }

    return NextResponse.json({
      entries,
      meta: {
        weeklyTarget: targetUser.weeklyTarget,
        ...(priorFlexBalance !== null && { priorFlexBalance }),
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
      userId: targetUserId,
    } = result.data;

    // Determine effective user (admin/manager can log on behalf of employees)
    let effectiveUserId = user.id;
    if (targetUserId && targetUserId !== user.id) {
      if (!isAdminOrManager(user.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const targetUser = await db.user.findFirst({
        where: { id: targetUserId, companyId: user.companyId },
      });
      if (!targetUser) {
        return NextResponse.json({ error: "Target user not found" }, { status: 404 });
      }
      effectiveUserId = targetUserId;
    }

    const project = await db.project.findFirst({
      where: { id: projectId, companyId: user.companyId },
      include: { currentPhase: { select: { id: true, name: true } } },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Block entries on locked or archived projects
    if (project.locked || project.archived) {
      return NextResponse.json(
        { error: "Cannot add entries to locked or archived projects" },
        { status: 403 }
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

    // Block adding entries to days that are fully approved or locked
    const entryDate = new Date(date);
    const { startOfDay: dayStart, endOfDay: dayEnd } = {
      startOfDay: new Date(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate()),
      endOfDay: new Date(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate(), 23, 59, 59, 999),
    };
    const dayEntries = await db.timeEntry.findMany({
      where: {
        userId: effectiveUserId,
        companyId: user.companyId,
        date: { gte: dayStart, lte: dayEnd },
      },
      select: { approvalStatus: true },
    });

    // Only block if the day has entries and ALL are approved or locked
    // (admins logging on behalf can bypass this restriction)
    const isOnBehalf = effectiveUserId !== user.id;
    if (dayEntries.length > 0 && !isOnBehalf) {
      const allProcessed = dayEntries.every(
        (e) => e.approvalStatus === "approved" || e.approvalStatus === "locked"
      );
      if (allProcessed) {
        return NextResponse.json(
          { error: "Cannot add entries to an approved or locked day" },
          { status: 400 }
        );
      }
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
        userId: effectiveUserId,
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
        ...(project.phasesEnabled && project.currentPhase && !isAbsenceProject && {
          phaseId: project.currentPhase.id,
          phaseName: project.currentPhase.name,
        }),
      },
      include: {
        project: { select: { id: true, name: true, color: true, billable: true } },
        phase: { select: { id: true, name: true } },
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
