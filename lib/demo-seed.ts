import { db } from "@/lib/db";
import { getDanishHolidays } from "@/lib/holidays";

// ── Seeded PRNG (deterministic demo data) ──────────────────────

let _rng: () => number = Math.random;

function initRng(seed: number) {
  let s = seed | 0;
  _rng = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function rand(): number {
  return _rng();
}

// ── Helpers ────────────────────────────────────────────────────

function snap(val: number): number {
  return Math.round(val * 2) / 2;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function jitter(base: number, range = 0.5): number {
  const offset = (Math.floor(rand() * 3) - 1) * range;
  return clamp(snap(base + offset), 0.5, 12);
}

function noon(date: Date): Date {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return noon(d);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return noon(d);
}

function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

/** Get month index (0-based from data start) for a date relative to dataStart */
function getMonthIndex(date: Date, dataStart: Date): number {
  return (
    (date.getFullYear() - dataStart.getFullYear()) * 12 +
    date.getMonth() -
    dataStart.getMonth()
  );
}

// ── Description pools ──────────────────────────────────────────

const DESC_BILLABLE: Record<string, string[]> = {
  HVF: [
    "Tilsyn på byggeplads",
    "Facadestudie, materialevalg med bygherre",
    "BIM-modellering, fase 3",
    "Møde med bygherre om facadeændringer",
    "Kvalitetssikring af tegninger",
    "Detailtegninger, badeværelser",
    "Landskabsprojekt, skitsering",
    "Tegningsmateriale til udbud",
    "Koordinering med ingeniør",
    "Byggepladsmøde, uge-gennemgang",
  ],
  KHV: [
    "Skitseforslag, kultursal",
    "Research kommunale krav",
    "Brugerinddragelse, workshop",
    "Bæredygtighedsanalyse",
    "Volumenstudie, scenarie A+B",
    "Præsentation for udvalg",
    "Akustisk studie",
    "Funktionsprogram, revision",
  ],
  SBK: [
    "Plantegning, kontorlandskab",
    "Facadestudie, solafskærmning",
    "Materiale- og farvepalette",
    "Møde med lejer om indretning",
    "Energiberegning, ramme",
    "Konstruktionsprojekt, review",
    "Dagslysberegning",
    "Interiørkoncept, fællesarealer",
  ],
  VHT: [
    "Opmåling og registrering",
    "Tegningsproduktion, snit og plan",
    "Materialespecifikation",
    "3D-visualisering til bygherre",
    "Konstruktionsberegning",
    "Myndighedsansøgning, tegninger",
    "Møde med bygherre om ændringer",
    "Revision efter myndighedskrav",
  ],
  ELM: [
    "Bebyggelsesplan, revision 2",
    "Landskabsprojekt, gårdrum",
    "Facadeudtryk, teglvalg",
    "Udbudsbeskrivelse",
    "Koordinering med bygherre",
    "Tegningsmateriale, hovedprojekt",
    "Beplantningsplan",
    "Energiramme, dokumentation",
  ],
  KON: [
    "Konkurrenceoplæg, konceptudvikling",
    "Diagrammer og analyser",
    "Rendering, perspektiv",
    "Plancher, layout",
    "Bæredygtighedsstrategi",
    "Model, 3D-print forberedelse",
  ],
};

const DESC_INTERN: Record<string, string[]> = {
  ledelse: [
    "Ledelsesmøde",
    "Personalemøde",
    "Økonomirapportering",
    "HR-administration",
    "Strategiplanlægning",
    "Klientmøde, pipeline",
  ],
  kvalitet: [
    "Kvalitetssikring, review",
    "Intern tegningsreview",
    "BIM-standarder, opdatering",
    "ISO-dokumentation",
  ],
  kompetence: [
    "Kursus, brandkrav",
    "Faglig sparring",
    "Revit-workshop",
    "Bæredygtighedscertificering",
  ],
  kontor: [
    "Kontordrift",
    "IT-koordinering",
    "Fredagsmøde",
    "Intern koordinering",
    "Projektplanlægning",
  ],
};

// ── Main seeder ────────────────────────────────────────────────

export async function seedDemoData(companyId: string, adminUserId: string) {
  initRng(42);

  const now = new Date();
  const today = noon(now);
  const thisMonday = getMonday(today);

  // Data starts ~26 weeks ago (early August 2025)
  const dataStart = getMonday(addWeeks(today, -26));

  // ── COMPANY UPDATE ─────────────────────────────────────────

  await db.company.update({
    where: { id: companyId },
    data: {
      currency: "DKK",
      phasesEnabled: true,
      defaultHourlyRate: 750,
      companyAddress: "Nørrebrogade 60, 3. sal\n2200 København N",
      companyCvr: "41 23 67 89",
      companyBankAccount: "0012345678",
      companyBankReg: "7412",
      invoiceFooterNote:
        "Betaling bedes indbetalt senest på forfaldsdato.\nTak for godt samarbejde.",
      invoicePrefix: "CT",
      defaultPaymentDays: 14,
      flexStartDate: dataStart,
    },
  });

  // ── ADMIN USER UPDATE (Marta Krogh) ────────────────────────

  await db.user.update({
    where: { id: adminUserId },
    data: {
      firstName: "Marta",
      lastName: "Krogh",
      hourlyRate: 1150,
      costRate: 550,
      weeklyTarget: 37,
      role: "admin",
      isHourly: false,
      locale: "da",
    },
  });

  // ── EMPLOYEES (11 more) ────────────────────────────────────

  interface EmpSpec {
    firstName: string;
    lastName: string;
    clerkSuffix: string;
    role: string;
    hourlyRate: number;
    costRate: number;
    weeklyTarget: number;
    isHourly: boolean;
  }

  const empSpecs: EmpSpec[] = [
    { firstName: "Anders", lastName: "Holm", clerkSuffix: "anders", role: "manager", hourlyRate: 950, costRate: 480, weeklyTarget: 37, isHourly: false },
    { firstName: "Jonas", lastName: "Lindqvist", clerkSuffix: "jonas", role: "employee", hourlyRate: 850, costRate: 380, weeklyTarget: 37, isHourly: false },
    { firstName: "Amara", lastName: "Osei", clerkSuffix: "amara", role: "employee", hourlyRate: 850, costRate: 380, weeklyTarget: 37, isHourly: false },
    { firstName: "Katrine", lastName: "Mørch", clerkSuffix: "katrine", role: "employee", hourlyRate: 800, costRate: 380, weeklyTarget: 30, isHourly: false },
    { firstName: "Erik", lastName: "Dahl", clerkSuffix: "erik", role: "employee", hourlyRate: 650, costRate: 320, weeklyTarget: 37, isHourly: false },
    { firstName: "Sofia", lastName: "Rehn", clerkSuffix: "sofia", role: "employee", hourlyRate: 650, costRate: 320, weeklyTarget: 37, isHourly: false },
    { firstName: "Marcus", lastName: "Vinter", clerkSuffix: "marcus", role: "employee", hourlyRate: 600, costRate: 320, weeklyTarget: 37, isHourly: false },
    { firstName: "Lukas", lastName: "Engström", clerkSuffix: "lukas", role: "employee", hourlyRate: 450, costRate: 240, weeklyTarget: 37, isHourly: false },
    { firstName: "Nadia", lastName: "Voss", clerkSuffix: "nadia", role: "employee", hourlyRate: 450, costRate: 240, weeklyTarget: 37, isHourly: false },
    { firstName: "Sofie", lastName: "Dahl", clerkSuffix: "sofied", role: "employee", hourlyRate: 185, costRate: 140, weeklyTarget: 15, isHourly: true },
    { firstName: "Oliver", lastName: "Frandsen", clerkSuffix: "oliver", role: "employee", hourlyRate: 195, costRate: 140, weeklyTarget: 20, isHourly: true },
  ];

  const employees = await Promise.all(
    empSpecs.map((s) =>
      db.user.create({
        data: {
          clerkId: `demo-${s.clerkSuffix}-${companyId}`,
          email: `demo-${s.clerkSuffix}@cloudtimer.dk`,
          firstName: s.firstName,
          lastName: s.lastName,
          role: s.role,
          hourlyRate: s.hourlyRate,
          costRate: s.costRate,
          weeklyTarget: s.weeklyTarget,
          isHourly: s.isHourly,
          locale: "da",
          companyId,
          isDemo: true,
          acceptedTermsAt: new Date(),
          tourCompletedAt: new Date(),
        },
      })
    )
  );

  // Named references
  const anders = employees[0];
  const jonas = employees[1];
  const amara = employees[2];
  const katrine = employees[3];
  const erik = employees[4];
  const sofia = employees[5];
  const marcus = employees[6];
  const lukas = employees[7];
  const nadia = employees[8];
  const sofieD = employees[9];
  const oliver = employees[10];

  // Lukas started in October (monthIdx ~2)
  await db.user.update({
    where: { id: lukas.id },
    data: { createdAt: addWeeks(dataStart, 8) },
  });

  // ── ABSENCE REASONS ────────────────────────────────────────

  await db.absenceReason.createMany({
    data: [
      { name: "Sygdom", code: "SICK", isDefault: true, sortOrder: 0, companyId },
      { name: "Barns 1. sygedag", code: "CHILD_SICK", isDefault: true, sortOrder: 1, companyId },
      { name: "Barsel", code: "PARENTAL", isDefault: true, sortOrder: 2, companyId },
      { name: "Ferie", code: "VACATION", isDefault: true, sortOrder: 3, companyId },
    ],
    skipDuplicates: true,
  });

  // ── PHASES ─────────────────────────────────────────────────

  const phaseData = [
    { name: "Forprojekt", color: "#8B5CF6", sortOrder: 0, companyId },
    { name: "Skitsering", color: "#3B82F6", sortOrder: 1, companyId },
    { name: "Projektering", color: "#F59E0B", sortOrder: 2, companyId },
    { name: "Myndighedsprojekt", color: "#10B981", sortOrder: 3, companyId },
    { name: "Byggeledelse", color: "#EF4444", sortOrder: 4, companyId },
  ];

  const phases = await Promise.all(
    phaseData.map((p) => db.phase.create({ data: p }))
  );

  const phForprojekt = phases[0];
  const phSkitsering = phases[1];
  const phProjektering = phases[2];
  const phMyndighed = phases[3];
  const phByggeledelse = phases[4];

  // ── PROJECTS ───────────────────────────────────────────────

  // 1. Havnefronten (HVF) — flagship, active, Byggeledelse
  const hvf = await db.project.create({
    data: {
      name: "Havnefronten Residences",
      client: "Meridian Ejendomme A/S",
      color: "#1E3A5F",
      billable: true,
      active: true,
      budgetHours: 1850,
      pricingType: "hourly",
      rateMode: "COMPANY_RATE",
      projectRate: 750,
      companyId,
      startDate: dataStart,
      endDate: addWeeks(today, 20),
      currentPhaseId: phByggeledelse.id,
    },
  });

  // 2. Kulturhuset Vestby (KHV) — public sector, fixed price
  const khv = await db.project.create({
    data: {
      name: "Kulturhuset Vestby",
      client: "Vestby Kommune",
      color: "#2563EB",
      billable: true,
      active: true,
      budgetHours: 2400,
      pricingType: "fixed_price",
      fixedPrice: 2200000,
      rateMode: "COMPANY_RATE",
      companyId,
      startDate: addWeeks(dataStart, 8),
      endDate: addWeeks(today, 40),
      currentPhaseId: phSkitsering.id,
    },
  });

  // 3. Søbredden Kontor (SBK) — profitable
  const sbk = await db.project.create({
    data: {
      name: "Søbredden Kontor",
      client: "Nordstjerne Udvikling ApS",
      color: "#059669",
      billable: true,
      active: true,
      budgetHours: 960,
      pricingType: "hourly",
      rateMode: "COMPANY_RATE",
      projectRate: 800,
      companyId,
      startDate: addWeeks(dataStart, 12),
      endDate: addWeeks(today, 16),
      currentPhaseId: phProjektering.id,
    },
  });

  // 4. Villa Hansen (VHT) — amber warning, saved by early detection (~90% of budget)
  const vht = await db.project.create({
    data: {
      name: "Villa Hansen Tilbygning",
      client: "Familien Hansen",
      color: "#F59E0B",
      billable: true,
      active: true,
      budgetHours: 180,
      pricingType: "fixed_price",
      fixedPrice: 145000,
      rateMode: "COMPANY_RATE",
      companyId,
      startDate: addWeeks(dataStart, 4),
      endDate: addWeeks(today, 6),
      currentPhaseId: phMyndighed.id,
    },
  });

  // 5. Elmegade Rækkehuse (ELM) — winding down
  const elm = await db.project.create({
    data: {
      name: "Elmegade Rækkehuse",
      client: "GreenBuild ApS",
      color: "#9333EA",
      billable: true,
      active: true,
      budgetHours: 640,
      pricingType: "hourly",
      rateMode: "COMPANY_RATE",
      projectRate: 700,
      companyId,
      startDate: dataStart,
      endDate: addWeeks(today, 4),
      currentPhaseId: phMyndighed.id,
    },
  });

  // 6. Nordhavn Masterplan (NMP) — planned, not started
  await db.project.create({
    data: {
      name: "Nordhavn Masterplan",
      client: "Meridian Ejendomme A/S",
      color: "#0891B2",
      billable: true,
      active: true,
      budgetHours: 3200,
      pricingType: "hourly",
      rateMode: "COMPANY_RATE",
      companyId,
      startDate: addWeeks(today, 8),
      endDate: addWeeks(today, 52),
    },
  });

  // 7. Competition (KON) — non-billable
  const kon = await db.project.create({
    data: {
      name: "Arkitektkonkurrence — Bæredygtig Skole",
      client: null,
      color: "#F59E0B",
      billable: false,
      active: true,
      budgetHours: 200,
      companyId,
      startDate: addWeeks(dataStart, 8),
      endDate: addWeeks(today, 4),
    },
  });

  // 8. Intern (INT) — ongoing internal
  const int = await db.project.create({
    data: {
      name: "Intern",
      client: null,
      color: "#9CA3AF",
      billable: false,
      active: true,
      companyId,
      startDate: dataStart,
    },
  });

  // System Absence project
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

  // ── PROJECT ALLOCATIONS (team budget per project) ─────────

  await db.projectAllocation.createMany({
    data: [
      // Havnefronten
      { projectId: hvf.id, userId: anders.id, hours: 450, companyId },
      { projectId: hvf.id, userId: jonas.id, hours: 380, companyId },
      { projectId: hvf.id, userId: erik.id, hours: 280, companyId },
      { projectId: hvf.id, userId: lukas.id, hours: 200, companyId },
      { projectId: hvf.id, userId: sofieD.id, hours: 120, companyId },
      { projectId: hvf.id, userId: marcus.id, hours: 160, companyId },
      { projectId: hvf.id, userId: adminUserId, hours: 100, companyId },
      // Kulturhuset
      { projectId: khv.id, userId: anders.id, hours: 300, companyId },
      { projectId: khv.id, userId: amara.id, hours: 250, companyId },
      { projectId: khv.id, userId: nadia.id, hours: 200, companyId },
      { projectId: khv.id, userId: oliver.id, hours: 150, companyId },
      { projectId: khv.id, userId: adminUserId, hours: 80, companyId },
      // Søbredden
      { projectId: sbk.id, userId: amara.id, hours: 200, companyId },
      { projectId: sbk.id, userId: marcus.id, hours: 180, companyId },
      { projectId: sbk.id, userId: lukas.id, hours: 120, companyId },
      { projectId: sbk.id, userId: sofia.id, hours: 80, companyId },
      // Villa Hansen (budget: 180h, target ~90% = ~162h used)
      { projectId: vht.id, userId: katrine.id, hours: 120, companyId },
      { projectId: vht.id, userId: erik.id, hours: 60, companyId },
      // Katrine cross-project allocations
      { projectId: elm.id, userId: katrine.id, hours: 200, companyId },
      { projectId: hvf.id, userId: katrine.id, hours: 100, companyId },
      { projectId: khv.id, userId: katrine.id, hours: 100, companyId },
      // Elmegade
      { projectId: elm.id, userId: sofia.id, hours: 300, companyId },
      { projectId: elm.id, userId: erik.id, hours: 120, companyId },
      { projectId: elm.id, userId: nadia.id, hours: 100, companyId },
      // Competition
      { projectId: kon.id, userId: jonas.id, hours: 60, companyId },
      { projectId: kon.id, userId: nadia.id, hours: 40, companyId },
      { projectId: kon.id, userId: oliver.id, hours: 30, companyId },
    ],
  });

  // ── PROJECT PHASE SEGMENTS ─────────────────────────────────

  await db.projectPhase.createMany({
    data: [
      // Havnefronten progression
      { projectId: hvf.id, phaseId: phForprojekt.id, startDate: dataStart, endDate: addWeeks(dataStart, 6), status: "completed" },
      { projectId: hvf.id, phaseId: phSkitsering.id, startDate: addWeeks(dataStart, 6), endDate: addWeeks(dataStart, 12), status: "completed" },
      { projectId: hvf.id, phaseId: phProjektering.id, startDate: addWeeks(dataStart, 12), endDate: addWeeks(dataStart, 18), status: "completed" },
      { projectId: hvf.id, phaseId: phByggeledelse.id, startDate: addWeeks(dataStart, 18), endDate: addWeeks(today, 20), status: "active" },
      // Kulturhuset
      { projectId: khv.id, phaseId: phForprojekt.id, startDate: addWeeks(dataStart, 8), endDate: addWeeks(dataStart, 14), status: "completed" },
      { projectId: khv.id, phaseId: phSkitsering.id, startDate: addWeeks(dataStart, 14), endDate: addWeeks(today, 12), status: "active" },
      // Søbredden
      { projectId: sbk.id, phaseId: phForprojekt.id, startDate: addWeeks(dataStart, 12), endDate: addWeeks(dataStart, 16), status: "completed" },
      { projectId: sbk.id, phaseId: phProjektering.id, startDate: addWeeks(dataStart, 16), endDate: addWeeks(today, 16), status: "active" },
      // Villa Hansen
      { projectId: vht.id, phaseId: phSkitsering.id, startDate: addWeeks(dataStart, 4), endDate: addWeeks(dataStart, 10), status: "completed" },
      { projectId: vht.id, phaseId: phProjektering.id, startDate: addWeeks(dataStart, 10), endDate: addWeeks(dataStart, 18), status: "completed" },
      { projectId: vht.id, phaseId: phMyndighed.id, startDate: addWeeks(dataStart, 18), endDate: addWeeks(today, 6), status: "active" },
      // Elmegade
      { projectId: elm.id, phaseId: phForprojekt.id, startDate: dataStart, endDate: addWeeks(dataStart, 6), status: "completed" },
      { projectId: elm.id, phaseId: phSkitsering.id, startDate: addWeeks(dataStart, 6), endDate: addWeeks(dataStart, 14), status: "completed" },
      { projectId: elm.id, phaseId: phProjektering.id, startDate: addWeeks(dataStart, 14), endDate: addWeeks(dataStart, 22), status: "completed" },
      { projectId: elm.id, phaseId: phMyndighed.id, startDate: addWeeks(dataStart, 22), endDate: addWeeks(today, 4), status: "active" },
    ],
  });

  // ── PROJECT ACTIVITIES (Gantt bars) ────────────────────────

  await db.projectActivity.createMany({
    data: [
      // Havnefronten (6)
      { companyId, projectId: hvf.id, name: "Programmering og analyse", sortOrder: 0, phaseId: phForprojekt.id, assignedUserId: anders.id, startDate: dataStart, endDate: addWeeks(dataStart, 6), status: "complete" },
      { companyId, projectId: hvf.id, name: "Skitseforslag og volumenstudie", sortOrder: 1, phaseId: phSkitsering.id, assignedUserId: jonas.id, startDate: addWeeks(dataStart, 6), endDate: addWeeks(dataStart, 12), status: "complete" },
      { companyId, projectId: hvf.id, name: "Hovedprojekt", sortOrder: 2, phaseId: phProjektering.id, assignedUserId: erik.id, startDate: addWeeks(dataStart, 12), endDate: addWeeks(dataStart, 18), status: "complete" },
      { companyId, projectId: hvf.id, name: "Tilsyn og byggemøder", sortOrder: 3, phaseId: phByggeledelse.id, assignedUserId: anders.id, startDate: addWeeks(dataStart, 18), endDate: addWeeks(today, 8), status: "in_progress" },
      { companyId, projectId: hvf.id, name: "BIM-koordinering", sortOrder: 4, phaseId: phByggeledelse.id, assignedUserId: erik.id, startDate: addWeeks(dataStart, 20), endDate: addWeeks(today, 10), status: "in_progress" },
      { companyId, projectId: hvf.id, name: "Afleveringsdokumentation", sortOrder: 5, phaseId: phByggeledelse.id, startDate: addWeeks(today, 12), endDate: addWeeks(today, 20), status: "not_started" },
      // Kulturhuset (4)
      { companyId, projectId: khv.id, name: "Brugerinddragelse og research", sortOrder: 0, phaseId: phForprojekt.id, assignedUserId: nadia.id, startDate: addWeeks(dataStart, 8), endDate: addWeeks(dataStart, 14), status: "complete" },
      { companyId, projectId: khv.id, name: "Konceptudvikling", sortOrder: 1, phaseId: phSkitsering.id, assignedUserId: amara.id, startDate: addWeeks(dataStart, 14), endDate: addWeeks(today, 4), status: "in_progress" },
      { companyId, projectId: khv.id, name: "Bæredygtighedsanalyse", sortOrder: 2, phaseId: phSkitsering.id, assignedUserId: amara.id, startDate: addWeeks(dataStart, 18), endDate: addWeeks(today, 8), status: "in_progress" },
      { companyId, projectId: khv.id, name: "Skitsepræsentation", sortOrder: 3, phaseId: phSkitsering.id, startDate: addWeeks(today, 6), endDate: addWeeks(today, 12), status: "not_started" },
      // Søbredden (3)
      { companyId, projectId: sbk.id, name: "Indretningskoncept", sortOrder: 0, phaseId: phForprojekt.id, assignedUserId: marcus.id, startDate: addWeeks(dataStart, 12), endDate: addWeeks(dataStart, 16), status: "complete" },
      { companyId, projectId: sbk.id, name: "Facadeprojekt", sortOrder: 1, phaseId: phProjektering.id, assignedUserId: amara.id, startDate: addWeeks(dataStart, 16), endDate: addWeeks(today, 4), status: "in_progress" },
      { companyId, projectId: sbk.id, name: "Energiberegning og dokumentation", sortOrder: 2, phaseId: phProjektering.id, assignedUserId: lukas.id, startDate: addWeeks(today, 2), endDate: addWeeks(today, 10), status: "not_started" },
      // Villa Hansen (3)
      { companyId, projectId: vht.id, name: "Opmåling og registrering", sortOrder: 0, phaseId: phSkitsering.id, assignedUserId: katrine.id, startDate: addWeeks(dataStart, 4), endDate: addWeeks(dataStart, 8), status: "complete" },
      { companyId, projectId: vht.id, name: "Projektforslag", sortOrder: 1, phaseId: phProjektering.id, assignedUserId: katrine.id, startDate: addWeeks(dataStart, 8), endDate: addWeeks(dataStart, 18), status: "complete" },
      { companyId, projectId: vht.id, name: "Myndighedsansøgning", sortOrder: 2, phaseId: phMyndighed.id, assignedUserId: erik.id, startDate: addWeeks(dataStart, 18), endDate: addWeeks(today, 4), status: "in_progress" },
      // Elmegade (3)
      { companyId, projectId: elm.id, name: "Bebyggelsesplan", sortOrder: 0, phaseId: phForprojekt.id, assignedUserId: sofia.id, startDate: dataStart, endDate: addWeeks(dataStart, 8), status: "complete" },
      { companyId, projectId: elm.id, name: "Hovedprojekt og detaljer", sortOrder: 1, phaseId: phProjektering.id, assignedUserId: sofia.id, startDate: addWeeks(dataStart, 8), endDate: addWeeks(dataStart, 22), status: "complete" },
      { companyId, projectId: elm.id, name: "Udbudsmateriale", sortOrder: 2, phaseId: phMyndighed.id, assignedUserId: nadia.id, startDate: addWeeks(dataStart, 22), endDate: addWeeks(today, 4), status: "in_progress" },
    ],
  });

  // ── COMPANY HOLIDAYS ───────────────────────────────────────

  await db.companyHoliday.createMany({
    data: [
      { companyId, name: "Grundlovsdag", month: 6, day: 5, year: 2026 },
    ],
    skipDuplicates: true,
  });

  // ── EXPENSE CATEGORIES ─────────────────────────────────────

  await db.expenseCategory.createMany({
    data: [
      { name: "Husleje", sortOrder: 0, companyId },
      { name: "Forsikring", sortOrder: 1, companyId },
      { name: "Software", sortOrder: 2, companyId },
      { name: "Transport", sortOrder: 3, companyId },
      { name: "Materialer", sortOrder: 4, companyId },
      { name: "Øvrig", sortOrder: 5, companyId, isDefault: true },
    ],
    skipDuplicates: true,
  });

  // ── TIME ENTRIES (26 weeks) ────────────────────────────────

  // Build holiday set
  const holidayKeys = new Set<string>();
  for (const year of [2025, 2026]) {
    for (const h of getDanishHolidays(year)) {
      holidayKeys.add(dateKey(h.date));
    }
  }
  holidayKeys.add("2026-06-05"); // Grundlovsdag

  function isWorkday(d: Date): boolean {
    const dow = d.getDay();
    if (dow === 0 || dow === 6) return false;
    if (holidayKeys.has(dateKey(d))) return false;
    return true;
  }

  // Christmas/NY reduced period: Dec 22 - Jan 2
  function isChristmasPeriod(d: Date): boolean {
    const m = d.getMonth();
    const day = d.getDate();
    return (m === 11 && day >= 22) || (m === 0 && day <= 2);
  }

  // Non-billable ratio per month index (0 = Aug 2025, 6 = Feb 2026)
  const nonBillableTarget = [0.38, 0.35, 0.31, 0.28, 0.26, 0.23, 0.21];

  // Employee work pattern definition
  interface WorkPattern {
    userId: string;
    name: string;
    weeklyTarget: number;
    isHourly: boolean;
    workDays: number[]; // day-of-week (1=Mon ... 5=Fri)
    // Returns entries for a given day. monthIdx controls non-billable ratio.
    getEntries: (day: Date, monthIdx: number) => { projectId: string; hours: number; projectCode: string; phaseId: string | null; phaseName: string | null; billingStatus: string }[];
  }

  // Get the current phase for a project at a given date
  function getPhaseForProject(projectCode: string, monthIdx: number): { id: string | null; name: string | null } {
    switch (projectCode) {
      case "HVF":
        if (monthIdx <= 1) return { id: phForprojekt.id, name: "Forprojekt" };
        if (monthIdx <= 2) return { id: phSkitsering.id, name: "Skitsering" };
        if (monthIdx <= 3) return { id: phProjektering.id, name: "Projektering" };
        return { id: phByggeledelse.id, name: "Byggeledelse" };
      case "KHV":
        if (monthIdx <= 3) return { id: phForprojekt.id, name: "Forprojekt" };
        return { id: phSkitsering.id, name: "Skitsering" };
      case "SBK":
        if (monthIdx <= 4) return { id: phForprojekt.id, name: "Forprojekt" };
        return { id: phProjektering.id, name: "Projektering" };
      case "VHT":
        if (monthIdx <= 2) return { id: phSkitsering.id, name: "Skitsering" };
        if (monthIdx <= 4) return { id: phProjektering.id, name: "Projektering" };
        return { id: phMyndighed.id, name: "Myndighedsprojekt" };
      case "ELM":
        if (monthIdx <= 1) return { id: phForprojekt.id, name: "Forprojekt" };
        if (monthIdx <= 3) return { id: phSkitsering.id, name: "Skitsering" };
        if (monthIdx <= 5) return { id: phProjektering.id, name: "Projektering" };
        return { id: phMyndighed.id, name: "Myndighedsprojekt" };
      default:
        return { id: null, name: null };
    }
  }

  // Adjust internal hours based on non-billable target
  // Higher monthIdx = less internal time
  function internHours(base: number, monthIdx: number): number {
    const factor = 1 - (monthIdx * 0.08); // 1.0 at month 0, 0.52 at month 6
    return jitter(Math.max(0.5, base * Math.max(0.5, factor)));
  }

  const patterns: WorkPattern[] = [
    // Marta (admin) — leadership heavy
    {
      userId: adminUserId, name: "Marta", weeklyTarget: 37, isHourly: false,
      workDays: [1, 2, 3, 4, 5],
      getEntries: (day, mi) => {
        const dow = day.getDay();
        const entries = [];
        // Billable: client meetings, design reviews
        entries.push({ projectId: hvf.id, hours: jitter(dow === 1 ? 2 : 3.5), projectCode: "HVF", phaseId: getPhaseForProject("HVF", mi).id, phaseName: getPhaseForProject("HVF", mi).name, billingStatus: "billable" });
        if (mi >= 2 && dow >= 3) {
          entries.push({ projectId: khv.id, hours: jitter(1.5), projectCode: "KHV", phaseId: getPhaseForProject("KHV", mi).id, phaseName: getPhaseForProject("KHV", mi).name, billingStatus: "billable" });
        }
        // Internal: leadership
        entries.push({ projectId: int.id, hours: internHours(dow === 1 ? 3 : 2, mi), projectCode: "INT", phaseId: null, phaseName: null, billingStatus: "non_billable" });
        return entries;
      },
    },
    // Anders — project leader
    {
      userId: anders.id, name: "Anders", weeklyTarget: 37, isHourly: false,
      workDays: [1, 2, 3, 4, 5],
      getEntries: (day, mi) => {
        const entries = [];
        entries.push({ projectId: hvf.id, hours: jitter(4.5), projectCode: "HVF", phaseId: getPhaseForProject("HVF", mi).id, phaseName: getPhaseForProject("HVF", mi).name, billingStatus: "billable" });
        if (mi >= 2) {
          entries.push({ projectId: khv.id, hours: jitter(1.5), projectCode: "KHV", phaseId: getPhaseForProject("KHV", mi).id, phaseName: getPhaseForProject("KHV", mi).name, billingStatus: "billable" });
        }
        entries.push({ projectId: int.id, hours: internHours(1.5, mi), projectCode: "INT", phaseId: null, phaseName: null, billingStatus: "non_billable" });
        return entries;
      },
    },
    // Jonas — overworked senior
    {
      userId: jonas.id, name: "Jonas", weeklyTarget: 37, isHourly: false,
      workDays: [1, 2, 3, 4, 5],
      getEntries: (day, mi) => {
        const entries = [];
        entries.push({ projectId: hvf.id, hours: jitter(5), projectCode: "HVF", phaseId: getPhaseForProject("HVF", mi).id, phaseName: getPhaseForProject("HVF", mi).name, billingStatus: "billable" });
        if (mi >= 2) {
          entries.push({ projectId: kon.id, hours: jitter(1.5), projectCode: "KON", phaseId: null, phaseName: null, billingStatus: "non_billable" });
        }
        // Jonas often overworks — add extra 0.5-1h
        if (rand() > 0.4) {
          entries.push({ projectId: hvf.id, hours: jitter(1), projectCode: "HVF", phaseId: getPhaseForProject("HVF", mi).id, phaseName: getPhaseForProject("HVF", mi).name, billingStatus: "billable" });
        }
        entries.push({ projectId: int.id, hours: internHours(0.5, mi), projectCode: "INT", phaseId: null, phaseName: null, billingStatus: "non_billable" });
        return entries;
      },
    },
    // Amara — efficient, sustainability
    {
      userId: amara.id, name: "Amara", weeklyTarget: 37, isHourly: false,
      workDays: [1, 2, 3, 4, 5],
      getEntries: (_day, mi) => {
        const entries = [];
        if (mi < 4) {
          entries.push({ projectId: hvf.id, hours: jitter(3), projectCode: "HVF", phaseId: getPhaseForProject("HVF", mi).id, phaseName: getPhaseForProject("HVF", mi).name, billingStatus: "billable" });
        }
        if (mi >= 2) {
          entries.push({ projectId: khv.id, hours: jitter(3), projectCode: "KHV", phaseId: getPhaseForProject("KHV", mi).id, phaseName: getPhaseForProject("KHV", mi).name, billingStatus: "billable" });
        }
        if (mi >= 3) {
          entries.push({ projectId: sbk.id, hours: jitter(2.5), projectCode: "SBK", phaseId: getPhaseForProject("SBK", mi).id, phaseName: getPhaseForProject("SBK", mi).name, billingStatus: "billable" });
        }
        entries.push({ projectId: int.id, hours: internHours(0.5, mi), projectCode: "INT", phaseId: null, phaseName: null, billingStatus: "non_billable" });
        return entries;
      },
    },
    // Katrine — renovation specialist, VHT budget warning story, sick leave from Jan
    {
      userId: katrine.id, name: "Katrine", weeklyTarget: 37, isHourly: false,
      workDays: [1, 2, 3, 4, 5],
      getEntries: (day, mi) => {
        const reduced = mi >= 5; // sick leave from Jan → 30h/wk
        const entries = [];
        // VHT: V-shaped burn — escalates Aug→Nov, ~75% budget warning mid-Nov, sharp pullback
        let vhtH: number;
        if (mi === 0) vhtH = 1.0;
        else if (mi === 1) vhtH = 1.5;
        else if (mi === 2) vhtH = 1.5;
        else if (mi === 3 && day.getDate() <= 14) vhtH = 2.5; // peak before warning
        else if (mi <= 4) vhtH = 0.5; // sharp pullback after warning
        else vhtH = rand() < 0.3 ? 0.5 : 0; // Jan/Feb: mostly done
        if (vhtH > 0) {
          entries.push({ projectId: vht.id, hours: jitter(vhtH), projectCode: "VHT", phaseId: getPhaseForProject("VHT", mi).id, phaseName: getPhaseForProject("VHT", mi).name, billingStatus: "billable" });
        }
        // ELM as main project + HVF/KHV support
        if (mi < 5) {
          entries.push({ projectId: elm.id, hours: jitter(2), projectCode: "ELM", phaseId: getPhaseForProject("ELM", mi).id, phaseName: getPhaseForProject("ELM", mi).name, billingStatus: "billable" });
          if (mi < 2) {
            entries.push({ projectId: hvf.id, hours: jitter(2.5), projectCode: "HVF", phaseId: getPhaseForProject("HVF", mi).id, phaseName: getPhaseForProject("HVF", mi).name, billingStatus: "billable" });
          } else {
            entries.push({ projectId: khv.id, hours: jitter(2), projectCode: "KHV", phaseId: getPhaseForProject("KHV", mi).id, phaseName: getPhaseForProject("KHV", mi).name, billingStatus: "billable" });
          }
        } else {
          entries.push({ projectId: hvf.id, hours: jitter(5), projectCode: "HVF", phaseId: getPhaseForProject("HVF", mi).id, phaseName: getPhaseForProject("HVF", mi).name, billingStatus: "billable" });
        }
        entries.push({ projectId: int.id, hours: internHours(reduced ? 0.5 : 1, mi), projectCode: "INT", phaseId: null, phaseName: null, billingStatus: "non_billable" });
        return entries;
      },
    },
    // Erik — BIM specialist, multi-project
    {
      userId: erik.id, name: "Erik", weeklyTarget: 37, isHourly: false,
      workDays: [1, 2, 3, 4, 5],
      getEntries: (day, mi) => {
        const dow = day.getDay();
        const entries = [];
        entries.push({ projectId: hvf.id, hours: jitter(mi >= 3 ? 5 : 4), projectCode: "HVF", phaseId: getPhaseForProject("HVF", mi).id, phaseName: getPhaseForProject("HVF", mi).name, billingStatus: "billable" });
        // VHT: minor BIM support, phases out after budget warning mid-Nov
        if (mi <= 2 || (mi === 3 && day.getDate() <= 14)) {
          entries.push({ projectId: vht.id, hours: jitter(0.5), projectCode: "VHT", phaseId: getPhaseForProject("VHT", mi).id, phaseName: getPhaseForProject("VHT", mi).name, billingStatus: "billable" });
        }
        if (dow === 5) {
          entries.push({ projectId: int.id, hours: jitter(1), projectCode: "INT", phaseId: null, phaseName: null, billingStatus: "non_billable" });
        } else {
          entries.push({ projectId: int.id, hours: internHours(0.5, mi), projectCode: "INT", phaseId: null, phaseName: null, billingStatus: "non_billable" });
        }
        return entries;
      },
    },
    // Sofia — landscape, Elmegade lead
    {
      userId: sofia.id, name: "Sofia", weeklyTarget: 37, isHourly: false,
      workDays: [1, 2, 3, 4, 5],
      getEntries: (day, mi) => {
        const dow = day.getDay();
        const entries = [];
        entries.push({ projectId: elm.id, hours: jitter(4.5), projectCode: "ELM", phaseId: getPhaseForProject("ELM", mi).id, phaseName: getPhaseForProject("ELM", mi).name, billingStatus: "billable" });
        if (mi >= 3) {
          entries.push({ projectId: sbk.id, hours: jitter(1.5), projectCode: "SBK", phaseId: getPhaseForProject("SBK", mi).id, phaseName: getPhaseForProject("SBK", mi).name, billingStatus: "billable" });
        }
        if (dow === 5) {
          entries.push({ projectId: int.id, hours: jitter(1.5), projectCode: "INT", phaseId: null, phaseName: null, billingStatus: "non_billable" });
        } else {
          entries.push({ projectId: int.id, hours: internHours(0.5, mi), projectCode: "INT", phaseId: null, phaseName: null, billingStatus: "non_billable" });
        }
        return entries;
      },
    },
    // Marcus — interiors, detail
    {
      userId: marcus.id, name: "Marcus", weeklyTarget: 37, isHourly: false,
      workDays: [1, 2, 3, 4, 5],
      getEntries: (_day, mi) => {
        const entries = [];
        if (mi >= 3) {
          entries.push({ projectId: sbk.id, hours: jitter(4), projectCode: "SBK", phaseId: getPhaseForProject("SBK", mi).id, phaseName: getPhaseForProject("SBK", mi).name, billingStatus: "billable" });
        }
        entries.push({ projectId: hvf.id, hours: jitter(mi >= 3 ? 2 : 5), projectCode: "HVF", phaseId: getPhaseForProject("HVF", mi).id, phaseName: getPhaseForProject("HVF", mi).name, billingStatus: "billable" });
        entries.push({ projectId: int.id, hours: internHours(0.5, mi), projectCode: "INT", phaseId: null, phaseName: null, billingStatus: "non_billable" });
        return entries;
      },
    },
    // Lukas — junior, high billable
    {
      userId: lukas.id, name: "Lukas", weeklyTarget: 37, isHourly: false,
      workDays: [1, 2, 3, 4, 5],
      getEntries: (_day, mi) => {
        const entries = [];
        entries.push({ projectId: hvf.id, hours: jitter(4), projectCode: "HVF", phaseId: getPhaseForProject("HVF", mi).id, phaseName: getPhaseForProject("HVF", mi).name, billingStatus: "billable" });
        if (mi >= 3) {
          entries.push({ projectId: sbk.id, hours: jitter(2.5), projectCode: "SBK", phaseId: getPhaseForProject("SBK", mi).id, phaseName: getPhaseForProject("SBK", mi).name, billingStatus: "billable" });
        }
        entries.push({ projectId: int.id, hours: internHours(0.5, mi), projectCode: "INT", phaseId: null, phaseName: null, billingStatus: "non_billable" });
        return entries;
      },
    },
    // Nadia — research, competition
    {
      userId: nadia.id, name: "Nadia", weeklyTarget: 37, isHourly: false,
      workDays: [1, 2, 3, 4, 5],
      getEntries: (_day, mi) => {
        const entries = [];
        if (mi >= 2) {
          entries.push({ projectId: khv.id, hours: jitter(3), projectCode: "KHV", phaseId: getPhaseForProject("KHV", mi).id, phaseName: getPhaseForProject("KHV", mi).name, billingStatus: "billable" });
        }
        entries.push({ projectId: elm.id, hours: jitter(mi >= 2 ? 2 : 4), projectCode: "ELM", phaseId: getPhaseForProject("ELM", mi).id, phaseName: getPhaseForProject("ELM", mi).name, billingStatus: "billable" });
        if (mi >= 2) {
          entries.push({ projectId: kon.id, hours: jitter(1), projectCode: "KON", phaseId: null, phaseName: null, billingStatus: "non_billable" });
        }
        entries.push({ projectId: int.id, hours: internHours(0.5, mi), projectCode: "INT", phaseId: null, phaseName: null, billingStatus: "non_billable" });
        return entries;
      },
    },
    // Sofie D. — student, Mon-Wed
    {
      userId: sofieD.id, name: "SofieD", weeklyTarget: 15, isHourly: true,
      workDays: [1, 2, 3],
      getEntries: (_day, mi) => [
        { projectId: hvf.id, hours: jitter(5), projectCode: "HVF", phaseId: getPhaseForProject("HVF", mi).id, phaseName: getPhaseForProject("HVF", mi).name, billingStatus: "billable" },
      ],
    },
    // Oliver — student, Tue-Fri
    {
      userId: oliver.id, name: "Oliver", weeklyTarget: 20, isHourly: true,
      workDays: [2, 3, 4, 5],
      getEntries: (_day, mi) => {
        const entries = [];
        if (mi >= 2) {
          entries.push({ projectId: khv.id, hours: jitter(3), projectCode: "KHV", phaseId: getPhaseForProject("KHV", mi).id, phaseName: getPhaseForProject("KHV", mi).name, billingStatus: "billable" });
          entries.push({ projectId: kon.id, hours: jitter(2), projectCode: "KON", phaseId: null, phaseName: null, billingStatus: "non_billable" });
        } else {
          entries.push({ projectId: hvf.id, hours: jitter(5), projectCode: "HVF", phaseId: getPhaseForProject("HVF", mi).id, phaseName: getPhaseForProject("HVF", mi).name, billingStatus: "billable" });
        }
        return entries;
      },
    },
  ];

  // Vacation dates to skip (employee → set of date keys)
  const vacationDates: Record<string, Set<string>> = {};

  // Nadia: 1 week in October (month 2, week ~10)
  const nadiaVacStart = getMonday(addWeeks(dataStart, 9));
  vacationDates[nadia.id] = new Set<string>();
  for (let i = 0; i < 5; i++) vacationDates[nadia.id].add(dateKey(addDays(nadiaVacStart, i)));

  // Anders: 1 week in September
  const andersVacStart = getMonday(addWeeks(dataStart, 5));
  vacationDates[anders.id] = new Set<string>();
  for (let i = 0; i < 5; i++) vacationDates[anders.id].add(dateKey(addDays(andersVacStart, i)));

  // Amara: 3 weeks across the period (spread out)
  vacationDates[amara.id] = new Set<string>();
  const amaraVac1 = getMonday(addWeeks(dataStart, 7)); // Oct
  for (let i = 0; i < 5; i++) vacationDates[amara.id].add(dateKey(addDays(amaraVac1, i)));
  const amaraVac2 = getMonday(addWeeks(dataStart, 15)); // Dec
  for (let i = 0; i < 5; i++) vacationDates[amara.id].add(dateKey(addDays(amaraVac2, i)));
  const amaraVac3 = getMonday(addWeeks(dataStart, 20)); // Jan
  for (let i = 0; i < 5; i++) vacationDates[amara.id].add(dateKey(addDays(amaraVac3, i)));

  // Katrine: 1 week in November
  const katrineVacStart = getMonday(addWeeks(dataStart, 11));
  vacationDates[katrine.id] = new Set<string>();
  for (let i = 0; i < 5; i++) vacationDates[katrine.id].add(dateKey(addDays(katrineVacStart, i)));

  // Erik: 1 week in October
  const erikVacStart = getMonday(addWeeks(dataStart, 8));
  vacationDates[erik.id] = new Set<string>();
  for (let i = 0; i < 5; i++) vacationDates[erik.id].add(dateKey(addDays(erikVacStart, i)));

  // Sofia: 2 weeks (1 in Sep, 1 in Dec)
  vacationDates[sofia.id] = new Set<string>();
  const sofiaVac1 = getMonday(addWeeks(dataStart, 6));
  for (let i = 0; i < 5; i++) vacationDates[sofia.id].add(dateKey(addDays(sofiaVac1, i)));
  const sofiaVac2 = getMonday(addWeeks(dataStart, 16));
  for (let i = 0; i < 5; i++) vacationDates[sofia.id].add(dateKey(addDays(sofiaVac2, i)));

  // Marcus: 1 week + 3 days
  vacationDates[marcus.id] = new Set<string>();
  const marcusVacStart = getMonday(addWeeks(dataStart, 13));
  for (let i = 0; i < 8; i++) {
    const d = addDays(marcusVacStart, i);
    if (isWorkday(d)) vacationDates[marcus.id].add(dateKey(d));
  }

  // Generate all entries
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
    submittedAt: Date | null;
    phaseId: string | null;
    phaseName: string | null;
    billingStatus: string;
  }

  const allEntries: TimeEntryInput[] = [];

  // Approval boundaries
  const janStart = new Date(2026, 0, 1, 12, 0, 0);
  const febStart = new Date(2026, 1, 1, 12, 0, 0);
  const submittedWeekStart = addWeeks(thisMonday, -1);

  // Only Jonas submitted last Friday — keeps admin badge at ~4
  function getApproval(d: Date, userId: string): { approvalStatus: string; approvedAt: Date | null; approvedBy: string | null; submittedAt: Date | null } {
    const dk = dateKey(d);
    const febKey = dateKey(febStart);
    const subKey = dateKey(submittedWeekStart);

    if (dk >= febKey) {
      if (dk >= subKey && userId === jonas.id && d.getDay() === 5) {
        // Jonas's Friday only — just enough to show the approval feature
        return { approvalStatus: "submitted", approvedAt: null, approvedBy: null, submittedAt: addDays(d, 2) };
      }
      // Feb: draft (not yet submitted)
      return { approvalStatus: "draft", approvedAt: null, approvedBy: null, submittedAt: null };
    }
    if (dk >= dateKey(janStart)) {
      // January: approved but not invoiced
      return { approvalStatus: "approved", approvedAt: addDays(d, 7), approvedBy: adminUserId, submittedAt: addDays(d, 3) };
    }
    // Before January: approved + invoiced (handled later)
    return { approvalStatus: "approved", approvedAt: addDays(d, 7), approvedBy: adminUserId, submittedAt: addDays(d, 3) };
  }

  // Generate 26 weeks of entries
  for (let weekOffset = 0; weekOffset < 26; weekOffset++) {
    const weekMonday = addWeeks(dataStart, weekOffset);

    for (const pattern of patterns) {
      for (let dayIdx = 0; dayIdx < 5; dayIdx++) {
        const day = addDays(weekMonday, dayIdx);
        const dow = day.getDay();

        if (!isWorkday(day)) continue;
        if (!pattern.workDays.includes(dow)) continue;

        // Lukas started in October — skip entries before that
        if (pattern.userId === lukas.id && weekOffset < 8) continue;

        // Check vacation
        const empVacDates = vacationDates[pattern.userId];
        if (empVacDates && empVacDates.has(dateKey(day))) continue;

        // Skip Christmas period for most (reduced staffing)
        if (isChristmasPeriod(day) && rand() > 0.3) continue;

        const monthIdx = Math.min(getMonthIndex(day, dataStart), 6);
        const approval = getApproval(day, pattern.userId);

        const dayEntries = pattern.getEntries(day, monthIdx);

        // Ensure salaried employees hit ~100% utilization (bump primary project if under target)
        if (!pattern.isHourly) {
          const totalH = dayEntries.reduce((s, e) => s + e.hours, 0);
          const dailyTarget = pattern.weeklyTarget / 5;
          if (totalH < dailyTarget - 0.5) {
            dayEntries[0].hours = snap(dayEntries[0].hours + (dailyTarget - totalH));
          }
        }

        for (const entry of dayEntries) {
          const descs = entry.billingStatus === "billable"
            ? (DESC_BILLABLE[entry.projectCode] || DESC_BILLABLE.HVF)
            : (entry.projectCode === "KON" ? DESC_BILLABLE.KON : Object.values(DESC_INTERN).flat());

          allEntries.push({
            hours: entry.hours,
            date: day,
            comment: pick(descs),
            userId: pattern.userId,
            projectId: entry.projectId,
            companyId,
            ...approval,
            phaseId: entry.phaseId,
            phaseName: entry.phaseName,
            billingStatus: entry.billingStatus,
          });
        }
      }
    }
  }

  // Bulk insert time entries
  await db.timeEntry.createMany({ data: allEntries });

  // ── INVOICES ───────────────────────────────────────────────

  // Helper to create invoice from approved entries in a date range for a project
  async function createInvoice(
    invoiceNumber: number,
    projectId: string,
    clientName: string,
    pStart: Date,
    pEnd: Date,
    status: string,
    rate: number,
    clientCvr?: string,
  ) {
    const entries = await db.timeEntry.findMany({
      where: {
        companyId,
        projectId,
        approvalStatus: "approved",
        date: { gte: pStart, lte: pEnd },
        billingStatus: "billable",
      },
      select: { id: true, hours: true, userId: true },
    });

    if (entries.length === 0) return null;

    let totalHours = 0;
    const entryIds: string[] = [];
    entries.forEach((e) => {
      totalHours += e.hours;
      entryIds.push(e.id);
    });

    totalHours = snap(totalHours);
    const subtotal = totalHours * rate;
    const vatAmount = subtotal * 0.25;
    const total = subtotal + vatAmount;

    const invoice = await db.invoice.create({
      data: {
        companyId,
        invoiceNumber,
        status,
        projectId,
        clientName,
        clientCvr: clientCvr || null,
        periodStart: pStart,
        periodEnd: pEnd,
        invoiceDate: addDays(pEnd, 3),
        dueDate: addDays(pEnd, 17),
        subtotal,
        vatRate: 25,
        vatAmount,
        total,
        currency: "DKK",
        paymentTermsDays: 14,
        lines: {
          create: [{
            sortOrder: 0,
            description: `Timer — ${clientName}`,
            quantity: totalHours,
            unitPrice: rate,
            amount: subtotal,
            type: "time",
            timeEntryIds: entryIds,
            expenseIds: [],
          }],
        },
      },
    });

    // Mark entries as invoiced (for paid/sent invoices)
    if (status === "paid" || status === "sent") {
      await db.timeEntry.updateMany({
        where: { id: { in: entryIds } },
        data: { invoiceId: invoice.id, invoicedAt: addDays(pEnd, 3) },
      });
    }

    return invoice;
  }

  // Month boundaries
  const sep1 = new Date(2025, 8, 1, 12, 0, 0);
  const oct1 = new Date(2025, 9, 1, 12, 0, 0);
  const nov1 = new Date(2025, 10, 1, 12, 0, 0);
  const dec1 = new Date(2025, 11, 1, 12, 0, 0);
  const jan1 = new Date(2026, 0, 1, 12, 0, 0);
  const feb1 = new Date(2026, 1, 1, 12, 0, 0);
  const sep30 = new Date(2025, 8, 30, 12, 0, 0);
  const oct31 = new Date(2025, 9, 31, 12, 0, 0);
  const nov30 = new Date(2025, 10, 30, 12, 0, 0);
  const dec31 = new Date(2025, 11, 31, 12, 0, 0);
  const jan31 = new Date(2026, 0, 31, 12, 0, 0);

  // Paid invoices (Aug-Dec) — historical, fully processed
  await createInvoice(1, hvf.id, "Meridian Ejendomme A/S", dataStart, sep30, "paid", 750, "31526478");
  await createInvoice(2, hvf.id, "Meridian Ejendomme A/S", oct1, nov30, "paid", 750, "31526478");
  await createInvoice(3, hvf.id, "Meridian Ejendomme A/S", dec1, dec31, "paid", 750, "31526478");
  await createInvoice(4, elm.id, "GreenBuild ApS", dataStart, oct31, "paid", 700, "42198567");
  await createInvoice(5, elm.id, "GreenBuild ApS", nov1, dec31, "paid", 700, "42198567");
  await createInvoice(6, sbk.id, "Nordstjerne Udvikling ApS", nov1, dec31, "paid", 800, "38741295");

  // January entries are approved but NOT invoiced — ready for the billing demo.
  // When the user opens "Fakturering", they see ~295k DKK ready to invoice.

  // Update company next invoice number
  await db.company.update({
    where: { id: companyId },
    data: { nextInvoiceNumber: 7 },
  });

  // ── VACATION REQUESTS ──────────────────────────────────────

  await db.vacationRequest.createMany({
    data: [
      // Anders: 1 week Sep
      { userId: anders.id, companyId, startDate: andersVacStart, endDate: addDays(andersVacStart, 4), type: "vacation", status: "approved", reviewedBy: adminUserId, reviewedAt: addDays(andersVacStart, -7) },
      // Amara: 3 separate weeks
      { userId: amara.id, companyId, startDate: amaraVac1, endDate: addDays(amaraVac1, 4), type: "vacation", status: "approved", reviewedBy: adminUserId, reviewedAt: addDays(amaraVac1, -7) },
      { userId: amara.id, companyId, startDate: amaraVac2, endDate: addDays(amaraVac2, 4), type: "vacation", status: "approved", reviewedBy: adminUserId, reviewedAt: addDays(amaraVac2, -7) },
      { userId: amara.id, companyId, startDate: amaraVac3, endDate: addDays(amaraVac3, 4), type: "vacation", status: "approved", reviewedBy: adminUserId, reviewedAt: addDays(amaraVac3, -7) },
      // Katrine: 1 week Nov
      { userId: katrine.id, companyId, startDate: katrineVacStart, endDate: addDays(katrineVacStart, 4), type: "vacation", status: "approved", reviewedBy: adminUserId, reviewedAt: addDays(katrineVacStart, -5) },
      // Erik: 1 week Oct
      { userId: erik.id, companyId, startDate: erikVacStart, endDate: addDays(erikVacStart, 4), type: "vacation", status: "approved", reviewedBy: adminUserId, reviewedAt: addDays(erikVacStart, -7) },
      // Sofia: 2 weeks
      { userId: sofia.id, companyId, startDate: sofiaVac1, endDate: addDays(sofiaVac1, 4), type: "vacation", status: "approved", reviewedBy: adminUserId, reviewedAt: addDays(sofiaVac1, -5) },
      { userId: sofia.id, companyId, startDate: sofiaVac2, endDate: addDays(sofiaVac2, 4), type: "vacation", status: "approved", reviewedBy: adminUserId, reviewedAt: addDays(sofiaVac2, -7) },
      // Marcus: 8 days
      { userId: marcus.id, companyId, startDate: marcusVacStart, endDate: addDays(marcusVacStart, 7), type: "vacation", status: "approved", reviewedBy: adminUserId, reviewedAt: addDays(marcusVacStart, -5) },
      // Nadia: 1 week Oct
      { userId: nadia.id, companyId, startDate: nadiaVacStart, endDate: addDays(nadiaVacStart, 4), type: "vacation", status: "approved", reviewedBy: adminUserId, reviewedAt: addDays(nadiaVacStart, -7) },
      // Future: Amara 3 days in February (vinterferien)
      { userId: amara.id, companyId, startDate: addDays(today, 3), endDate: addDays(today, 5), type: "vacation", status: "approved", reviewedBy: adminUserId, reviewedAt: addDays(today, -5) },
      // Future: Anders 1 week March
      { userId: anders.id, companyId, startDate: addWeeks(today, 3), endDate: addDays(addWeeks(today, 3), 4), type: "vacation", status: "approved", reviewedBy: adminUserId, reviewedAt: addDays(today, -3) },
      // Future: Marcus 1 week April (påske)
      { userId: marcus.id, companyId, startDate: addWeeks(today, 7), endDate: addDays(addWeeks(today, 7), 4), type: "vacation", status: "approved", reviewedBy: adminUserId, reviewedAt: addDays(today, -5) },
    ],
  });

  // ── EXPENSES ───────────────────────────────────────────────

  await db.expense.createMany({
    data: [
      { amount: 850, description: "Rejse til byggeplads, Havnefronten", category: "travel", date: addDays(today, -8), userId: adminUserId, projectId: hvf.id, companyId, approvalStatus: "draft" },
      { amount: 475, description: "Frokost med bygherre, Meridian", category: "meals", date: addDays(today, -5), userId: adminUserId, projectId: hvf.id, companyId, approvalStatus: "draft" },
      { amount: 1200, description: "Materialeprøver, fliser og natursten", category: "materials", date: addDays(today, -12), userId: katrine.id, projectId: vht.id, companyId, approvalStatus: "draft" },
      { amount: 120, description: "Parkering, Villa Hansen tilsyn", category: "travel", date: addDays(today, -6), userId: erik.id, projectId: vht.id, companyId, approvalStatus: "draft" },
      { amount: 2350, description: "Facadematerialeprøver, tegl", category: "materials", date: addDays(today, -15), userId: amara.id, projectId: sbk.id, companyId, approvalStatus: "draft" },
      { amount: 385, description: "Kontorartikler og printpapir", category: "other", date: addDays(today, -10), userId: sofia.id, projectId: int.id, companyId, approvalStatus: "draft" },
      { amount: 690, description: "Togbillet, Vestby Kommune møde", category: "travel", date: addDays(today, -3), userId: anders.id, projectId: khv.id, companyId, approvalStatus: "draft" },
      { amount: 1850, description: "3D-print model, konkurrence", category: "materials", date: addDays(today, -18), userId: jonas.id, projectId: kon.id, companyId, approvalStatus: "draft" },
    ],
  });

  // ── COMPANY OVERHEAD EXPENSES ──────────────────────────────────
  // Recurring monthly overhead: ~194,500 kr/month with seasonal variance
  // 25 items × 7 months (Aug 2025 → Feb 2026)

  const overheadDefs: { desc: string; cat: string; base: number; winter?: number; summer?: number; dec?: number }[] = [
    // Lokaler (~82,000 kr/mo)
    { desc: "Kontorhusleje, Nørrebrogade 60", cat: "Lokaler", base: 45000 },
    { desc: "Fællesareal & drift", cat: "Lokaler", base: 8500 },
    { desc: "Rengøring (kontor)", cat: "Lokaler", base: 4800 },
    { desc: "El & varme", cat: "Lokaler", base: 6200, winter: 1.4 },
    { desc: "Internet & telefoni", cat: "Lokaler", base: 3500 },
    { desc: "Kantine & kaffe", cat: "Lokaler", base: 5000, summer: 0.7, dec: 2.2 },
    { desc: "Kontormøbler & vedligehold", cat: "Lokaler", base: 2500 },
    { desc: "Parkering (4 pladser)", cat: "Lokaler", base: 6000 },
    // Forsikring (~12,500 kr/mo)
    { desc: "Erhvervsansvarsforsikring", cat: "Forsikring", base: 6200 },
    { desc: "Professionel ansvarsforsikring", cat: "Forsikring", base: 4800 },
    { desc: "Indboforsikring, kontor", cat: "Forsikring", base: 1500 },
    // Software & IT (~28,000 kr/mo)
    { desc: "Revit + AutoCAD licenser (12 sæder)", cat: "Software & IT", base: 14500 },
    { desc: "Adobe Creative Cloud (8 sæder)", cat: "Software & IT", base: 4800 },
    { desc: "Microsoft 365 Business", cat: "Software & IT", base: 3200 },
    { desc: "IT-support & serverhosting", cat: "Software & IT", base: 3500 },
    { desc: "Cloud Timer Pro", cat: "Software & IT", base: 2000 },
    // Rådgivere (~45,000 kr/mo)
    { desc: "Revisor (Deloitte)", cat: "Rådgivere", base: 12000 },
    { desc: "Advokatbistand", cat: "Rådgivere", base: 8000 },
    { desc: "Bygherrerådgiver", cat: "Rådgivere", base: 15000 },
    { desc: "Statiker-konsulent", cat: "Rådgivere", base: 10000 },
    // Øvrig drift (~27,000 kr/mo)
    { desc: "Faglige kurser & efteruddannelse", cat: "Øvrig drift", base: 8000 },
    { desc: "Rejse & transport", cat: "Øvrig drift", base: 6500 },
    { desc: "Print & kontorartikler", cat: "Øvrig drift", base: 3500 },
    { desc: "Repræsentation & events", cat: "Øvrig drift", base: 5000, dec: 1.8 },
    { desc: "Diverse (porto, gebyrer mv.)", cat: "Øvrig drift", base: 4000 },
  ];

  const overheadEntries: { amount: number; description: string; category: string; date: Date; recurring: boolean; frequency: string; companyId: string; createdBy: string; isFinalized: boolean }[] = [];
  for (let m = 0; m < 7; m++) {
    const monthDate = new Date(2025, 7 + m, 15, 12, 0, 0); // 15th of each month
    const gm = monthDate.getMonth(); // JS month: 7=Aug .. 11=Dec, 0=Jan, 1=Feb
    const isWinter = gm >= 10 || gm <= 2; // Oct-Feb
    const isAug = gm === 7;
    const isDec = gm === 11;

    for (const item of overheadDefs) {
      let amount = item.base;
      if (item.winter && isWinter) amount *= item.winter;
      if (item.summer && isAug) amount *= item.summer;
      if (item.dec && isDec) amount *= item.dec;
      // ±5% seeded variance
      amount *= (0.95 + rand() * 0.1);
      amount = Math.round(amount);

      overheadEntries.push({
        amount,
        description: item.desc,
        category: item.cat,
        date: monthDate,
        recurring: true,
        frequency: "monthly",
        companyId,
        createdBy: adminUserId,
        isFinalized: m < 6, // all months finalized except current (Feb)
      });
    }
  }

  await db.companyExpense.createMany({ data: overheadEntries });

  // ── RESOURCE ALLOCATIONS ───────────────────────────────────
  // Forward-looking: Feb–Apr 2026 (12 weeks forward)
  // Story: Jonas overbooked wk 1-4 (competition) + wk 8-12 (KHV pickup)
  //        Katrine at 30h capacity (sick leave) — yellow not red
  //        Nadia gap in March (between projects)
  //        April slack: Elmegade done, Nordhavn not started
  //        Sofie D ends contract in March (0h from wk 6)

  await db.resourceAllocation.createMany({
    data: [
      // Anders — steady leadership allocation
      { companyId, userId: anders.id, projectId: hvf.id, startDate: today, endDate: addWeeks(today, 12), hoursPerDay: 4.5, status: "confirmed" },
      { companyId, userId: anders.id, projectId: khv.id, startDate: today, endDate: addWeeks(today, 10), hoursPerDay: 2, status: "confirmed" },
      // Jonas — OVERBOOKED: wk 1-4 (HVF+KON = 8h/day) + wk 8-12 (HVF+KHV = 8.5h/day)
      { companyId, userId: jonas.id, projectId: hvf.id, startDate: today, endDate: addWeeks(today, 12), hoursPerDay: 5.5, status: "confirmed" },
      { companyId, userId: jonas.id, projectId: kon.id, startDate: today, endDate: addWeeks(today, 4), hoursPerDay: 2.5, status: "confirmed" },
      { companyId, userId: jonas.id, projectId: khv.id, startDate: addWeeks(today, 7), endDate: addWeeks(today, 12), hoursPerDay: 3, status: "tentative" },
      // Amara
      { companyId, userId: amara.id, projectId: khv.id, startDate: today, endDate: addWeeks(today, 10), hoursPerDay: 3, status: "confirmed" },
      { companyId, userId: amara.id, projectId: sbk.id, startDate: today, endDate: addWeeks(today, 8), hoursPerDay: 3.5, status: "confirmed" },
      // Katrine — reduced capacity (30h/wk = 6h/day)
      { companyId, userId: katrine.id, projectId: vht.id, startDate: today, endDate: addWeeks(today, 6), hoursPerDay: 4, status: "confirmed" },
      { companyId, userId: katrine.id, projectId: hvf.id, startDate: addWeeks(today, 6), endDate: addWeeks(today, 12), hoursPerDay: 3, status: "tentative" },
      // Erik
      { companyId, userId: erik.id, projectId: hvf.id, startDate: today, endDate: addWeeks(today, 10), hoursPerDay: 3.5, status: "confirmed" },
      { companyId, userId: erik.id, projectId: vht.id, startDate: today, endDate: addWeeks(today, 6), hoursPerDay: 2, status: "confirmed" },
      // Sofia — ELM wrapping up, then SBK
      { companyId, userId: sofia.id, projectId: elm.id, startDate: today, endDate: addWeeks(today, 4), hoursPerDay: 5, status: "confirmed" },
      { companyId, userId: sofia.id, projectId: sbk.id, startDate: addWeeks(today, 4), endDate: addWeeks(today, 12), hoursPerDay: 4, status: "tentative" },
      // Marcus
      { companyId, userId: marcus.id, projectId: sbk.id, startDate: today, endDate: addWeeks(today, 10), hoursPerDay: 4, status: "confirmed" },
      { companyId, userId: marcus.id, projectId: hvf.id, startDate: today, endDate: addWeeks(today, 8), hoursPerDay: 2.5, status: "confirmed" },
      // Lukas
      { companyId, userId: lukas.id, projectId: hvf.id, startDate: today, endDate: addWeeks(today, 12), hoursPerDay: 4, status: "confirmed" },
      { companyId, userId: lukas.id, projectId: sbk.id, startDate: today, endDate: addWeeks(today, 8), hoursPerDay: 2.5, status: "confirmed" },
      // Nadia — GAP in weeks 5-7 (between projects, shows as low/grey)
      { companyId, userId: nadia.id, projectId: elm.id, startDate: today, endDate: addWeeks(today, 4), hoursPerDay: 3, status: "confirmed" },
      { companyId, userId: nadia.id, projectId: khv.id, startDate: today, endDate: addWeeks(today, 4), hoursPerDay: 2, status: "confirmed" },
      { companyId, userId: nadia.id, projectId: khv.id, startDate: addWeeks(today, 7), endDate: addWeeks(today, 12), hoursPerDay: 5, status: "tentative" },
      // Sofie D. — contract ends March (wk 6)
      { companyId, userId: sofieD.id, projectId: hvf.id, startDate: today, endDate: addWeeks(today, 6), hoursPerDay: 5, status: "confirmed" },
      // Oliver
      { companyId, userId: oliver.id, projectId: khv.id, startDate: today, endDate: addWeeks(today, 8), hoursPerDay: 3, status: "confirmed" },
      { companyId, userId: oliver.id, projectId: kon.id, startDate: today, endDate: addWeeks(today, 4), hoursPerDay: 2, status: "confirmed" },
    ],
  });

  // ── PROJECT MILESTONES ─────────────────────────────────────

  await db.projectMilestone.createMany({
    data: [
      { projectId: hvf.id, title: "Afleveringsforretning", type: "phase", phaseId: phByggeledelse.id, dueDate: addWeeks(today, 16), icon: "flag", color: "#EF4444" },
      { projectId: hvf.id, title: "1-års gennemgang", type: "custom", dueDate: addWeeks(today, 52), icon: "calendar", color: "#3B82F6" },
      { projectId: khv.id, title: "Skitsepræsentation for udvalg", type: "phase", phaseId: phSkitsering.id, dueDate: addWeeks(today, 8), icon: "rocket", color: "#2563EB" },
      { projectId: sbk.id, title: "Myndighedsgodkendelse", type: "custom", dueDate: addWeeks(today, 10), icon: "calendar", color: "#059669" },
      { projectId: vht.id, title: "Aflevering til bygherre", type: "custom", dueDate: addWeeks(today, 4), icon: "handshake", color: "#F59E0B" },
      { projectId: elm.id, title: "Udbudsmateriale afleveret", type: "custom", dueDate: addWeeks(today, 3), icon: "flag", color: "#9333EA" },
      { projectId: kon.id, title: "Konkurrencefrist", type: "custom", dueDate: addWeeks(today, 4), icon: "rocket", color: "#F59E0B" },
    ],
  });

  // ── AUDIT LOG ────────────────────────────────────────────────

  await db.auditLog.createMany({
    data: [
      // Recent approval activity
      { companyId, entityType: "TimeEntry", entityId: "batch-jan-approve", action: "APPROVE", fromStatus: "submitted", toStatus: "approved", actorId: adminUserId, createdAt: new Date(2026, 0, 8, 9, 15) },
      { companyId, entityType: "TimeEntry", entityId: "batch-jan-approve-2", action: "APPROVE", fromStatus: "submitted", toStatus: "approved", actorId: adminUserId, createdAt: new Date(2026, 0, 15, 10, 30) },
      { companyId, entityType: "TimeEntry", entityId: "batch-jan-approve-3", action: "APPROVE", fromStatus: "submitted", toStatus: "approved", actorId: adminUserId, createdAt: new Date(2026, 0, 22, 14, 0) },
      { companyId, entityType: "TimeEntry", entityId: "batch-jan-approve-4", action: "APPROVE", fromStatus: "submitted", toStatus: "approved", actorId: adminUserId, createdAt: new Date(2026, 0, 29, 11, 45) },
      // Weekly submissions (only Jonas submitted Friday)
      { companyId, entityType: "TimeEntry", entityId: "batch-submit-jonas", action: "SUBMIT", fromStatus: "draft", toStatus: "submitted", actorId: jonas.id, createdAt: addDays(today, -8) },
      // Billing edits
      { companyId, entityType: "TimeEntry", entityId: "billing-edit-1", action: "EDIT_BILLING", actorId: adminUserId, metadata: JSON.stringify({ project: "Villa Hansen Tilbygning", change: "billable → non_billable", hours: 2.5 }), createdAt: new Date(2025, 11, 12, 16, 0) },
      // Phase changes
      { companyId, entityType: "Project", entityId: hvf.id, action: "PHASE_CHANGE", actorId: adminUserId, metadata: JSON.stringify({ project: "Havnefronten Residences", from: "Projektering", to: "Byggeledelse" }), createdAt: new Date(2025, 11, 2, 10, 0) },
      { companyId, entityType: "Project", entityId: khv.id, action: "PHASE_CHANGE", actorId: adminUserId, metadata: JSON.stringify({ project: "Kulturhuset Vestby", from: "Forprojekt", to: "Skitsering" }), createdAt: new Date(2025, 11, 18, 14, 30) },
      // Member activity
      { companyId, entityType: "User", entityId: lukas.id, action: "MEMBER_ADDED", actorId: adminUserId, metadata: JSON.stringify({ name: "Lukas Engström", role: "employee" }), createdAt: addWeeks(dataStart, 8) },
    ],
  });
}
