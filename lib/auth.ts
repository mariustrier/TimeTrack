import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export function isAdminOrManager(role: string): boolean {
  return role === "admin" || role === "manager";
}

export async function getAuthUser() {
  const { userId } = auth();
  if (!userId) return null;

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { company: true },
  });

  return user;
}

export async function requireAuth() {
  const user = await getAuthUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  if (user.role !== "admin") {
    throw new Error("Forbidden");
  }
  return user;
}

export async function requireManager() {
  const user = await requireAuth();
  if (!isAdminOrManager(user.role)) {
    throw new Error("Forbidden");
  }
  return user;
}

export function isSuperAdmin(email: string): boolean {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  if (!superAdminEmail) return false;
  return email.toLowerCase() === superAdminEmail.toLowerCase();
}

export async function requireSuperAdmin() {
  const user = await requireAuth();
  if (!isSuperAdmin(user.email)) {
    throw new Error("Forbidden");
  }
  return user;
}
