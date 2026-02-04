import { InsightDataPackage } from "./insight-data-gatherer";

// Pseudonym lists
const EMPLOYEE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const PROJECT_NAMES = [
  "Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta",
  "Theta", "Iota", "Kappa", "Lambda", "Mu", "Nu", "Xi",
  "Omicron", "Pi", "Rho", "Sigma", "Tau", "Upsilon", "Phi",
  "Chi", "Psi", "Omega",
];

export interface AnonymizationMap {
  employees: Map<string, string>;       // real name → pseudonym
  projects: Map<string, string>;        // real project name → pseudonym
  companyName: string;                  // original company name
  reverseEmployees: Map<string, string>; // pseudonym → real name
  reverseProjects: Map<string, string>;  // pseudonym → real project name
}

function getEmployeePseudonym(index: number): string {
  if (index < 26) return `Employee ${EMPLOYEE_LETTERS[index]}`;
  const first = Math.floor(index / 26) - 1;
  const second = index % 26;
  return `Employee ${EMPLOYEE_LETTERS[first]}${EMPLOYEE_LETTERS[second]}`;
}

function getProjectPseudonym(index: number): string {
  if (index < PROJECT_NAMES.length) return `Project ${PROJECT_NAMES[index]}`;
  return `Project ${index + 1}`;
}

function scrubText(text: string, replacements: [string, string][]): string {
  let result = text;
  for (const [from, to] of replacements) {
    result = result.split(from).join(to);
  }
  return result;
}

export function anonymizeInsightData(data: InsightDataPackage): {
  anonymizedData: InsightDataPackage;
  map: AnonymizationMap;
} {
  // 1. Collect all unique employee names
  const employeeNames = new Set<string>();
  for (const m of data.team.members) employeeNames.add(m.name);
  for (const w of data.workloadMetrics.weeklyHoursByUser) employeeNames.add(w.userName);
  for (const o of data.workloadMetrics.usersOverworked) employeeNames.add(o.name);
  for (const u of data.workloadMetrics.usersUnderutilized) employeeNames.add(u.name);
  for (const w of data.workloadMetrics.weekendWorkers) employeeNames.add(w.name);
  for (const v of data.vacations.upcoming) employeeNames.add(v.userName);
  for (const p of data.projects.active) {
    for (const tm of p.teamMembers) employeeNames.add(tm.name);
  }
  for (const r of data.projects.singlePersonRisks) employeeNames.add(r.userName);
  for (const g of data.productivity.usersWithEntryGaps) employeeNames.add(g.name);

  // 2. Collect all unique project names
  const projectNames = new Set<string>();
  for (const p of data.projects.active) projectNames.add(p.name);
  for (const r of data.projects.singlePersonRisks) projectNames.add(r.projectName);
  for (const c of data.contracts) projectNames.add(c.projectName);

  // 3. Build mappings (sorted alphabetically for deterministic ordering)
  const sortedEmployees = Array.from(employeeNames).sort();
  const sortedProjects = Array.from(projectNames).sort();

  const employees = new Map<string, string>();
  const reverseEmployees = new Map<string, string>();
  sortedEmployees.forEach((name, i) => {
    const pseudo = getEmployeePseudonym(i);
    employees.set(name, pseudo);
    reverseEmployees.set(pseudo, name);
  });

  const projects = new Map<string, string>();
  const reverseProjects = new Map<string, string>();
  sortedProjects.forEach((name, i) => {
    const pseudo = getProjectPseudonym(i);
    projects.set(name, pseudo);
    reverseProjects.set(pseudo, name);
  });

  const companyName = data.company.name;

  const map: AnonymizationMap = {
    employees,
    projects,
    companyName,
    reverseEmployees,
    reverseProjects,
  };

  // 4. Deep clone the data
  const anon: InsightDataPackage = JSON.parse(JSON.stringify(data));

  // Helper to look up employee pseudonym (fallback to original if not found)
  const emp = (name: string) => employees.get(name) || name;
  const proj = (name: string) => projects.get(name) || name;

  // 5. Replace all name fields
  anon.company.name = "The Company";
  anon.company.id = "";

  for (const m of anon.team.members) {
    m.name = emp(m.name);
    m.id = "";
  }

  for (const w of anon.workloadMetrics.weeklyHoursByUser) {
    w.userName = emp(w.userName);
    w.userId = "";
  }

  for (const o of anon.workloadMetrics.usersOverworked) {
    o.name = emp(o.name);
  }

  for (const u of anon.workloadMetrics.usersUnderutilized) {
    u.name = emp(u.name);
  }

  for (const w of anon.workloadMetrics.weekendWorkers) {
    w.name = emp(w.name);
  }

  for (const v of anon.vacations.upcoming) {
    v.userName = emp(v.userName);
  }

  for (const p of anon.projects.active) {
    p.name = proj(p.name);
    p.id = "";
    for (const tm of p.teamMembers) {
      tm.name = emp(tm.name);
    }
  }

  for (const r of anon.projects.singlePersonRisks) {
    r.projectName = proj(r.projectName);
    r.userName = emp(r.userName);
  }

  for (const g of anon.productivity.usersWithEntryGaps) {
    g.name = emp(g.name);
  }

  // Build replacement pairs for free-text scrubbing (longest first)
  const textReplacements: [string, string][] = [];
  textReplacements.push([companyName, "The Company"]);
  Array.from(employees.entries()).forEach(([real, pseudo]) => textReplacements.push([real, pseudo]));
  Array.from(projects.entries()).forEach(([real, pseudo]) => textReplacements.push([real, pseudo]));
  textReplacements.sort((a, b) => b[0].length - a[0].length);

  for (const c of anon.contracts) {
    c.projectName = proj(c.projectName);
    if (c.scope) {
      c.scope = scrubText(c.scope, textReplacements);
    }
  }

  return { anonymizedData: anon, map };
}

interface GeneratedInsight {
  category: string;
  title: string;
  description: string;
  suggestion?: string;
  relatedHours?: number;
  relatedAmount?: number;
}

export function deanonymizeInsights<T extends GeneratedInsight>(
  insights: T[],
  map: AnonymizationMap
): T[] {
  // Build replacement pairs sorted by pseudonym length descending
  const replacements: [string, string][] = [];

  Array.from(map.reverseEmployees.entries()).forEach(([pseudo, real]) => {
    replacements.push([pseudo, real]);
  });
  Array.from(map.reverseProjects.entries()).forEach(([pseudo, real]) => {
    replacements.push([pseudo, real]);
  });
  replacements.push(["The Company", map.companyName]);

  replacements.sort((a, b) => b[0].length - a[0].length);

  return insights.map((insight) => ({
    ...insight,
    title: scrubText(insight.title, replacements),
    description: scrubText(insight.description, replacements),
    suggestion: insight.suggestion
      ? scrubText(insight.suggestion, replacements)
      : undefined,
  }));
}
