import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export function isAdminOrManager(role: string): boolean {
  return role === "admin" || role === "manager";
}

const SUPPORT_SESSION_HOURS = 4;

export async function getAuthUser() {
  const { userId } = auth();
  if (!userId) return null;

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { company: true },
  });

  if (!user) return null;

  // Support access override for super admins
  if (isSuperAdmin(user.email)) {
    const supportAccess = await db.supportAccess.findFirst({
      where: { requestedBy: user.id, status: "active" },
      include: { company: true },
    });

    if (supportAccess) {
      // Auto-expire after configured hours
      const expiryTime = new Date(Date.now() - SUPPORT_SESSION_HOURS * 60 * 60 * 1000);
      if (supportAccess.activatedAt && supportAccess.activatedAt < expiryTime) {
        await db.supportAccess.update({
          where: { id: supportAccess.id },
          data: { status: "expired", expiredAt: new Date(), expiryReason: "auto_expired" },
        });
        return user;
      }

      // Override company context
      return {
        ...user,
        companyId: supportAccess.companyId,
        company: supportAccess.company,
        role: "admin",
        _supportAccessId: supportAccess.id,
        _isSupportMode: true,
        _supportCompanyName: supportAccess.company.name,
        _originalCompanyId: user.companyId,
      };
    }
  }

  return user;
}

export function isInSupportMode(user: any): boolean {
  return user?._isSupportMode === true;
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
