import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { bulkResourceAllocationSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin" && user.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const result = validate(bulkResourceAllocationSchema, body);
    if (!result.success) return result.response;

    const { action, ids, status, offsetDays } = result.data;

    // Verify all IDs belong to the company
    const existing = await db.resourceAllocation.findMany({
      where: { id: { in: ids }, companyId: user.companyId },
      select: { id: true, startDate: true, endDate: true },
    });

    if (existing.length !== ids.length) {
      return NextResponse.json(
        { error: "Some allocations not found or unauthorized" },
        { status: 404 }
      );
    }

    switch (action) {
      case "delete": {
        await db.resourceAllocation.deleteMany({
          where: { id: { in: ids }, companyId: user.companyId },
        });
        return NextResponse.json({ success: true, deleted: ids.length });
      }

      case "updateStatus": {
        if (!status) {
          return NextResponse.json({ error: "status is required" }, { status: 400 });
        }
        await db.resourceAllocation.updateMany({
          where: { id: { in: ids }, companyId: user.companyId },
          data: { status },
        });
        return NextResponse.json({ success: true, updated: ids.length });
      }

      case "move": {
        if (offsetDays === undefined || offsetDays === 0) {
          return NextResponse.json({ error: "offsetDays is required and non-zero" }, { status: 400 });
        }
        await db.$transaction(
          existing.map((alloc) => {
            const newStart = new Date(alloc.startDate);
            newStart.setDate(newStart.getDate() + offsetDays);
            const newEnd = new Date(alloc.endDate);
            newEnd.setDate(newEnd.getDate() + offsetDays);
            return db.resourceAllocation.update({
              where: { id: alloc.id },
              data: { startDate: newStart, endDate: newEnd },
            });
          })
        );
        return NextResponse.json({ success: true, moved: ids.length, offsetDays });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[RESOURCE_ALLOCATIONS_BULK]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
