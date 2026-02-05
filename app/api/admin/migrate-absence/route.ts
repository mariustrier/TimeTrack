import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";

export async function POST() {
  try {
    await requireSuperAdmin();

    // Find all companies that don't have an absence project
    const companiesWithoutAbsence = await db.company.findMany({
      where: {
        projects: {
          none: {
            systemType: "absence",
          },
        },
      },
      select: { id: true, name: true },
    });

    const results = [];

    for (const company of companiesWithoutAbsence) {
      // Create Absence project
      await db.project.create({
        data: {
          name: "Fravær",
          color: "#9CA3AF",
          billable: false,
          systemType: "absence",
          systemManaged: true,
          companyId: company.id,
        },
      });

      // Check if company already has absence reasons
      const existingReasons = await db.absenceReason.count({
        where: { companyId: company.id },
      });

      if (existingReasons === 0) {
        // Get all users in this company
        const companyUsers = await db.user.findMany({
          where: { companyId: company.id },
          select: { id: true },
        });

        // Create universal absence reasons (Sygdom, Ferie) and connect to all users
        const [sygdomReason, ferieReason] = await Promise.all([
          db.absenceReason.create({
            data: {
              name: "Sygdom",
              code: "SICK",
              isDefault: true,
              sortOrder: 1,
              companyId: company.id,
              users: {
                connect: companyUsers.map((u) => ({ id: u.id })),
              },
            },
          }),
          db.absenceReason.create({
            data: {
              name: "Ferie",
              code: "VACATION",
              isDefault: true,
              sortOrder: 4,
              companyId: company.id,
              users: {
                connect: companyUsers.map((u) => ({ id: u.id })),
              },
            },
          }),
        ]);

        // Create child-related reasons (not assigned by default)
        await db.absenceReason.createMany({
          data: [
            { name: "Barns 1. sygedag", code: "CHILD_SICK", isDefault: true, sortOrder: 2, companyId: company.id },
            { name: "Barsel", code: "PARENTAL", isDefault: true, sortOrder: 3, companyId: company.id },
          ],
        });
      }

      results.push({ companyId: company.id, companyName: company.name });
    }

    // Also assign universal reasons to any users who don't have them yet
    // (for companies that already have absence reasons but users weren't assigned)
    const allCompanies = await db.company.findMany({
      select: { id: true },
    });

    for (const company of allCompanies) {
      const universalReasons = await db.absenceReason.findMany({
        where: {
          companyId: company.id,
          code: { in: ["SICK", "VACATION"] },
        },
      });

      if (universalReasons.length > 0) {
        const usersWithoutReasons = await db.user.findMany({
          where: {
            companyId: company.id,
            absenceReasons: {
              none: {},
            },
          },
          select: { id: true },
        });

        if (usersWithoutReasons.length > 0) {
          for (const reason of universalReasons) {
            await db.absenceReason.update({
              where: { id: reason.id },
              data: {
                users: {
                  connect: usersWithoutReasons.map((u) => ({ id: u.id })),
                },
              },
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      migratedCount: results.length,
      companies: results,
    });
  } catch (error) {
    console.error("[MIGRATE_ABSENCE]", error);

    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message === "Forbidden") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
