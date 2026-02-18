import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, isAdminOrManager } from "@/lib/auth";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminOrManager(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const mapping = await db.projectMapping.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });
    if (!mapping) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.projectMapping.delete({ where: { id: mapping.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PROJECT_MAPPING_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
