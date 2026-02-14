import { db } from "@/lib/db";
import { getDanishHolidays } from "@/lib/holidays";

// ── Helpers ────────────────────────────────────────────────────

/** Snap a float to the nearest 0.5 increment. */
function snap(val: number): number {
  return Math.round(val * 2) / 2;
}

/** Clamp a value between min and max. */
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/** Apply random jitter from [-0.5, 0, 0.5] and snap to 0.5, clamped to min 0.5. */
function jitter(base: number): number {
  const offset = (Math.floor(Math.random() * 3) - 1) * 0.5; // -0.5, 0, or 0.5
  return clamp(snap(base + offset), 0.5, 24);
}

/** Set a date to noon UTC to avoid timezone boundary issues. */
function noon(date: Date): Date {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d;
}

/** Get the Monday of the week containing the given date. */
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return noon(d);
}

/** Add days to a date. */
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return noon(d);
}

/** Add weeks to a date. */
function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

/** Format date as "YYYY-MM-DD" for comparison keys. */
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Pick a random element from an array. */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Main seeder ────────────────────────────────────────────────

export async function seedDemoData(companyId: string, adminUserId: string) {
  const now = new Date();
  const today = noon(now);

  // ── EMPLOYEES ────────────────────────────────────────────────

  // Update admin user profile (Marta Sjöberg)
  await db.user.update({
    where: { id: adminUserId },
    data: {
      firstName: "Marta",
      lastName: "Sjöberg",
      hourlyRate: 950,
      costRate: 475,
      weeklyTarget: 37,
      role: "admin",
      isHourly: false,
      locale: "da",
    },
  });

  const jonas = await db.user.create({
    data: {
      clerkId: `demo-jonas-${companyId}`,
      email: "demo-jonas@cloudtimer.dk",
      firstName: "Jonas",
      lastName: "Lindgren",
      role: "employee",
      hourlyRate: 750,
      costRate: 375,
      weeklyTarget: 37,
      isHourly: false,
      locale: "da",
      companyId,
      isDemo: true,
    },
  });

  const sofie = await db.user.create({
    data: {
      clerkId: `demo-sofie-${companyId}`,
      email: "demo-sofie@cloudtimer.dk",
      firstName: "Sofie",
      lastName: "Møller",
      role: "employee",
      hourlyRate: 185,
      costRate: 92,
      weeklyTarget: 15,
      isHourly: true,
      locale: "da",
      companyId,
      isDemo: true,
    },
  });

  // ── ABSENCE REASONS ──────────────────────────────────────────

  await db.absenceReason.createMany({
    data: [
      { name: "Sygdom", code: "SICK", isDefault: true, sortOrder: 0, companyId },
      { name: "Barns 1. sygedag", code: "CHILD_SICK", isDefault: true, sortOrder: 1, companyId },
      { name: "Barsel", code: "PARENTAL", isDefault: true, sortOrder: 2, companyId },
      { name: "Ferie", code: "VACATION", isDefault: true, sortOrder: 3, companyId },
    ],
    skipDuplicates: true,
  });

  // ── PROJECTS ─────────────────────────────────────────────────

  const twelveWeeksAgo = getMonday(addWeeks(today, -12));
  const eightWeeksAgo = getMonday(addWeeks(today, -8));

  const havnefronten = await db.project.create({
    data: {
      name: "Havnefronten Residences",
      client: "Meridian Ejendomme A/S",
      color: "#1E3A5F",
      billable: true,
      active: true,
      budgetHours: 820,
      pricingType: "hourly",
      rateMode: "EMPLOYEE_RATES",
      companyId,
      startDate: twelveWeeksAgo,
      endDate: addWeeks(today, 20),
    },
  });

  const villaHansen = await db.project.create({
    data: {
      name: "Villa Hansen Tilbygning",
      client: "Familien Hansen",
      color: "#DC2626",
      billable: true,
      active: true,
      budgetHours: 120,
      pricingType: "hourly",
      rateMode: "EMPLOYEE_RATES",
      companyId,
      startDate: eightWeeksAgo,
      endDate: addWeeks(today, 4),
    },
  });

  const intern = await db.project.create({
    data: {
      name: "Intern",
      client: null,
      color: "#9CA3AF",
      billable: false,
      active: true,
      companyId,
      startDate: twelveWeeksAgo,
      endDate: null,
    },
  });

  // System-managed Absence project
  await db.project.create({
    data: {
      name: "Absence",
      color: "#9CA3AF",
      billable: false,
      systemType: "absence",
      systemManaged: true,
      companyId,
    },
  });

  // ── PHASES ───────────────────────────────────────────────────

  await db.company.update({
    where: { id: companyId },
    data: { phasesEnabled: true },
  });

  const phaseData = [
    { name: "Idéoplæg", color: "#8B5CF6", sortOrder: 0, companyId },
    { name: "Projektering", color: "#3B82F6", sortOrder: 1, companyId },
    { name: "Myndighedsprojekt", color: "#F59E0B", sortOrder: 2, companyId },
    { name: "Udførelsesprojekt", color: "#10B981", sortOrder: 3, companyId },
    { name: "Byggeledelse", color: "#EF4444", sortOrder: 4, companyId },
  ];

  const phases = await Promise.all(
    phaseData.map((p) => db.phase.create({ data: p }))
  );

  const byggeledelsePhase = phases.find((p) => p.name === "Byggeledelse")!;
  const projekteringPhase = phases.find((p) => p.name === "Projektering")!;

  // Set current phases on projects
  await db.project.update({
    where: { id: havnefronten.id },
    data: { currentPhaseId: byggeledelsePhase.id },
  });

  await db.project.update({
    where: { id: villaHansen.id },
    data: { currentPhaseId: projekteringPhase.id },
  });

  // ── COMPANY HOLIDAYS 2026 ───────────────────────────────────

  await db.companyHoliday.createMany({
    data: [
      { companyId, name: "Grundlovsdag", month: 6, day: 5, year: 2026 },
    ],
    skipDuplicates: true,
  });

  // ── TIME ENTRIES ─────────────────────────────────────────────

  // Build a set of Danish holiday date keys for 2026 (and 2025 if needed)
  const holidayKeys = new Set<string>();
  for (const year of [2025, 2026]) {
    for (const h of getDanishHolidays(year)) {
      holidayKeys.add(dateKey(h.date));
    }
  }
  // Also add Grundlovsdag 2026 as a company holiday
  holidayKeys.add("2026-06-05");

  /** Check if a date is a workday (not weekend, not holiday). */
  function isWorkday(d: Date): boolean {
    const dow = d.getDay();
    if (dow === 0 || dow === 6) return false; // weekend
    if (holidayKeys.has(dateKey(d))) return false; // holiday
    return true;
  }

  // Determine last 4 complete weeks (Mon-Fri)
  const thisMonday = getMonday(today);
  const fourWeeksAgoMonday = addWeeks(thisMonday, -4);

  // Collect all workdays in the 4-week window
  const workdays: Date[] = [];
  for (let d = new Date(fourWeeksAgoMonday); d < thisMonday; d = addDays(d, 1)) {
    if (isWorkday(d)) {
      workdays.push(noon(d));
    }
  }

  // Determine week boundaries for approval status
  const week1Start = fourWeeksAgoMonday; // oldest
  const week2Start = addWeeks(fourWeeksAgoMonday, 1);
  const week3Start = addWeeks(fourWeeksAgoMonday, 2);
  const week4Start = addWeeks(fourWeeksAgoMonday, 3); // most recent = draft

  function getWeekEndFriday(weekMonday: Date): Date {
    return noon(addDays(weekMonday, 4));
  }

  function getApprovalForDate(d: Date): {
    approvalStatus: string;
    approvedAt: Date | null;
    approvedBy: string | null;
  } {
    const dk = dateKey(d);
    const w4 = dateKey(week4Start);
    if (dk >= w4) {
      return { approvalStatus: "draft", approvedAt: null, approvedBy: null };
    }
    // Weeks 1-3 are approved
    let weekMonday: Date;
    const w3 = dateKey(week3Start);
    const w2 = dateKey(week2Start);
    if (dk >= w3) {
      weekMonday = week3Start;
    } else if (dk >= w2) {
      weekMonday = week2Start;
    } else {
      weekMonday = week1Start;
    }
    return {
      approvalStatus: "approved",
      approvedAt: getWeekEndFriday(weekMonday),
      approvedBy: adminUserId,
    };
  }

  // Description pools
  const martaHavnefrontenDescs = [
    "Tilsyn på byggeplads",
    "Facadestudie, materialevalg",
    "BIM-modellering, fase 3",
    "Møde med bygherre om facadeændringer",
    "Kvalitetssikring af tegninger",
  ];
  const martaInternDescs = [
    "Intern koordinering",
    "Personalemøde",
    "Projektplanlægning",
    "Kontordag — administration",
  ];
  const jonasVillaDescs = [
    "Opmåling og registrering",
    "Tegningsproduktion, snit og plan",
    "Materialespecifikation",
    "3D-visualisering til bygherre",
    "Konstruktionsberegning",
  ];
  const jonasHavnefrontenDescs = [
    "Detailtegninger, badeværelser",
    "Landskabsprojekt, skitsering",
    "Tegningsmateriale til udbud",
  ];
  const jonasInternDescs = ["Fredagsmøde", "BIM-koordinering"];
  const sofieHavnefrontenDescs = [
    "AutoCAD-tegninger, plantegning",
    "Modellering i Revit",
    "Farve- og materialekatalog",
  ];

  // Prepare time entry bulk data
  interface TimeEntryInput {
    hours: number;
    date: Date;
    comment: string;
    userId: string;
    projectId: string;
    companyId: string;
    approvalStatus: string;
    approvedAt: Date | null;
    approvedBy: string | null;
    phaseId: string | null;
    phaseName: string | null;
    billingStatus: string;
  }

  const entries: TimeEntryInput[] = [];

  for (const day of workdays) {
    const approval = getApprovalForDate(day);
    const dow = day.getDay(); // 1=Mon .. 5=Fri

    // ── Marta ──
    // ~5.5h Havnefronten
    entries.push({
      hours: jitter(5.5),
      date: day,
      comment: pick(martaHavnefrontenDescs),
      userId: adminUserId,
      projectId: havnefronten.id,
      companyId,
      ...approval,
      phaseId: byggeledelsePhase.id,
      phaseName: "Byggeledelse",
      billingStatus: "billable",
    });
    // ~1.5h Intern
    entries.push({
      hours: jitter(1.5),
      date: day,
      comment: pick(martaInternDescs),
      userId: adminUserId,
      projectId: intern.id,
      companyId,
      ...approval,
      phaseId: null,
      phaseName: null,
      billingStatus: "non_billable",
    });

    // ── Jonas ──
    // ~5h Villa Hansen
    entries.push({
      hours: jitter(5),
      date: day,
      comment: pick(jonasVillaDescs),
      userId: jonas.id,
      projectId: villaHansen.id,
      companyId,
      ...approval,
      phaseId: projekteringPhase.id,
      phaseName: "Projektering",
      billingStatus: "billable",
    });
    // ~2.5h Havnefronten
    entries.push({
      hours: jitter(2.5),
      date: day,
      comment: pick(jonasHavnefrontenDescs),
      userId: jonas.id,
      projectId: havnefronten.id,
      companyId,
      ...approval,
      phaseId: byggeledelsePhase.id,
      phaseName: "Byggeledelse",
      billingStatus: "billable",
    });
    // Occasional 1h Intern (~2 days/week)
    if (dow <= 2 || (dow === 5 && Math.random() > 0.5)) {
      entries.push({
        hours: jitter(1),
        date: day,
        comment: pick(jonasInternDescs),
        userId: jonas.id,
        projectId: intern.id,
        companyId,
        ...approval,
        phaseId: null,
        phaseName: null,
        billingStatus: "non_billable",
      });
    }

    // ── Sofie (Mon/Tue/Wed only) ──
    if (dow >= 1 && dow <= 3) {
      entries.push({
        hours: jitter(3),
        date: day,
        comment: pick(sofieHavnefrontenDescs),
        userId: sofie.id,
        projectId: havnefronten.id,
        companyId,
        ...approval,
        phaseId: byggeledelsePhase.id,
        phaseName: "Byggeledelse",
        billingStatus: "billable",
      });
    }
  }

  // Bulk-create all time entries
  await db.timeEntry.createMany({ data: entries });

  // ── INVOICE DRAFT ────────────────────────────────────────────

  // Fetch all approved billable Havnefronten entries for the invoice
  const approvedHavnefrontenEntries = await db.timeEntry.findMany({
    where: {
      companyId,
      projectId: havnefronten.id,
      approvalStatus: "approved",
      billingStatus: "billable",
    },
    select: { id: true, hours: true, userId: true },
  });

  // Group by employee
  const hoursByUser: Record<string, { hours: number; entryIds: string[] }> = {};
  for (const entry of approvedHavnefrontenEntries) {
    if (!hoursByUser[entry.userId]) {
      hoursByUser[entry.userId] = { hours: 0, entryIds: [] };
    }
    hoursByUser[entry.userId].hours += entry.hours;
    hoursByUser[entry.userId].entryIds.push(entry.id);
  }

  // Employee rate lookup
  const employeeRates: Record<string, { name: string; rate: number }> = {
    [adminUserId]: { name: "Marta Sjöberg", rate: 950 },
    [jonas.id]: { name: "Jonas Lindgren", rate: 750 },
    [sofie.id]: { name: "Sofie Møller", rate: 185 },
  };

  // Calculate totals
  let subtotal = 0;
  const invoiceLines: {
    sortOrder: number;
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    type: string;
    timeEntryIds: string[];
    expenseIds: string[];
    phaseName: string;
  }[] = [];

  let sortOrder = 0;
  Object.keys(hoursByUser).forEach((userId) => {
    const data = hoursByUser[userId];
    const emp = employeeRates[userId];
    if (!emp) return;
    const hours = snap(data.hours);
    const amount = hours * emp.rate;
    subtotal += amount;
    invoiceLines.push({
      sortOrder: sortOrder++,
      description: `${emp.name} — Byggeledelse`,
      quantity: hours,
      unitPrice: emp.rate,
      amount,
      type: "time",
      timeEntryIds: data.entryIds,
      expenseIds: [],
      phaseName: "Byggeledelse",
    });
  });

  const vatRate = 25;
  const vatAmount = subtotal * (vatRate / 100);
  const total = subtotal + vatAmount;

  const periodStart = noon(addWeeks(thisMonday, -3));
  const periodEnd = noon(addDays(addWeeks(thisMonday, -1), 4)); // Friday of last week
  const dueDate = addDays(today, 14);

  const invoice = await db.invoice.create({
    data: {
      companyId,
      invoiceNumber: 1,
      status: "draft",
      projectId: havnefronten.id,
      clientName: "Meridian Ejendomme A/S",
      periodStart,
      periodEnd,
      invoiceDate: today,
      dueDate,
      subtotal,
      vatRate,
      vatAmount,
      total,
      currency: "DKK",
      paymentTermsDays: 14,
      lines: {
        create: invoiceLines,
      },
    },
  });

  // Link approved Havnefronten entries to the invoice
  const allApprovedEntryIds = approvedHavnefrontenEntries.map((e) => e.id);
  if (allApprovedEntryIds.length > 0) {
    await db.timeEntry.updateMany({
      where: { id: { in: allApprovedEntryIds } },
      data: { invoiceId: invoice.id, invoicedAt: today },
    });
  }

  // ── RESOURCE ALLOCATIONS ─────────────────────────────────────

  await db.resourceAllocation.createMany({
    data: [
      {
        companyId,
        userId: adminUserId,
        projectId: havnefronten.id,
        startDate: today,
        endDate: addWeeks(today, 8),
        hoursPerDay: 5.5,
        status: "confirmed",
      },
      {
        companyId,
        userId: jonas.id,
        projectId: villaHansen.id,
        startDate: today,
        endDate: addWeeks(today, 4),
        hoursPerDay: 5,
        status: "confirmed",
      },
      {
        companyId,
        userId: jonas.id,
        projectId: havnefronten.id,
        startDate: addWeeks(today, 5),
        endDate: addWeeks(today, 12),
        hoursPerDay: 7,
        status: "tentative",
      },
      {
        companyId,
        userId: sofie.id,
        projectId: havnefronten.id,
        startDate: today,
        endDate: addWeeks(today, 8),
        hoursPerDay: 3,
        status: "confirmed",
      },
    ],
  });

  // ── PROJECT MILESTONES ───────────────────────────────────────

  await db.projectMilestone.createMany({
    data: [
      {
        projectId: havnefronten.id,
        title: "Afleveringsforretning",
        type: "phase",
        phaseId: byggeledelsePhase.id,
        dueDate: addWeeks(today, 16),
        icon: "flag",
        color: "#EF4444",
      },
      {
        projectId: villaHansen.id,
        title: "Myndighedsgodkendelse",
        type: "custom",
        dueDate: addWeeks(today, 2),
        icon: "calendar",
        color: "#F59E0B",
      },
      {
        projectId: villaHansen.id,
        title: "Aflevering til bygherre",
        type: "custom",
        dueDate: addWeeks(today, 4),
        icon: "handshake",
        color: "#DC2626",
      },
    ],
  });
}
