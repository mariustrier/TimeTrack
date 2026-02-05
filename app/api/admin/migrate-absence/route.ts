import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function POST() {
  try {
    const user = await requireAdmin();
    const companyId = user.companyId;

    // Check if this company already has an absence project
    const existingAbsenceProject = await db.project.findFirst({
      where: {
        companyId,
        systemType: "absence",
      },
    });

    // Find companies to migrate (only this admin's company)
    const companiesWithoutAbsence = existingAbsenceProject
      ? []
      : [{ id: companyId, name: "Your company" }];

    const results = [];

    for (const company of companiesWithoutAbsence) {
      // Create Absence project
      await db.project.create({
        data: {
          name: "Absence",
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
    const universalReasons = await db.absenceReason.findMany({
      where: {
        companyId,
        code: { in: ["SICK", "VACATION"] },
      },
    });

    if (universalReasons.length > 0) {
      const usersWithoutReasons = await db.user.findMany({
        where: {
          companyId,
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
