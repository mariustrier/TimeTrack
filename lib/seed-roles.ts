import { db } from "@/lib/db";

const DEFAULT_ROLES = [
  { name: "Senior", sortOrder: 1 },
  { name: "Medarbejder", sortOrder: 2 },
  { name: "Junior", sortOrder: 3 },
  { name: "Studerende", sortOrder: 4 },
];

export async function seedDefaultRoles(companyId: string) {
  const existing = await db.role.count({ where: { companyId } });
  if (existing > 0) return;

  await db.role.createMany({
    data: DEFAULT_ROLES.map((r) => ({
      companyId,
      name: r.name,
      sortOrder: r.sortOrder,
      isDefault: true,
    })),
  });
}
