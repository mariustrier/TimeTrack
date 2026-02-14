import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function cleanupExpiredDemos() {
  const now = new Date();

  // Find all expired demo companies
  const expiredCompanies = await db.company.findMany({
    where: {
      isDemo: true,
      demoExpiresAt: { lt: now },
    },
    include: {
      users: { select: { id: true, clerkId: true } },
    },
  });

  if (expiredCompanies.length === 0) {
    return { deletedCompanies: 0, deletedClerkUsers: 0, errors: [] };
  }

  const errors: string[] = [];
  let deletedClerkUsers = 0;

  // Delete Clerk users first (non-fatal)
  for (const company of expiredCompanies) {
    for (const user of company.users) {
      // Skip fake clerk IDs used for demo employees
      if (user.clerkId.startsWith("demo-")) continue;

      try {
        const clerk = await clerkClient();
        await clerk.users.deleteUser(user.clerkId);
        deletedClerkUsers++;
      } catch (err: any) {
        errors.push(`Clerk delete failed for ${user.clerkId}: ${err.message}`);
      }
    }
  }

  // Delete all data in a transaction per company
  for (const company of expiredCompanies) {
    try {
      await db.$transaction([
        // Time entries (must go before projects due to FK)
        db.timeEntry.deleteMany({ where: { companyId: company.id } }),
        // Invoice lines (before invoices)
        db.invoiceLine.deleteMany({
          where: { invoice: { companyId: company.id } },
        }),
        // Invoices
        db.invoice.deleteMany({ where: { companyId: company.id } }),
        // Expenses
        db.expense.deleteMany({ where: { companyId: company.id } }),
        // Company expenses
        db.companyExpense.deleteMany({ where: { companyId: company.id } }),
        // Expense categories
        db.expenseCategory.deleteMany({ where: { companyId: company.id } }),
        // Resource allocations
        db.resourceAllocation.deleteMany({ where: { companyId: company.id } }),
        // Project allocations
        db.projectAllocation.deleteMany({ where: { companyId: company.id } }),
        // Project activities
        db.projectActivity.deleteMany({ where: { companyId: company.id } }),
        // Project milestones
        db.projectMilestone.deleteMany({
          where: { project: { companyId: company.id } },
        }),
        // Project phases
        db.projectPhase.deleteMany({
          where: { project: { companyId: company.id } },
        }),
        // Phases
        db.phase.deleteMany({ where: { companyId: company.id } }),
        // Projects
        db.project.deleteMany({ where: { companyId: company.id } }),
        // Vacation requests
        db.vacationRequest.deleteMany({ where: { companyId: company.id } }),
        // Absence reasons
        db.absenceReason.deleteMany({ where: { companyId: company.id } }),
        // Company holidays
        db.companyHoliday.deleteMany({ where: { companyId: company.id } }),
        // Customer mappings
        db.customerMapping.deleteMany({ where: { companyId: company.id } }),
        // Contract insights
        db.contractInsight.deleteMany({ where: { companyId: company.id } }),
        // Support access
        db.supportAccess.deleteMany({ where: { companyId: company.id } }),
        // AI usage
        db.aIApiUsage.deleteMany({ where: { companyId: company.id } }),
        // Audit logs
        db.auditLog.deleteMany({ where: { companyId: company.id } }),
        // Users
        db.user.deleteMany({ where: { companyId: company.id } }),
        // Company
        db.company.delete({ where: { id: company.id } }),
      ]);
    } catch (err: any) {
      errors.push(`Transaction failed for company ${company.id}: ${err.message}`);
    }
  }

  return {
    deletedCompanies: expiredCompanies.length,
    deletedClerkUsers,
    errors,
  };
}
