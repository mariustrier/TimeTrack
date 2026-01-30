import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

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
    });

    if (!entry) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (user.role !== "admin" && entry.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { hours, comment } = body;

    const updated = await db.timeEntry.update({
      where: { id: params.id },
      data: {
        ...(hours !== undefined && { hours: parseFloat(hours) }),
        ...(comment !== undefined && { comment }),
      },
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
    });

    if (!entry) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (user.role !== "admin" && entry.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.timeEntry.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[TIME_ENTRY_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
