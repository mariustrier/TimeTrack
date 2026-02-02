import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [profile, timeEntries, expenses, vacations] = await Promise.all([
    db.user.findUnique({
      where: { id: user.id },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        employmentType: true,
        hourlyRate: true,
        costRate: true,
        weeklyTarget: true,
        vacationDays: true,
        createdAt: true,
      },
    }),
    db.timeEntry.findMany({
      where: { userId: user.id },
      include: { project: { select: { name: true } } },
      orderBy: { date: "desc" },
    }),
    db.expense.findMany({
      where: { userId: user.id, isDeleted: false },
      include: { project: { select: { name: true } } },
      orderBy: { date: "desc" },
    }),
    db.vacationRequest.findMany({
      where: { userId: user.id },
      orderBy: { startDate: "desc" },
    }),
  ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    profile,
    timeEntries: timeEntries.map((e) => ({
      date: e.date,
      hours: e.hours,
      project: e.project.name,
      comment: e.comment,
      status: e.approvalStatus,
      billingStatus: e.billingStatus,
    })),
    expenses: expenses.map((e) => ({
      date: e.date,
      amount: e.amount,
      description: e.description,
      category: e.category,
      project: e.project.name,
      status: e.approvalStatus,
      receiptUrl: e.receiptUrl,
    })),
    vacations: vacations.map((v) => ({
      startDate: v.startDate,
      endDate: v.endDate,
      type: v.type,
      status: v.status,
      note: v.note,
    })),
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="my-data-${new Date().toISOString().split("T")[0]}.json"`,
    },
  });
}
