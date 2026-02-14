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
    "Brandteknisk dokumentation, etape 2",
    "Trappekerne, detaljer og snit",
    "Altanprojekt, konsol- og rækværk",
    "Fugediagram og faseplan",
    "Parkeringskælder, rampe og ventilation",
    "Teknisk revision efter myndighedskommentarer",
    "Protokol fra byggemøde",
    "Indflytningsklar checkliste",
    "Tagplan og afvanding",
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
    "Foyer og ankomstzone, koncept",
    "Lysstudie, dagslys og kunstlys",
    "Scenografi og fleksibelt rum",
    "Udearealer, forbindelse til park",
    "Materialekoncept, genanvendt tegl",
    "Tilgængelighedsanalyse, adgangsveje",
    "Konstruktionsprincip, spænd og søjler",
    "Opsamling fra borgermøde",
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
    "Ventilationsprojekt, kanaltracé",
    "Akustik, åbent kontorlandskab",
    "Møblering og inventarplan",
    "El- og IT-føringsveje",
    "Trapperum og flugtveje",
    "Facadedetalje, aluminium og glas",
    "Loftplan og belysning",
    "Terrasse og tagterrasse",
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
    "Eksisterende konstruktion, vurdering",
    "Tagkonstruktion, isolering og opbygning",
    "Installationskoordinering, VVS og EL",
    "Vinduestegninger, profiler og glas",
    "Udbudstegninger, snedkerentreprise",
    "Tilbudsevaluering med bygherre",
    "Afløbsplan, eksisterende + nyt",
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
    "Parkeringsprojekt, cykler og biler",
    "Affaldsløsning og driftsplan",
    "Terrænregulering og LAR",
    "Altandetaljer, stål og træ",
    "Trapperumskoncept, fællesindgang",
    "Tagboliger, snit og plan",
    "Brandstrategi og flugtveje",
    "Kvalitetsplan, udførelsesdokumentation",
  ],
  KON: [
    "Konkurrenceoplæg, konceptudvikling",
    "Diagrammer og analyser",
    "Rendering, perspektiv",
    "Plancher, layout",
    "Bæredygtighedsstrategi",
    "Model, 3D-print forberedelse",
    "Situationsplan og kontekstanalyse",
    "Snit og rumlige studier",
    "Referenceanalyse, lignende projekter",
    "Tekst til konkurrencebesvarelse",
    "Landskabskoncept, skolegård",
    "Konstruktionsprincip, modulopbygning",
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
    "Partnermøde, kvartalsstatus",
    "Budgetopfølgning",
    "Lønforhandling forberedelse",
  ],
  kvalitet: [
    "Kvalitetssikring, review",
    "Intern tegningsreview",
    "BIM-standarder, opdatering",
    "ISO-dokumentation",
    "Tegningstjek, koordinering",
    "Revit-familier, standardisering",
    "Kvalitetsaudit, byggepladsdok.",
  ],
  kompetence: [
    "Kursus, brandkrav",
    "Faglig sparring",
    "Revit-workshop",
    "Bæredygtighedscertificering",
    "DGNB-workshop",
    "Efteruddannelse, bygningsreglement",
    "Foredrag, arkitektforeningen",
    "Mentor-session, juniorer",
  ],
  kontor: [
    "Kontordrift",
    "IT-koordinering",
    "Fredagsmøde",
    "Intern koordinering",
    "Projektplanlægning",
    "Mandagsmorgenmøde",
    "Kontorindretning, ommøblering",
    "Arkivering, digital oprydning",
    "Tidsregistrering, opfølgning",
  ],
  management: [
    "Projektleder-møde",
    "Ressourceallokering, gennemgang",
    "Onboarding, ny medarbejder",
    "MUS-samtale forberedelse",
    "Kundetilfredshedsopfølgning",
    "Kontraktforhandling",
    "Samarbejdsmøde med underleverandør",
    "Sikkerhedsgennemgang, APV",
  ],
};

// ── Main seeder ────────────────────────────────────────────────

export async function seedDemoData(companyId: string, adminUserId: string) {
  initRng(42);

  // Pinned demo date — keeps dashboard, planned hours, and budgets consistent
  const today = noon(new Date(2026, 1, 12)); // Feb 12, 2026
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

  // ── ADMIN USER UPDATE (Marta Birk) ────────────────────────

  await db.user.update({
    where: { id: adminUserId },
    data: {
      firstName: "Marta",
      lastName: "Birk",
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
      budgetHours: 4800,
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
      budgetHours: 1400,
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
      budgetHours: 1100,
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
      budgetHours: 260,
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
      budgetHours: 1200,
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
      budgetHours: 400,
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

  // ── PROJECT ALLOCATIONS (per-employee budget) ─────────────
  // Each employee's total hours budget for the FULL project duration.
  // These are what employees see in their weekly dashboard budget bars.
  // Color thresholds: GREEN (≥50% remaining), ORANGE (20-50%), RED (<20%)
  // Mix: some GREEN (early projects), ORANGE (mid-stage), RED (tight budgets).

  await db.projectAllocation.createMany({
    data: [
      // Havnefronten — large project, tight allocations
      { projectId: hvf.id, userId: adminUserId, hours: 455, companyId },   // Marta ~420h used → ~35h left → ORANGE
      { projectId: hvf.id, userId: anders.id, hours: 610, companyId },     // ~575h → ~35h left → RED
      { projectId: hvf.id, userId: jonas.id, hours: 755, companyId },      // ~720h → ~35h left → RED
      { projectId: hvf.id, userId: amara.id, hours: 270, companyId },      // ~240h → ~30h left → ORANGE
      { projectId: hvf.id, userId: katrine.id, hours: 185, companyId },    // ~160h → ~25h left → ORANGE
      { projectId: hvf.id, userId: erik.id, hours: 575, companyId },       // ~540h → ~35h left → RED
      { projectId: hvf.id, userId: marcus.id, hours: 570, companyId },     // ~540h → ~30h left → RED
      { projectId: hvf.id, userId: lukas.id, hours: 500, companyId },      // ~464h → ~36h left → ORANGE
      { projectId: hvf.id, userId: sofieD.id, hours: 405, companyId },     // ~370h → ~35h left → ORANGE
      { projectId: hvf.id, userId: oliver.id, hours: 235, companyId },     // ~200h → ~35h left → ORANGE
      // Kulturhuset Vestby — newer project, moderate slack
      { projectId: khv.id, userId: adminUserId, hours: 225, companyId },   // Marta ~190h → ~35h left → ORANGE
      { projectId: khv.id, userId: anders.id, hours: 195, companyId },     // ~160h → ~35h left → ORANGE
      { projectId: khv.id, userId: amara.id, hours: 215, companyId },      // ~180h → ~35h left → ORANGE
      { projectId: khv.id, userId: katrine.id, hours: 150, companyId },    // ~120h → ~30h left → ORANGE
      { projectId: khv.id, userId: nadia.id, hours: 260, companyId },      // ~225h → ~35h left → ORANGE
      { projectId: khv.id, userId: oliver.id, hours: 240, companyId },     // ~204h → ~36h left → ORANGE
      // Søbredden Kontor
      { projectId: sbk.id, userId: amara.id, hours: 400, companyId },      // ~370h → ~30h left → ORANGE
      { projectId: sbk.id, userId: sofia.id, hours: 115, companyId },      // ~90h → ~25h left → ORANGE
      { projectId: sbk.id, userId: marcus.id, hours: 270, companyId },     // ~240h → ~30h left → ORANGE
      { projectId: sbk.id, userId: lukas.id, hours: 230, companyId },      // ~200h → ~30h left → ORANGE
      // Villa Hansen — tight budget, budget warning story
      { projectId: vht.id, userId: katrine.id, hours: 160, companyId },    // ~152h → ~8h left → RED
      { projectId: vht.id, userId: erik.id, hours: 72, companyId },        // ~65h → ~7h left → RED
      // Elmegade Rækkehuse — winding down
      { projectId: elm.id, userId: katrine.id, hours: 220, companyId },    // ~200h → ~20h left → ORANGE
      { projectId: elm.id, userId: sofia.id, hours: 510, companyId },      // ~480h → ~30h left → RED
      { projectId: elm.id, userId: erik.id, hours: 115, companyId },       // ~100h → ~15h left → ORANGE
      { projectId: elm.id, userId: nadia.id, hours: 285, companyId },      // ~258h → ~27h left → ORANGE
      // Arkitektkonkurrence — competition, tighter budgets
      { projectId: kon.id, userId: jonas.id, hours: 138, companyId },      // ~120h → ~18h left → ORANGE
      { projectId: kon.id, userId: nadia.id, hours: 92, companyId },       // ~75h → ~17h left → ORANGE
      { projectId: kon.id, userId: oliver.id, hours: 160, companyId },     // ~136h → ~24h left → ORANGE
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
      { name: "Lokaler", sortOrder: 0, companyId },
      { name: "Forsikring", sortOrder: 1, companyId },
      { name: "Software & IT", sortOrder: 2, companyId },
      { name: "Rådgivere", sortOrder: 3, companyId },
      { name: "Transport", sortOrder: 4, companyId },
      { name: "Materialer", sortOrder: 5, companyId },
      { name: "Øvrig drift", sortOrder: 6, companyId, isDefault: true },
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

  const patterns: WorkPattern[] = [
    // Marta (admin) — leadership heavy, 3-4 entries/day
    {
      userId: adminUserId, name: "Marta", weeklyTarget: 37, isHourly: false,
      workDays: [1, 2, 3, 4, 5],
      getEntries: (day, mi) => {
        const dow = day.getDay();
        const entries: { projectId: string; hours: number; projectCode: string; phaseId: string | null; phaseName: string | null; billingStatus: string }[] = [];
        if (dow === 1) {
          // Monday: INT 3h ledelse, HVF 2.5h, KHV 2h (if mi>=2, else INT 2h)
          entries.push({ projectId: int.id, hours: jitter(3, 0.25), projectCode: "INT", phaseId: null, phaseName: null, billingStatus: "non_billable" });
          entries.push({ projectId: hvf.id, hours: jitter(2.5, 0.25), projectCode: "HVF", phaseId: getPhaseForProject("HVF", mi).id, phaseName: getPhaseForProject("HVF", mi).name, billingStatus: "billable" });
          if (mi >= 2) {
            entries.push({ projectId: khv.id, hours: jitter(2, 0.25), projectCode: "KHV", phaseId: getPhaseForProject("KHV", mi).id, phaseName: getPhaseForProject("KHV", mi).name, billingStatus: "billable" });
          } else {
            entries.push({ projectId: int.id, hours: jitter(2, 0.25), projectCode: "INT", phaseId: null, phaseName: null, billingStatus: "non_billable" });
          }
        } else if (dow === 5) {
          // Friday: INT 2.5h kontor, HVF 2.5h, KHV 2h (if mi>=2, else HVF 4.5h), INT 0.5h
          entries.push({ projectId: int.id, hours: jitter(2.5, 0.25), projectCode: "INT", phaseId: null, phaseName: null, billingStatus: "non_billable" });
          if (mi >= 2) {
            entries.push({ projectId: hvf.id, hours: jitter(2.5, 0.25), projectCode: "HVF", phaseId: getPhaseForProject("HVF", mi).id, phaseName: getPhaseForProject("HVF", mi).name, billingStatus: "billable" });
            entries.push({ projectId: khv.id, hours: jitter(2, 0.25), projectCode: "KHV", phaseId: getPhaseForProject("KHV", mi).id, phaseName: getPhaseForProject("KHV", mi).name, billingStatus: "billable" });
          } else {
            entries.push({ projectId: hvf.id, hours: jitter(4.5, 0.25), projectCode: "HVF", phaseId: getPhaseForProject("HVF", mi).id, phaseName: getPhaseForProject("HVF", mi).name, billingStatus: "billable" });
          }
          entries.push({ projectId: int.id, hours: jitter(0.5, 0.25), projectCode: "INT", phaseId: null, phaseName: null, billingStatus: "non_billable" });
        } else {
          // Tue-Thu: INT 2h, HVF 3h, KHV 2.5h (if mi>=2, else HVF 5h, INT 0.5h)
          entries.push({ projectId: int.id, hours: jitter(2, 0.25), projectCode: "INT", phaseId: null, phaseName: null, billingStatus: "non_billable" });
          if (mi >= 2) {
            entries.push({ projectId: hvf.id, hours: jitter(3, 0.25), projectCode: "HVF", phaseId: getPhaseForProject("HVF", mi).id, phaseName: getPhaseForProject("HVF", mi).name, billingStatus: "billable" });
            entries.push({ projectId: khv.id, hours: jitter(2.5, 0.25), projectCode: "KHV", phaseId: getPhaseForProject("KHV", mi).id, phaseName: getPhaseForProject("KHV", mi).name, billingStatus: "billable" });
          } else {
            entries.push({ projectId: hvf.id, hours: jitter(5, 0.25), projectCode: "HVF", phaseId: getPhaseForProject("HVF", mi).id, phaseName: getPhaseForProject("HVF", mi).name, billingStatus: "billable" });
            entries.push({ projectId: int.id, hours: jitter(0.5, 0.25), projectCode: "INT", phaseId: null, phaseName: null, billingStatus: "non_billable" });
          }
        }
        return entries;
      },
    },
    // Anders — the "machine", highest billable partner, 3-4 entries/day, often 38h weeks
    {
      userId: anders.id, name: "Anders", weeklyTarget: 37, isHourly: false,
      workDays: [1, 2, 3, 4, 5],
      getEntries: (_day, mi) => {
        const entries: { projectId: string; hours: number; projectCode: string; phaseId: string | null; phaseName: string | null; billingStatus: string }[] = [];
        entries.push({ projectId: hvf.id, hours: jitter(4.5, 0.25), projectCode: "HVF", phaseId: getPhaseForProject("HVF", mi).id, phaseName: getPhaseForProject("HVF", mi).name, billingStatus: "billable" });
        if (mi >= 2) {
          entries.push({ projectId: khv.id, hours: jitter(2, 0.25), projectCode: "KHV", phaseId: getPhaseForProject("KHV", mi).id, phaseName: getPhaseForProject("KHV", mi).name, billingStatus: "billable" });
        }
        entries.push({ projectId: int.id, hours: jitter(1.5, 0.25), projectCode: "INT", phaseId: null, phaseName: null, billingStatus: "non_billable" });
        // Some days extra HVF 1h (rand()<0.3), pushing to 38h weeks → flex climbs to +11
        if (rand() < 0.3) {
          entries.push({ projectId: hvf.id, hours: jitter(1, 0.25), projectCode: "HVF", phaseId: getPhaseForProject("HVF", mi).id, phaseName: getPhaseForProject("HVF", mi).name, billingStatus: "billable" });
        }
        return entries;
      },
    },
    // Jonas — frantic, 3-4 entries/day (smaller blocks), logs 38-40h, flex growing to -12.5
    {
      userId: jonas.id, name: "Jonas", weeklyTarget: 37, isHourly: false,
      workDays: [1, 2, 3, 4, 5],
      getEntries: (_day, mi) => {
        const entries: { projectId: string; hours: number; projectCode: string; phaseId: string | null; phaseName: string | null; billingStatus: string }[] = [];
        // HVF main: 3.5h + another HVF block 2h
        entries.push({ projectId: hvf.id, hours: jitter(3.5, 0.25), projectCode: "HVF", phaseId: getPhaseForProject("HVF", mi).id, phaseName: getPhaseForProject("HVF", mi).name, billingStatus: "billable" });
        entries.push({ projectId: hvf.id, hours: jitter(2, 0.25), projectCode: "HVF", phaseId: getPhaseForProject("HVF", mi).id, phaseName: getPhaseForProject("HVF", mi).name, billingStatus: "billable" });
        // KON competition: 1.5h (if mi>=2)
        if (mi >= 2) {
          entries.push({ projectId: kon.id, hours: jitter(1.5, 0.25), projectCode: "KON", phaseId: null, phaseName: null, billingStatus: "non_billable" });
        }
        // Extra HVF 1h block if rand()<0.5 (push to 8-8.5h days)
        if (rand() < 0.5) {
          entries.push({ projectId: hvf.id, hours: jitter(1, 0.25), projectCode: "HVF", phaseId: getPhaseForProject("HVF", mi).id, phaseName: getPhaseForProject("HVF", mi).name, billingStatus: "billable" });
        }
        // INT 0.5h only
        entries.push({ projectId: int.id, hours: jitter(0.5, 0.25), projectCode: "INT", phaseId: null, phaseName: null, billingStatus: "non_billable" });
        return entries;
      },
    },
    // Amara — EXACTLY 2 entries most days (focused, deep work). Very consistent 7.5h days.
    {
      userId: amara.id, name: "Amara", weeklyTarget: 37, isHourly: false,
      workDays: [1, 2, 3, 4, 5],
      getEntries: (day, mi) => {
        const dow = day.getDay();
        const entries: { projectId: string; hours: number; projectCode: string; phaseId: string | null; phaseName: string | null; billingStatus: string }[] = [];
        if (mi < 3) {
          // Early: HVF 4h + SBK 3.5h
          entries.push({ projectId: hvf.id, hours: jitter(4, 0.25), projectCode: "HVF", phaseId: getPhaseForProject("HVF", mi).id, phaseName: getPhaseForProject("HVF", mi).name, billingStatus: "billable" });
          entries.push({ projectId: sbk.id, hours: jitter(3.5, 0.25), projectCode: "SBK", phaseId: getPhaseForProject("SBK", mi).id, phaseName: getPhaseForProject("SBK", mi).name, billingStatus: "billable" });
        } else {
          // Middle and Late (mi>=3): KHV 4h + SBK 3.5h
          entries.push({ projectId: khv.id, hours: jitter(4, 0.25), projectCode: "KHV", phaseId: getPhaseForProject("KHV", mi).id, phaseName: getPhaseForProject("KHV", mi).name, billingStatus: "billable" });
          entries.push({ projectId: sbk.id, hours: jitter(3.5, 0.25), projectCode: "SBK", phaseId: getPhaseForProject("SBK", mi).id, phaseName: getPhaseForProject("SBK", mi).name, billingStatus: "billable" });
        }
        // Minimal intern — only add INT 0.5h on Fridays
        if (dow === 5) {
          entries.push({ projectId: int.id, hours: jitter(0.5, 0.25), projectCode: "INT", phaseId: null, phaseName: null, billingStatus: "non_billable" });
        }
        return entries;
      },
    },
    // Katrine — renovation specialist, VHT budget warning story (30h/wk now, was 37 pre-Jan)
    {
      userId: katrine.id, name: "Katrine", weeklyTarget: 30, isHourly: false,
      workDays: [1, 2, 3, 4, 5],
      getEntries: (day, mi) => {
        const entries: { projectId: string; hours: number; projectCode: string; phaseId: string | null; phaseName: string | null; billingStatus: string }[] = [];
        if (mi < 5) {
          // Pre-Jan (mi<5): 37h/wk = 7.4h/day
          // VHT V-shaped
          let vhtH: number;
          if (mi === 0) vhtH = 1;
          else if (mi === 1) vhtH = 1.5;
          else if (mi === 2) vhtH = 2;
          else if (mi === 3 && day.getDate() <= 14) vhtH = 2.5;
          else if (mi === 3) vhtH = 0.5;
          else vhtH = 0.5; // mi===4
          entries.push({ projectId: vht.id, hours: jitter(vhtH, 0.25), projectCode: "VHT", phaseId: getPhaseForProject("VHT", mi).id, phaseName: getPhaseForProject("VHT", mi).name, billingStatus: "billable" });
          // ELM 2h + HVF/KHV 2h + INT 1.5h (fills to ~7.4h)
          entries.push({ projectId: elm.id, hours: jitter(2, 0.25), projectCode: "ELM", phaseId: getPhaseForProject("ELM", mi).id, phaseName: getPhaseForProject("ELM", mi).name, billingStatus: "billable" });
          if (mi < 2) {
            entries.push({ projectId: hvf.id, hours: jitter(2, 0.25), projectCode: "HVF", phaseId: getPhaseForProject("HVF", mi).id, phaseName: getPhaseForProject("HVF", mi).name, billingStatus: "billable" });
          } else {
            entries.push({ projectId: khv.id, hours: jitter(2, 0.25), projectCode: "KHV", phaseId: getPhaseForProject("KHV", mi).id, phaseName: getPhaseForProject("KHV", mi).name, billingStatus: "billable" });
          }
          entries.push({ projectId: int.id, hours: jitter(1.5, 0.25), projectCode: "INT", phaseId: null, phaseName: null, billingStatus: "non_billable" });
        } else {
          // Post-Jan (mi>=5): 30h/wk = 6h/day
          entries.push({ projectId: hvf.id, hours: jitter(4, 0.25), projectCode: "HVF", phaseId: getPhaseForProject("HVF", mi).id, phaseName: getPhaseForProject("HVF", mi).name, billingStatus: "billable" });
          entries.push({ projectId: int.id, hours: jitter(2, 0.25), projectCode: "INT", phaseId: null, phaseName: null, billingStatus: "non_billable" });
          // VHT: rare 0.5h (rand()<0.2)
          if (rand() < 0.2) {
            entries.push({ projectId: vht.id, hours: jitter(0.5, 0.25), projectCode: "VHT", phaseId: getPhaseForProject("VHT", mi).id, phaseName: getPhaseForProject("VHT", mi).name, billingStatus: "billable" });
          }
        }
        return entries;
      },
    },
    // Erik — BIM specialist, 2-3 entries/day
    {
      userId: erik.id, name: "Erik", weeklyTarget: 37, isHourly: false,
      workDays: [1, 2, 3, 4, 5],
      getEntries: (day, mi) => {
        const entries: { projectId: string; hours: number; projectCode: string; phaseId: string | null; phaseName: string | null; billingStatus: string }[] = [];
        // HVF BIM main: 4.5h
        entries.push({ projectId: hvf.id, hours: jitter(4.5, 0.25), projectCode: "HVF", phaseId: getPhaseForProject("HVF", mi).id, phaseName: getPhaseForProject("HVF", mi).name, billingStatus: "billable" });
        // VHT minor: 1h (mi<=2) or 0.5h (mi 3, day<=14), none after
        if (mi <= 2) {
          entries.push({ projectId: vht.id, hours: jitter(1, 0.25), projectCode: "VHT", phaseId: getPhaseForProject("VHT", mi).id, phaseName: getPhaseForProject("VHT", mi).name, billingStatus: "billable" });
        } else if (mi === 3 && day.getDate() <= 14) {
          entries.push({ projectId: vht.id, hours: jitter(0.5, 0.25), projectCode: "VHT", phaseId: getPhaseForProject("VHT", mi).id, phaseName: getPhaseForProject("VHT", mi).name, billingStatus: "billable" });
        }
        // ELM support: 1h (mi<=4)
        if (mi <= 4) {
          entries.push({ projectId: elm.id, hours: jitter(1, 0.25), projectCode: "ELM", phaseId: getPhaseForProject("ELM", mi).id, phaseName: getPhaseForProject("ELM", mi).name, billingStatus: "billable" });
        }
        // INT 1h (QA/standards)
        entries.push({ projectId: int.id, hours: jitter(1, 0.25), projectCode: "INT", phaseId: null, phaseName: null, billingStatus: "non_billable" });
        return entries;
      },
    },
    // Sofia — 2-3 entries/day, ELM lead
    {
      userId: sofia.id, name: "Sofia", weeklyTarget: 37, isHourly: false,
      workDays: [1, 2, 3, 4, 5],
      getEntries: (day, mi) => {
        const dow = day.getDay();
        const entries: { projectId: string; hours: number; projectCode: string; phaseId: string | null; phaseName: string | null; billingStatus: string }[] = [];
        // ELM main: 4h
        entries.push({ projectId: elm.id, hours: jitter(4, 0.25), projectCode: "ELM", phaseId: getPhaseForProject("ELM", mi).id, phaseName: getPhaseForProject("ELM", mi).name, billingStatus: "billable" });
        // SBK: 1.5h (mi>=3)
        if (mi >= 3) {
          entries.push({ projectId: sbk.id, hours: jitter(1.5, 0.25), projectCode: "SBK", phaseId: getPhaseForProject("SBK", mi).id, phaseName: getPhaseForProject("SBK", mi).name, billingStatus: "billable" });
        }
        // INT: 1h normally, Fri (dow===5): 2h kompetenceudvikling
        if (dow === 5) {
          entries.push({ projectId: int.id, hours: jitter(2, 0.25), projectCode: "INT", phaseId: null, phaseName: null, billingStatus: "non_billable" });
        } else {
          entries.push({ projectId: int.id, hours: jitter(1, 0.25), projectCode: "INT", phaseId: null, phaseName: null, billingStatus: "non_billable" });
        }
        return entries;
      },
    },
    // Marcus — interiors, 2-3 entries/day
    {
      userId: marcus.id, name: "Marcus", weeklyTarget: 37, isHourly: false,
      workDays: [1, 2, 3, 4, 5],
      getEntries: (_day, mi) => {
        const entries: { projectId: string; hours: number; projectCode: string; phaseId: string | null; phaseName: string | null; billingStatus: string }[] = [];
        if (mi >= 3) {
          // SBK main: 4h, HVF: 2.5h
          entries.push({ projectId: sbk.id, hours: jitter(4, 0.25), projectCode: "SBK", phaseId: getPhaseForProject("SBK", mi).id, phaseName: getPhaseForProject("SBK", mi).name, billingStatus: "billable" });
          entries.push({ projectId: hvf.id, hours: jitter(2.5, 0.25), projectCode: "HVF", phaseId: getPhaseForProject("HVF", mi).id, phaseName: getPhaseForProject("HVF", mi).name, billingStatus: "billable" });
        } else {
          // Before mi>=3: HVF 4h + HVF extra 2.5h
          entries.push({ projectId: hvf.id, hours: jitter(4, 0.25), projectCode: "HVF", phaseId: getPhaseForProject("HVF", mi).id, phaseName: getPhaseForProject("HVF", mi).name, billingStatus: "billable" });
          entries.push({ projectId: hvf.id, hours: jitter(2.5, 0.25), projectCode: "HVF", phaseId: getPhaseForProject("HVF", mi).id, phaseName: getPhaseForProject("HVF", mi).name, billingStatus: "billable" });
        }
        // INT: 1h
        entries.push({ projectId: int.id, hours: jitter(1, 0.25), projectCode: "INT", phaseId: null, phaseName: null, billingStatus: "non_billable" });
        return entries;
      },
    },
    // Lukas — junior, very billable, 2 entries/day, starts weekOffset 8
    {
      userId: lukas.id, name: "Lukas", weeklyTarget: 37, isHourly: false,
      workDays: [1, 2, 3, 4, 5],
      getEntries: (_day, mi) => {
        const entries: { projectId: string; hours: number; projectCode: string; phaseId: string | null; phaseName: string | null; billingStatus: string }[] = [];
        // HVF: 4.5h
        entries.push({ projectId: hvf.id, hours: jitter(4.5, 0.25), projectCode: "HVF", phaseId: getPhaseForProject("HVF", mi).id, phaseName: getPhaseForProject("HVF", mi).name, billingStatus: "billable" });
        if (mi >= 3) {
          // SBK: 2.5h
          entries.push({ projectId: sbk.id, hours: jitter(2.5, 0.25), projectCode: "SBK", phaseId: getPhaseForProject("SBK", mi).id, phaseName: getPhaseForProject("SBK", mi).name, billingStatus: "billable" });
        } else {
          // HVF extra 2.5h
          entries.push({ projectId: hvf.id, hours: jitter(2.5, 0.25), projectCode: "HVF", phaseId: getPhaseForProject("HVF", mi).id, phaseName: getPhaseForProject("HVF", mi).name, billingStatus: "billable" });
        }
        // INT: 0.5h (only some days: rand()<0.4)
        if (rand() < 0.4) {
          entries.push({ projectId: int.id, hours: jitter(0.5, 0.25), projectCode: "INT", phaseId: null, phaseName: null, billingStatus: "non_billable" });
        }
        return entries;
      },
    },
    // Nadia — research + competition, 2-3 entries/day
    {
      userId: nadia.id, name: "Nadia", weeklyTarget: 37, isHourly: false,
      workDays: [1, 2, 3, 4, 5],
      getEntries: (_day, mi) => {
        const entries: { projectId: string; hours: number; projectCode: string; phaseId: string | null; phaseName: string | null; billingStatus: string }[] = [];
        // ELM: 2.5h (mi<5, else 1h)
        if (mi < 5) {
          entries.push({ projectId: elm.id, hours: jitter(2.5, 0.25), projectCode: "ELM", phaseId: getPhaseForProject("ELM", mi).id, phaseName: getPhaseForProject("ELM", mi).name, billingStatus: "billable" });
        } else {
          entries.push({ projectId: elm.id, hours: jitter(1, 0.25), projectCode: "ELM", phaseId: getPhaseForProject("ELM", mi).id, phaseName: getPhaseForProject("ELM", mi).name, billingStatus: "billable" });
        }
        // KHV: 3h (mi>=2)
        if (mi >= 2) {
          entries.push({ projectId: khv.id, hours: jitter(3, 0.25), projectCode: "KHV", phaseId: getPhaseForProject("KHV", mi).id, phaseName: getPhaseForProject("KHV", mi).name, billingStatus: "billable" });
        }
        // KON: 1h (mi>=2, non-billable)
        if (mi >= 2) {
          entries.push({ projectId: kon.id, hours: jitter(1, 0.25), projectCode: "KON", phaseId: null, phaseName: null, billingStatus: "non_billable" });
        }
        // INT: 1h
        entries.push({ projectId: int.id, hours: jitter(1, 0.25), projectCode: "INT", phaseId: null, phaseName: null, billingStatus: "non_billable" });
        return entries;
      },
    },
    // Sofie D. — student, Mon-Wed, 1-2 entries/day, all HVF BIM
    {
      userId: sofieD.id, name: "SofieD", weeklyTarget: 15, isHourly: true,
      workDays: [1, 2, 3],
      getEntries: (_day, mi) => {
        // Single 5h block, or sometimes split: HVF 3h + HVF 2h
        if (rand() < 0.6) {
          return [
            { projectId: hvf.id, hours: jitter(5, 0.25), projectCode: "HVF", phaseId: getPhaseForProject("HVF", mi).id, phaseName: getPhaseForProject("HVF", mi).name, billingStatus: "billable" },
          ];
        }
        return [
          { projectId: hvf.id, hours: jitter(3, 0.25), projectCode: "HVF", phaseId: getPhaseForProject("HVF", mi).id, phaseName: getPhaseForProject("HVF", mi).name, billingStatus: "billable" },
          { projectId: hvf.id, hours: jitter(2, 0.25), projectCode: "HVF", phaseId: getPhaseForProject("HVF", mi).id, phaseName: getPhaseForProject("HVF", mi).name, billingStatus: "billable" },
        ];
      },
    },
    // Oliver — student, Tue-Fri, 1-2 entries/day
    {
      userId: oliver.id, name: "Oliver", weeklyTarget: 20, isHourly: true,
      workDays: [2, 3, 4, 5],
      getEntries: (_day, mi) => {
        if (mi < 2) {
          // mi<2: HVF 5h
          return [
            { projectId: hvf.id, hours: jitter(5, 0.25), projectCode: "HVF", phaseId: getPhaseForProject("HVF", mi).id, phaseName: getPhaseForProject("HVF", mi).name, billingStatus: "billable" },
          ];
        }
        // mi>=2: KHV 3h + KON 2h (non-billable)
        return [
          { projectId: khv.id, hours: jitter(3, 0.25), projectCode: "KHV", phaseId: getPhaseForProject("KHV", mi).id, phaseName: getPhaseForProject("KHV", mi).name, billingStatus: "billable" },
          { projectId: kon.id, hours: jitter(2, 0.25), projectCode: "KON", phaseId: null, phaseName: null, billingStatus: "non_billable" },
        ];
      },
    },
  ];

  // Vacation dates to skip (employee → set of date keys)
  const vacationDates: Record<string, Set<string>> = {};

  // Marta (admin): 3 days in November (Wed-Fri, week 13)
  const martaVacStart = addDays(getMonday(addWeeks(dataStart, 13)), 2); // Wednesday
  vacationDates[adminUserId] = new Set<string>();
  for (let i = 0; i < 3; i++) vacationDates[adminUserId].add(dateKey(addDays(martaVacStart, i)));

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

  // ── SICK DAYS ──────────────────────────────────────────────

  const sickDays = new Set<string>();

  const addSick = (userId: string, weekOffset: number, ...dayIndexes: number[]) => {
    const weekMon = addWeeks(dataStart, weekOffset);
    for (const di of dayIndexes) {
      const d = addDays(weekMon, di);
      sickDays.add(`${userId}\t${dateKey(d)}`);
    }
  };

  // Hard-coded sick events
  addSick(jonas.id, 9, 0, 1);           // Mon-Tue Oct
  addSick(jonas.id, 22, 4);             // Fri Jan
  addSick(erik.id, 14, 0, 1, 2, 3);     // Mon-Thu Nov — flu
  addSick(nadia.id, 17, 2, 3, 4);       // Wed-Fri Dec
  addSick(sofia.id, 23, 0, 1);          // Mon-Tue Jan
  if (26 <= 26) addSick(marcus.id, 26, 3, 4); // Thu-Fri Feb (cap check)
  addSick(amara.id, 4, 2);              // Wed Sep
  addSick(anders.id, 13, 3);            // Thu Nov
  addSick(lukas.id, 22, 0, 1);          // Mon-Tue Jan
  addSick(adminUserId, 16, 3, 4);       // Thu-Fri Dec
  addSick(katrine.id, 18, 0, 1, 2, 3, 4); // Mon-Fri late Dec — 5 days
  addSick(sofieD.id, 12, 2);            // Wed Nov
  addSick(oliver.id, 21, 3);            // Thu Jan

  // Track sick day counts per person for capping partners
  const sickCounts: Record<string, number> = {};
  Array.from(sickDays).forEach((key) => {
    const uid = key.split("\t")[0];
    sickCounts[uid] = (sickCounts[uid] || 0) + 1;
  });

  // Generate ~20 more random sick days
  const allUserIds = [adminUserId, anders.id, jonas.id, amara.id, katrine.id, erik.id, sofia.id, marcus.id, lukas.id, nadia.id, sofieD.id, oliver.id];
  const studentIds = new Set([sofieD.id, oliver.id]);
  const partnerIds = new Set([adminUserId, anders.id]);
  let randomSickAdded = 0;

  while (randomSickAdded < 20) {
    // Pick random employee (students less likely: 15% chance for student)
    let uid: string;
    if (rand() < 0.15) {
      uid = pick([sofieD.id, oliver.id]);
    } else {
      uid = pick(allUserIds.filter(u => !studentIds.has(u)));
    }

    // Pick random weekOffset (65% chance for 12-26 = Nov-Feb)
    let wo: number;
    if (rand() < 0.65) {
      wo = 12 + Math.floor(rand() * 15); // 12-26
    } else {
      wo = Math.floor(rand() * 27); // 0-26
    }

    // Lukas starts at week 8
    if (uid === lukas.id && wo < 8) continue;

    // Pick random weekday (0=Mon .. 4=Fri)
    const di = Math.floor(rand() * 5);
    const sickDate = addDays(addWeeks(dataStart, wo), di);
    const dk = dateKey(sickDate);
    const sickKey = `${uid}\t${dk}`;

    // Skip if holiday, vacation, or already sick
    if (!isWorkday(sickDate)) continue;
    const empVac = vacationDates[uid];
    if (empVac && empVac.has(dk)) continue;
    if (sickDays.has(sickKey)) continue;

    // Cap partners at 3 total sick days
    if (partnerIds.has(uid) && (sickCounts[uid] || 0) >= 3) continue;

    sickDays.add(sickKey);
    sickCounts[uid] = (sickCounts[uid] || 0) + 1;
    randomSickAdded++;

    // 60% chance of clustering (if sick today, maybe sick tomorrow too)
    if (rand() < 0.6 && di < 4) {
      const nextDate = addDays(addWeeks(dataStart, wo), di + 1);
      const ndk = dateKey(nextDate);
      const nextKey = `${uid}\t${ndk}`;
      if (isWorkday(nextDate) && !sickDays.has(nextKey)) {
        const nextEmpVac = vacationDates[uid];
        if (!(nextEmpVac && nextEmpVac.has(ndk))) {
          if (!(partnerIds.has(uid) && (sickCounts[uid] || 0) >= 3)) {
            sickDays.add(nextKey);
            sickCounts[uid] = (sickCounts[uid] || 0) + 1;
          }
        }
      }
    }
  }

  function isSickDay(userId: string, date: Date): boolean {
    return sickDays.has(`${userId}\t${dateKey(date)}`);
  }

  // ── ENTRY GENERATION ───────────────────────────────────────

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

  // Exactly 2 admin notifications. Only Erik and Lukas get 1 submitted entry each on last Friday.
  const submittedForApproval = new Set<string>();
  const lastFridayKey = dateKey(addDays(submittedWeekStart, 4));

  function getApproval(d: Date, userId: string): { approvalStatus: string; approvedAt: Date | null; approvedBy: string | null; submittedAt: Date | null } {
    const dk = dateKey(d);
    const febKey = dateKey(febStart);
    if (dk >= febKey) {
      if (dk === lastFridayKey && (userId === erik.id || userId === lukas.id) && !submittedForApproval.has(userId)) {
        submittedForApproval.add(userId);
        return { approvalStatus: "submitted", approvedAt: null, approvedBy: null, submittedAt: addDays(d, 2) };
      }
      return { approvalStatus: "draft", approvedAt: null, approvedBy: null, submittedAt: null };
    }
    if (dk >= dateKey(janStart)) {
      return { approvalStatus: "approved", approvedAt: addDays(d, 7), approvedBy: adminUserId, submittedAt: addDays(d, 3) };
    }
    return { approvalStatus: "approved", approvedAt: addDays(d, 7), approvedBy: adminUserId, submittedAt: addDays(d, 3) };
  }

  // Generate 27 weeks of entries (26 historical + current week as draft)
  for (let weekOffset = 0; weekOffset <= 26; weekOffset++) {
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

        // Check sick day
        if (isSickDay(pattern.userId, day)) continue;

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
      // Marta: 3 days Nov (Wed-Fri)
      { userId: adminUserId, companyId, startDate: martaVacStart, endDate: addDays(martaVacStart, 2), type: "vacation", status: "approved", reviewedBy: adminUserId, reviewedAt: addDays(martaVacStart, -5) },
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

  const overheadEntries: { amount: number; description: string; category: string; date: Date; recurring: boolean; frequency?: string; companyId: string; createdBy: string; isFinalized: boolean }[] = [];
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
        recurring: false,
        companyId,
        createdBy: adminUserId,
        isFinalized: m < 6, // all months finalized except current (Feb)
      });
    }
  }

  await db.companyExpense.createMany({ data: overheadEntries });

  // ── RESOURCE ALLOCATIONS ───────────────────────────────────
  // Cover BOTH historical (dataStart → today) and forward (today → +12wk) periods.
  // hoursPerDay = Mon-Thu rate; the planned-hours API auto-scales Friday to 7h for 37h employees.
  // All salaried employees sum to 7.5h/day Mon-Thu (→ 37h/wk with 7h Fri).

  const wk8 = addWeeks(dataStart, 8);   // ~Oct: KHV/KON start for some
  const wk13 = addWeeks(dataStart, 13); // ~Nov: Amara switches HVF→KHV

  await db.resourceAllocation.createMany({
    data: [
      // ── Marta (37h/wk) ──
      // Historical early (dataStart→wk8): HVF 5h + INT 2.5h = 7.5h
      { companyId, userId: adminUserId, projectId: hvf.id, startDate: dataStart, endDate: wk8, hoursPerDay: 5, status: "confirmed" },
      { companyId, userId: adminUserId, projectId: int.id, startDate: dataStart, endDate: wk8, hoursPerDay: 2.5, status: "confirmed" },
      // Historical+forward (wk8→today+12): HVF 3h + KHV 2h + INT 2.5h = 7.5h
      { companyId, userId: adminUserId, projectId: hvf.id, startDate: wk8, endDate: addWeeks(today, 12), hoursPerDay: 3, status: "confirmed" },
      { companyId, userId: adminUserId, projectId: khv.id, startDate: wk8, endDate: addWeeks(today, 12), hoursPerDay: 2, status: "confirmed" },
      { companyId, userId: adminUserId, projectId: int.id, startDate: wk8, endDate: addWeeks(today, 12), hoursPerDay: 2.5, status: "confirmed" },

      // ── Anders (37h/wk) ──
      // Early (dataStart→wk8): HVF 6h + INT 1.5h = 7.5h
      { companyId, userId: anders.id, projectId: hvf.id, startDate: dataStart, endDate: wk8, hoursPerDay: 6, status: "confirmed" },
      { companyId, userId: anders.id, projectId: int.id, startDate: dataStart, endDate: wk8, hoursPerDay: 1.5, status: "confirmed" },
      // Main (wk8→today+12): HVF 4.5h + KHV 2h + INT 1h = 7.5h
      { companyId, userId: anders.id, projectId: hvf.id, startDate: wk8, endDate: addWeeks(today, 12), hoursPerDay: 4.5, status: "confirmed" },
      { companyId, userId: anders.id, projectId: khv.id, startDate: wk8, endDate: addWeeks(today, 12), hoursPerDay: 2, status: "confirmed" },
      { companyId, userId: anders.id, projectId: int.id, startDate: wk8, endDate: addWeeks(today, 12), hoursPerDay: 1, status: "confirmed" },

      // ── Jonas (37h/wk) ──
      // Early (dataStart→wk8): HVF 6.5h + INT 1h = 7.5h
      { companyId, userId: jonas.id, projectId: hvf.id, startDate: dataStart, endDate: wk8, hoursPerDay: 6.5, status: "confirmed" },
      { companyId, userId: jonas.id, projectId: int.id, startDate: dataStart, endDate: addWeeks(today, 12), hoursPerDay: 0.5, status: "confirmed" },
      // Main (wk8→today): HVF 5.5h + KON 1.5h = 7.5h (+ INT 0.5)
      { companyId, userId: jonas.id, projectId: hvf.id, startDate: wk8, endDate: addWeeks(today, 12), hoursPerDay: 5.5, status: "confirmed" },
      { companyId, userId: jonas.id, projectId: kon.id, startDate: wk8, endDate: addWeeks(today, 4), hoursPerDay: 1.5, status: "confirmed" },
      // Forward overbooked (today+7→+12): KHV 2.5h added
      { companyId, userId: jonas.id, projectId: khv.id, startDate: addWeeks(today, 7), endDate: addWeeks(today, 12), hoursPerDay: 2.5, status: "tentative" },

      // ── Amara (37h/wk) ──
      // Early (dataStart→wk13): HVF 4h + SBK 3.5h = 7.5h
      { companyId, userId: amara.id, projectId: hvf.id, startDate: dataStart, endDate: wk13, hoursPerDay: 4, status: "confirmed" },
      { companyId, userId: amara.id, projectId: sbk.id, startDate: dataStart, endDate: wk13, hoursPerDay: 3.5, status: "confirmed" },
      // Main (wk13→today+10): KHV 4h + SBK 3.5h = 7.5h
      { companyId, userId: amara.id, projectId: khv.id, startDate: wk13, endDate: addWeeks(today, 10), hoursPerDay: 4, status: "confirmed" },
      { companyId, userId: amara.id, projectId: sbk.id, startDate: wk13, endDate: addWeeks(today, 10), hoursPerDay: 3.5, status: "confirmed" },

      // ── Katrine (30h/wk = 6h/day, no Friday scaling) ──
      // Historical pre-Jan (dataStart→wk22): VHT 1.5h + ELM 2h + HVF 1.5h + INT 1h = 6h
      { companyId, userId: katrine.id, projectId: vht.id, startDate: dataStart, endDate: addWeeks(dataStart, 22), hoursPerDay: 1.5, status: "confirmed" },
      { companyId, userId: katrine.id, projectId: elm.id, startDate: dataStart, endDate: addWeeks(dataStart, 22), hoursPerDay: 2, status: "confirmed" },
      { companyId, userId: katrine.id, projectId: hvf.id, startDate: dataStart, endDate: addWeeks(dataStart, 22), hoursPerDay: 1.5, status: "confirmed" },
      { companyId, userId: katrine.id, projectId: int.id, startDate: dataStart, endDate: addWeeks(dataStart, 22), hoursPerDay: 1, status: "confirmed" },
      // Post-Jan (wk22→today+6): HVF 4h + INT 2h = 6h
      { companyId, userId: katrine.id, projectId: hvf.id, startDate: addWeeks(dataStart, 22), endDate: addWeeks(today, 6), hoursPerDay: 4, status: "confirmed" },
      { companyId, userId: katrine.id, projectId: int.id, startDate: addWeeks(dataStart, 22), endDate: addWeeks(today, 6), hoursPerDay: 2, status: "confirmed" },
      // Forward (today+6→+12): HVF 4h + INT 2h = 6h
      { companyId, userId: katrine.id, projectId: hvf.id, startDate: addWeeks(today, 6), endDate: addWeeks(today, 12), hoursPerDay: 4, status: "tentative" },
      { companyId, userId: katrine.id, projectId: int.id, startDate: addWeeks(today, 6), endDate: addWeeks(today, 12), hoursPerDay: 2, status: "tentative" },

      // ── Erik (37h/wk) ──
      // Full period: HVF 4.5h + VHT 1h + ELM 1h + INT 1h = 7.5h
      { companyId, userId: erik.id, projectId: hvf.id, startDate: dataStart, endDate: addWeeks(today, 12), hoursPerDay: 4.5, status: "confirmed" },
      { companyId, userId: erik.id, projectId: vht.id, startDate: dataStart, endDate: addWeeks(today, 6), hoursPerDay: 1, status: "confirmed" },
      { companyId, userId: erik.id, projectId: elm.id, startDate: dataStart, endDate: addWeeks(today, 4), hoursPerDay: 1, status: "confirmed" },
      { companyId, userId: erik.id, projectId: int.id, startDate: dataStart, endDate: addWeeks(today, 12), hoursPerDay: 1, status: "confirmed" },
      { companyId, userId: erik.id, projectId: khv.id, startDate: addWeeks(today, 6), endDate: addWeeks(today, 12), hoursPerDay: 1, status: "tentative" },

      // ── Sofia (37h/wk) ──
      // Full: ELM 4h + INT 1.5h + SBK 2h = 7.5h
      { companyId, userId: sofia.id, projectId: elm.id, startDate: dataStart, endDate: addWeeks(today, 8), hoursPerDay: 4, status: "confirmed" },
      { companyId, userId: sofia.id, projectId: int.id, startDate: dataStart, endDate: addWeeks(today, 12), hoursPerDay: 1.5, status: "confirmed" },
      { companyId, userId: sofia.id, projectId: sbk.id, startDate: addWeeks(dataStart, 12), endDate: addWeeks(today, 12), hoursPerDay: 2, status: "confirmed" },

      // ── Marcus (37h/wk) ──
      // Early (dataStart→wk13): HVF 6.5h + INT 1h = 7.5h
      { companyId, userId: marcus.id, projectId: hvf.id, startDate: dataStart, endDate: wk13, hoursPerDay: 6.5, status: "confirmed" },
      { companyId, userId: marcus.id, projectId: int.id, startDate: dataStart, endDate: addWeeks(today, 10), hoursPerDay: 1, status: "confirmed" },
      // Main (wk13→today+10): SBK 4h + HVF 2.5h + INT 1h = 7.5h
      { companyId, userId: marcus.id, projectId: sbk.id, startDate: wk13, endDate: addWeeks(today, 10), hoursPerDay: 4, status: "confirmed" },
      { companyId, userId: marcus.id, projectId: hvf.id, startDate: wk13, endDate: addWeeks(today, 10), hoursPerDay: 2.5, status: "confirmed" },

      // ── Lukas (37h/wk, starts wk8) ──
      // Early (wk8→wk13): HVF 7h + INT 0.5h = 7.5h
      { companyId, userId: lukas.id, projectId: hvf.id, startDate: wk8, endDate: wk13, hoursPerDay: 7, status: "confirmed" },
      { companyId, userId: lukas.id, projectId: int.id, startDate: wk8, endDate: addWeeks(today, 12), hoursPerDay: 0.5, status: "confirmed" },
      // Main (wk13→today+12): HVF 4.5h + SBK 2.5h + INT 0.5h = 7.5h
      { companyId, userId: lukas.id, projectId: hvf.id, startDate: wk13, endDate: addWeeks(today, 12), hoursPerDay: 4.5, status: "confirmed" },
      { companyId, userId: lukas.id, projectId: sbk.id, startDate: wk13, endDate: addWeeks(today, 12), hoursPerDay: 2.5, status: "confirmed" },

      // ── Nadia (37h/wk) ──
      // Early (dataStart→wk8): ELM 6h + INT 1.5h = 7.5h
      { companyId, userId: nadia.id, projectId: elm.id, startDate: dataStart, endDate: wk8, hoursPerDay: 6, status: "confirmed" },
      { companyId, userId: nadia.id, projectId: int.id, startDate: dataStart, endDate: addWeeks(today, 12), hoursPerDay: 1, status: "confirmed" },
      // Main (wk8→today+4): ELM 2.5h + KHV 3h + KON 1h = 7.5h (+ INT 1h from above)
      { companyId, userId: nadia.id, projectId: elm.id, startDate: wk8, endDate: addWeeks(today, 4), hoursPerDay: 2.5, status: "confirmed" },
      { companyId, userId: nadia.id, projectId: khv.id, startDate: wk8, endDate: addWeeks(today, 12), hoursPerDay: 3, status: "confirmed" },
      { companyId, userId: nadia.id, projectId: kon.id, startDate: wk8, endDate: addWeeks(today, 12), hoursPerDay: 1, status: "confirmed" },

      // ── Sofie D. (15h/wk, Mon-Wed, hourly) ──
      { companyId, userId: sofieD.id, projectId: hvf.id, startDate: dataStart, endDate: addWeeks(today, 6), hoursPerDay: 5, status: "confirmed" },

      // ── Oliver (20h/wk, Tue-Fri, hourly) ──
      // Early (dataStart→wk8): HVF 5h
      { companyId, userId: oliver.id, projectId: hvf.id, startDate: dataStart, endDate: wk8, hoursPerDay: 5, status: "confirmed" },
      // Main (wk8→today+8): KHV 3h + KON 2h = 5h
      { companyId, userId: oliver.id, projectId: khv.id, startDate: wk8, endDate: addWeeks(today, 8), hoursPerDay: 3, status: "confirmed" },
      { companyId, userId: oliver.id, projectId: kon.id, startDate: wk8, endDate: addWeeks(today, 4), hoursPerDay: 2, status: "confirmed" },
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
      // Weekly submissions (only Erik submitted Friday)
      { companyId, entityType: "TimeEntry", entityId: "batch-submit-erik", action: "SUBMIT", fromStatus: "draft", toStatus: "submitted", actorId: erik.id, createdAt: addDays(today, -8) },
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
