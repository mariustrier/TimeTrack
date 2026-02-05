import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { updateTimeEntrySchema } from "@/lib/schemas";

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const entry = await db.timeEntry.findFirst({
      where: { id: params.id, companyId: user.companyId },
      include: { project: { select: { locked: true, archived: true } } },
    });

    if (!entry) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (user.role !== "admin" && entry.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Block edits on locked or archived projects
    if (entry.project.locked || entry.project.archived) {
      return NextResponse.json(
        { error: "Cannot modify entries on locked or archived projects" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const result = validate(updateTimeEntrySchema, body);
    if (!result.success) return result.response;
    const {
      hours,
      comment,
      billingStatus,
      nonBillableReason,
      mileageKm,
      mileageStartAddress,
      mileageEndAddress,
      mileageStops,
      mileageRoundTrip,
      mileageSource,
    } = result.data;

    // Approval status guards
    if (entry.approvalStatus === "locked") {
      return NextResponse.json(
        { error: "Cannot edit a locked entry" },
        { status: 403 }
      );
    }

    if (entry.approvalStatus !== "draft") {
      // Non-draft entries: only admin can edit billingStatus/nonBillableReason
      if (user.role !== "admin") {
        return NextResponse.json(
          { error: "Cannot edit a submitted or approved entry" },
          { status: 403 }
        );
      }
      // Admin can only change billing fields on submitted/approved entries
      if (hours !== undefined || comment !== undefined) {
        return NextResponse.json(
          { error: "Can only edit billing status on submitted/approved entries" },
          { status: 403 }
        );
      }
    }

    // Build update data
    const data: Record<string, unknown> = {};
    if (hours !== undefined && entry.approvalStatus === "draft") {
      data.hours = hours;
    }
    if (comment !== undefined && entry.approvalStatus === "draft") {
      data.comment = comment;
    }
    if (billingStatus !== undefined) {
      // Log billing status change in audit log
      if (billingStatus !== entry.billingStatus) {
        await db.auditLog.create({
          data: {
            companyId: user.companyId,
            entityType: "TimeEntry",
            entityId: entry.id,
            action: "EDIT_BILLING",
            fromStatus: entry.billingStatus,
            toStatus: billingStatus,
            actorId: user.id,
            metadata: JSON.stringify({ entryDate: entry.date }),
          },
        });
      }
      data.billingStatus = billingStatus;
    }
    if (nonBillableReason !== undefined) {
      data.nonBillableReason = nonBillableReason || null;
    }
    // Mileage fields (only editable when draft, like hours/comment)
    if (mileageKm !== undefined && entry.approvalStatus === "draft") {
      data.mileageKm = mileageKm ?? null;
    }
    if (mileageStartAddress !== undefined && entry.approvalStatus === "draft") {
      data.mileageStartAddress = mileageStartAddress ?? null;
    }
    if (mileageEndAddress !== undefined && entry.approvalStatus === "draft") {
      data.mileageEndAddress = mileageEndAddress ?? null;
    }
    if (mileageSource !== undefined && entry.approvalStatus === "draft") {
      data.mileageSource = mileageSource ?? null;
    }
    if (mileageStops !== undefined && entry.approvalStatus === "draft") {
      data.mileageStops = mileageStops ?? [];
    }
    if (mileageRoundTrip !== undefined && entry.approvalStatus === "draft") {
      data.mileageRoundTrip = mileageRoundTrip ?? false;
    }

    const updated = await db.timeEntry.update({
      where: { id: params.id },
      data,
      include: {
        project: { select: { id: true, name: true, color: true, billable: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[TIME_ENTRY_PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const entry = await db.timeEntry.findFirst({
      where: { id: params.id, companyId: user.companyId },
      include: { project: { select: { locked: true, archived: true } } },
    });

    if (!entry) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (user.role !== "admin" && entry.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Block deletes on locked or archived projects
    if (entry.project.locked || entry.project.archived) {
      return NextResponse.json(
        { error: "Cannot delete entries on locked or archived projects" },
        { status: 403 }
      );
    }

    // Approval status guards for delete
    if (entry.approvalStatus === "approved" || entry.approvalStatus === "locked") {
      return NextResponse.json(
        { error: "Cannot delete an approved or locked entry" },
        { status: 403 }
      );
    }

    if (entry.approvalStatus === "submitted" && user.role !== "admin") {
      return NextResponse.json(
        { error: "Cannot delete a submitted entry" },
        { status: 403 }
      );
    }

    await db.timeEntry.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[TIME_ENTRY_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
