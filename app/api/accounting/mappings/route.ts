import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, isAdminOrManager } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { customerMappingSchema } from "@/lib/schemas";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminOrManager(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const mappings = await db.customerMapping.findMany({
      where: { companyId: user.companyId },
      orderBy: { clientName: "asc" },
    });

    return NextResponse.json(mappings);
  } catch (error) {
    console.error("[MAPPINGS_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminOrManager(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const result = validate(customerMappingSchema, body);
    if (!result.success) return result.response;

    const { clientName, externalCustomerId, externalCustomerName } = result.data;

    const mapping = await db.customerMapping.upsert({
      where: { companyId_clientName: { companyId: user.companyId, clientName } },
      update: { externalCustomerId, externalCustomerName },
      create: {
        companyId: user.companyId,
        clientName,
        externalCustomerId,
        externalCustomerName,
      },
    });

    return NextResponse.json(mapping, { status: 201 });
  } catch (error) {
    console.error("[MAPPINGS_POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
