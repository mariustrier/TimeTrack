/**
 * Matching utilities for e-conomic import — employee, tilbud category, and invoice category matching.
 */

interface TeamMember {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

interface TilbudCategory {
  id: string;
  name: string;
  faseNumber?: number;
}

interface ActivityInfo {
  number: number;
  name: string;
}

interface OmsaetningCategoryInfo {
  number: number;
  name: string;
}

/** Match e-conomic employee names to Cloud Timer users. Returns { economicName → userId } */
export const matchEmployees = (
  economicNames: string[],
  team: TeamMember[]
): Record<string, string> => {
  const result: Record<string, string> = {};

  economicNames.forEach((eName) => {
    const lower = eName.toLowerCase().trim();

    // Exact full name match
    const exactMatch = team.find((m) => {
      const full = `${m.firstName || ""} ${m.lastName || ""}`.trim().toLowerCase();
      return full === lower;
    });
    if (exactMatch) {
      result[eName] = exactMatch.id;
      return;
    }

    // First name match
    const firstNameMatch = team.find((m) =>
      m.firstName && m.firstName.toLowerCase() === lower
    );
    if (firstNameMatch) {
      result[eName] = firstNameMatch.id;
      return;
    }

    // Last name match
    const lastNameMatch = team.find((m) =>
      m.lastName && m.lastName.toLowerCase() === lower
    );
    if (lastNameMatch) {
      result[eName] = lastNameMatch.id;
      return;
    }

    // Substring match (economic name appears in full name or vice versa)
    const substringMatch = team.find((m) => {
      const full = `${m.firstName || ""} ${m.lastName || ""}`.trim().toLowerCase();
      return full.includes(lower) || lower.includes(full);
    });
    if (substringMatch) {
      result[eName] = substringMatch.id;
      return;
    }

    // First name starts with (for abbreviated names like "Jul" → "Julie")
    const startsMatch = team.find((m) =>
      m.firstName && (
        m.firstName.toLowerCase().startsWith(lower) ||
        lower.startsWith(m.firstName.toLowerCase())
      )
    );
    if (startsMatch) {
      result[eName] = startsMatch.id;
    }
  });

  return result;
};

/** Match e-conomic activities to tilbud categories. Returns { activityNumber → categoryId } */
export const matchTilbudCategories = (
  activities: ActivityInfo[],
  categories: TilbudCategory[]
): Record<number, string> => {
  const result: Record<number, string> = {};

  activities.forEach((act) => {
    const actLower = act.name.toLowerCase().trim();

    // Exact lowercase match
    const exact = categories.find((c) => c.name.toLowerCase().trim() === actLower);
    if (exact) {
      result[act.number] = exact.id;
      return;
    }

    // Includes match (category name in activity name or vice versa)
    const includes = categories.find((c) => {
      const cLower = c.name.toLowerCase().trim();
      return actLower.includes(cLower) || cLower.includes(actLower);
    });
    if (includes) {
      result[act.number] = includes.id;
      return;
    }

    // StartsWith match
    const starts = categories.find((c) => {
      const cLower = c.name.toLowerCase().trim();
      return actLower.startsWith(cLower) || cLower.startsWith(actLower);
    });
    if (starts) {
      result[act.number] = starts.id;
    }
  });

  return result;
};

/** Match omsaetning varekategorier to projektkort activities. Returns { categoryNumber → activityNumber } */
export const matchInvoiceCategories = (
  omsaetningCats: OmsaetningCategoryInfo[],
  activities: ActivityInfo[]
): Record<number, number> => {
  const result: Record<number, number> = {};

  omsaetningCats.forEach((cat) => {
    const catLower = cat.name.toLowerCase().trim();

    // Exact lowercase match
    const exact = activities.find((a) => a.name.toLowerCase().trim() === catLower);
    if (exact) {
      result[cat.number] = exact.number;
      return;
    }

    // Includes match
    const includes = activities.find((a) => {
      const aLower = a.name.toLowerCase().trim();
      return catLower.includes(aLower) || aLower.includes(catLower);
    });
    if (includes) {
      result[cat.number] = includes.number;
      return;
    }

    // StartsWith match
    const starts = activities.find((a) => {
      const aLower = a.name.toLowerCase().trim();
      return catLower.startsWith(aLower) || aLower.startsWith(catLower);
    });
    if (starts) {
      result[cat.number] = starts.number;
    }
  });

  return result;
};
