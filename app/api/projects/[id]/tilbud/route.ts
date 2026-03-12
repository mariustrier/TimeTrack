import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireManager, requireAdmin } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { tilbudConfirmSchema } from "@/lib/schemas";
import { apiError } from "@/lib/api-error";
import { checkRateLimit } from "@/lib/rate-limit";
import { put, del } from "@vercel/blob";
// pdf-parse v2 uses class-based API (PDFParse), imported dynamically
import {
  extractTilbudFromText,
  extractTilbudFromExcel,
} from "@/lib/tilbud-extraction";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireManager();

    const tilbud = await db.tilbudDocument.findFirst({
      where: {
        projectId: params.id,
        companyId: user.companyId,
      },
      include: {
        categories: {
          where: { parentId: null },
          orderBy: { sortOrder: "asc" },
          include: {
            children: {
              orderBy: { sortOrder: "asc" },
              include: {
                timeEntries: {
                  where: { tilbudCategoryId: { not: null } },
                  select: { hours: true },
                },
              },
            },
            timeEntries: {
              where: { tilbudCategoryId: { not: null } },
              select: { hours: true },
            },
          },
        },
      },
    });

    if (!tilbud) {
      return NextResponse.json({ tilbud: null });
    }

    // Aggregate usedHours per category
    const categoriesWithUsage = tilbud.categories.map((parent) => {
      const parentUsedHours = parent.timeEntries.reduce(
        (sum, e) => sum + (e.hours || 0),
        0
      );
      const children = parent.children.map((child) => {
        const childUsedHours = child.timeEntries.reduce(
          (sum, e) => sum + (e.hours || 0),
          0
        );
        const { timeEntries: _te, ...childData } = child;
        return { ...childData, usedHours: childUsedHours };
      });
      const { timeEntries: _te, children: _ch, ...parentData } = parent;
      return { ...parentData, usedHours: parentUsedHours, children };
    });

    const { categories: _cats, ...tilbudData } = tilbud;

    return NextResponse.json({
      tilbud: { ...tilbudData, categories: categoriesWithUsage },
    });
  } catch (error) {
    return apiError(error, { label: "TILBUD_GET" });
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireManager();

    const rateLimited = checkRateLimit(
      `${user.companyId}:tilbud-upload`,
      { windowMs: 60000, maxRequests: 5 }
    );
    if (rateLimited) return rateLimited;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only PDF and Excel files are accepted." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    // Verify project belongs to company
    const project = await db.project.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Upload to Vercel Blob
    const fileName = `tilbud/${user.companyId}/${params.id}/${Date.now()}-${file.name}`;
    const blob = await put(fileName, file, { access: "public" });

    // Create tilbud document with processing status
    const tilbud = await db.tilbudDocument.create({
      data: {
        projectId: params.id,
        companyId: user.companyId,
        fileName: file.name,
        fileUrl: blob.url,
        status: "processing",
      },
    });

    let extraction;
    try {
      const buffer = Buffer.from(await file.arrayBuffer());

      if (file.type === "application/pdf") {
        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse({ data: buffer });
        const pdfData = await parser.getText();
        await parser.destroy();
        extraction = await extractTilbudFromText(pdfData.text || "", user.companyId);
      } else {
        extraction = await extractTilbudFromExcel(buffer);
      }

      // Update tilbud with extraction data
      await db.tilbudDocument.update({
        where: { id: tilbud.id },
        data: {
          rawExtractionJson: extraction as object,
          hourlyRate: extraction.hourlyRate ?? null,
          hourlyRateInclMoms: extraction.hourlyRateInclMoms ?? null,
          status: "ready",
        },
      });
    } catch (extractionError) {
      console.error("[TILBUD_EXTRACTION]", extractionError);
      await db.tilbudDocument.update({
        where: { id: tilbud.id },
        data: { status: "error" },
      });
    }

    // Audit log
    await db.auditLog.create({
      data: {
        companyId: user.companyId,
        entityType: "TilbudDocument",
        entityId: tilbud.id,
        action: "TILBUD_UPLOAD",
        actorId: user.id,
        metadata: JSON.stringify({
          projectId: params.id,
          fileName: file.name,
          fileType: file.type,
        }),
      },
    });

    // Re-fetch with updated status
    const updatedTilbud = await db.tilbudDocument.findUnique({
      where: { id: tilbud.id },
    });

    return NextResponse.json(
      { tilbud: updatedTilbud, extraction: extraction ?? null },
      { status: 201 }
    );
  } catch (error) {
    return apiError(error, { label: "TILBUD_POST" });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireManager();

    const body = await req.json();
    const result = validate(tilbudConfirmSchema, body);
    if (!result.success) return result.response;

    const { tilbudId, hourlyRate, hourlyRateInclMoms, categories } =
      result.data;

    // Validate tilbud belongs to project + company
    const tilbud = await db.tilbudDocument.findFirst({
      where: {
        id: tilbudId,
        projectId: params.id,
        companyId: user.companyId,
      },
    });

    if (!tilbud) {
      return NextResponse.json(
        { error: "Tilbud not found" },
        { status: 404 }
      );
    }

    // Transaction: delete existing categories, create new ones
    const updatedTilbud = await db.$transaction(async (tx) => {
      // Delete existing categories for this tilbud
      await tx.tilbudCategory.deleteMany({
        where: { tilbudId: tilbud.id },
      });

      // Create parent categories with children
      for (const cat of categories) {
        const parent = await tx.tilbudCategory.create({
          data: {
            tilbudId: tilbud.id,
            projectId: params.id,
            companyId: user.companyId,
            faseNumber: cat.faseNumber ?? null,
            name: cat.name,
            description: cat.description ?? null,
            quotedHours: cat.quotedHours ?? null,
            isTimeloen: cat.isTimeloen,
            timeloenEstimate: cat.timeloenEstimate ?? null,
            isRecurring: cat.isRecurring ?? false,
            recurringUnit: cat.recurringUnit ?? null,
            sortOrder: cat.sortOrder,
          },
        });

        if (cat.children && cat.children.length > 0) {
          for (const child of cat.children) {
            await tx.tilbudCategory.create({
              data: {
                tilbudId: tilbud.id,
                projectId: params.id,
                companyId: user.companyId,
                parentId: parent.id,
                name: child.name,
                description: child.description ?? null,
                quotedHours: child.quotedHours ?? null,
                isTimeloen: child.isTimeloen,
                timeloenEstimate: child.timeloenEstimate ?? null,
                sortOrder: child.sortOrder,
              },
            });
          }
        }
      }

      // Calculate totals
      const allCategories = await tx.tilbudCategory.findMany({
        where: { tilbudId: tilbud.id },
      });

      const totalQuotedHours = allCategories.reduce(
        (sum, c) => sum + (c.quotedHours || 0),
        0
      );
      const totalQuotedAmount = totalQuotedHours * hourlyRate;

      // Update tilbud status and totals
      return tx.tilbudDocument.update({
        where: { id: tilbud.id },
        data: {
          status: "ready",
          hourlyRate,
          hourlyRateInclMoms: hourlyRateInclMoms ?? null,
          totalQuotedHours,
          totalQuotedAmount,
        },
        include: {
          categories: {
            where: { parentId: null },
            orderBy: { sortOrder: "asc" },
            include: {
              children: { orderBy: { sortOrder: "asc" } },
            },
          },
        },
      });
    });

    // Audit log
    await db.auditLog.create({
      data: {
        companyId: user.companyId,
        entityType: "TilbudDocument",
        entityId: tilbud.id,
        action: "TILBUD_CONFIRMED",
        actorId: user.id,
        metadata: JSON.stringify({
          projectId: params.id,
          categoryCount: categories.length,
          totalQuotedHours: updatedTilbud.totalQuotedHours,
          hourlyRate,
        }),
      },
    });

    return NextResponse.json({ tilbud: updatedTilbud });
  } catch (error) {
    return apiError(error, { label: "TILBUD_PUT" });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAdmin();

    const { searchParams } = new URL(req.url);
    const tilbudId = searchParams.get("tilbudId");

    if (!tilbudId) {
      return NextResponse.json(
        { error: "tilbudId is required" },
        { status: 400 }
      );
    }

    const tilbud = await db.tilbudDocument.findFirst({
      where: {
        id: tilbudId,
        projectId: params.id,
        companyId: user.companyId,
      },
    });

    if (!tilbud) {
      return NextResponse.json(
        { error: "Tilbud not found" },
        { status: 404 }
      );
    }

    // Nullify tilbudCategoryId on all linked time entries
    await db.timeEntry.updateMany({
      where: {
        tilbudCategory: { tilbudId: tilbud.id },
        companyId: user.companyId,
      },
      data: { tilbudCategoryId: null },
    });

    // Delete tilbud (cascades categories)
    await db.tilbudDocument.delete({
      where: { id: tilbud.id },
    });

    // Delete file from Vercel Blob
    try {
      await del(tilbud.fileUrl);
    } catch (blobError) {
      console.error("[TILBUD_DELETE] Failed to delete blob:", blobError);
    }

    // Audit log
    await db.auditLog.create({
      data: {
        companyId: user.companyId,
        entityType: "TilbudDocument",
        entityId: tilbud.id,
        action: "TILBUD_DELETED",
        actorId: user.id,
        metadata: JSON.stringify({
          projectId: params.id,
          fileName: tilbud.fileName,
        }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, { label: "TILBUD_DELETE" });
  }
}
