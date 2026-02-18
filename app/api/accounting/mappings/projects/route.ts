import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, isAdminOrManager } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { projectMappingSchema } from "@/lib/schemas";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminOrManager(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const mappings = await db.projectMapping.findMany({
      where: { companyId: user.companyId },
      include: { project: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(mappings);
  } catch (error) {
    console.error("[PROJECT_MAPPINGS_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminOrManager(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const result = validate(projectMappingSchema, body);
    if (!result.success) return result.response;

    const { projectId, externalProjectId, externalProjectName } = result.data;

    const mapping = await db.projectMapping.upsert({
      where: { companyId_projectId: { companyId: user.companyId, projectId } },
      update: { externalProjectId, externalProjectName },
      create: {
        companyId: user.companyId,
        projectId,
        externalProjectId,
        externalProjectName,
      },
    });

    return NextResponse.json(mapping, { status: 201 });
  } catch (error) {
    console.error("[PROJECT_MAPPINGS_POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
