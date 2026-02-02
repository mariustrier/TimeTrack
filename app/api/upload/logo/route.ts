import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { put, del } from "@vercel/blob";
import { db } from "@/lib/db";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = [
  "image/png",
  "image/svg+xml",
  "image/jpeg",
  "image/webp",
];

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File must be under 2MB" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Only SVG, PNG, JPG, and WebP images are allowed" },
        { status: 400 }
      );
    }

    // Delete old logo if exists
    const company = await db.company.findUnique({
      where: { id: user.companyId },
      select: { logoUrl: true },
    });

    if (company?.logoUrl) {
      try {
        await del(company.logoUrl);
      } catch {
        // Old blob may already be deleted
      }
    }

    const ext = file.name.split(".").pop() || "png";
    const blob = await put(
      `logos/${user.companyId}/logo-${Date.now()}.${ext}`,
      file,
      { access: "public" }
    );

    await db.company.update({
      where: { id: user.companyId },
      data: { logoUrl: blob.url },
    });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error("[LOGO_UPLOAD]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const company = await db.company.findUnique({
      where: { id: user.companyId },
      select: { logoUrl: true },
    });

    if (company?.logoUrl) {
      try {
        await del(company.logoUrl);
      } catch {
        // Blob may already be deleted
      }
    }

    await db.company.update({
      where: { id: user.companyId },
      data: { logoUrl: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[LOGO_DELETE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
