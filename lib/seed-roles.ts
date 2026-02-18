import { db } from "@/lib/db";

const DEFAULT_ROLES = [
  { name: "Partner", sortOrder: 1 },
  { name: "Senior", sortOrder: 2 },
  { name: "Medarbejder", sortOrder: 3 },
  { name: "Junior", sortOrder: 4 },
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
