import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { getDanishHolidays, DANISH_HOLIDAY_CODES } from "@/lib/holidays";

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const company = await db.company.findUnique({
      where: { id: user.companyId },
      select: { disabledHolidays: true },
    });

    const customHolidays = await db.companyHoliday.findMany({
      where: { companyId: user.companyId },
      orderBy: [{ month: "asc" }, { day: "asc" }],
    });

    const currentYear = new Date().getFullYear();
    const danishHolidays = getDanishHolidays(currentYear);

    return NextResponse.json({
      disabledHolidays: company?.disabledHolidays ?? [],
      danishHolidays: danishHolidays.map((h) => ({
        code: h.code,
        nameEn: h.nameEn,
        nameDa: h.nameDa,
        date: h.date.toISOString(),
        enabled: !company?.disabledHolidays?.includes(h.code),
      })),
      customHolidays: customHolidays.map((ch) => ({
        id: ch.id,
        name: ch.name,
        month: ch.month,
        day: ch.day,
        year: ch.year,
      })),
    });
  } catch (error) {
    console.error("[HOLIDAYS_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "toggleDanish") {
      // Toggle a Danish holiday on/off
      const { code, enabled } = body;
      if (!DANISH_HOLIDAY_CODES.includes(code)) {
        return NextResponse.json({ error: "Invalid holiday code" }, { status: 400 });
      }

      const company = await db.company.findUnique({
        where: { id: user.companyId },
        select: { disabledHolidays: true },
      });

      let disabled = company?.disabledHolidays ?? [];
      if (enabled) {
        disabled = disabled.filter((c) => c !== code);
      } else {
        if (!disabled.includes(code)) {
          disabled = [...disabled, code];
        }
      }

      await db.company.update({
        where: { id: user.companyId },
        data: { disabledHolidays: disabled },
      });

      return NextResponse.json({ success: true, disabledHolidays: disabled });
    }

    if (action === "addCustom") {
      // Add a custom company holiday
      const { name, month, day, year } = body;
      if (!name || !month || !day) {
        return NextResponse.json({ error: "Name, month, and day are required" }, { status: 400 });
      }
      if (month < 1 || month > 12 || day < 1 || day > 31) {
        return NextResponse.json({ error: "Invalid date" }, { status: 400 });
      }

      const holiday = await db.companyHoliday.create({
        data: {
          companyId: user.companyId,
          name,
          month: Number(month),
          day: Number(day),
          year: year ? Number(year) : null,
        },
      });

      return NextResponse.json(holiday);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[HOLIDAYS_POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Holiday ID required" }, { status: 400 });
    }

    await db.companyHoliday.deleteMany({
      where: { id, companyId: user.companyId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[HOLIDAYS_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
