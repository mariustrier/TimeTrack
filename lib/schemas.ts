import { z } from "zod";

// --- Time Entries ---

export const createTimeEntrySchema = z.object({
  hours: z.coerce.number().positive().max(24),
  date: z.string().min(1),
  projectId: z.string().min(1),
  comment: z.string().max(500).optional().nullable(),
  billingStatus: z
    .enum(["billable", "included", "non_billable", "internal", "presales"])
    .optional(),
  // Mileage fields
  mileageKm: z.coerce.number().nonnegative().max(9999).optional().nullable(),
  mileageStartAddress: z.string().max(500).optional().nullable(),
  mileageEndAddress: z.string().max(500).optional().nullable(),
  mileageStops: z.array(z.string().max(500)).optional().nullable(),
  mileageRoundTrip: z.boolean().optional().nullable(),
  mileageSource: z.enum(["manual", "calculated"]).optional().nullable(),
  // Absence tracking
  absenceReasonId: z.string().optional().nullable(),
  // Phase override (defaults to project's current phase if not provided)
  phaseId: z.string().optional().nullable(),
  // Admin: log on behalf of employee
  userId: z.string().min(1).optional(),
});

export const updateTimeEntrySchema = z.object({
  hours: z.coerce.number().positive().max(24).optional(),
  comment: z.string().max(500).optional().nullable(),
  billingStatus: z
    .enum(["billable", "included", "non_billable", "internal", "presales"])
    .optional(),
  nonBillableReason: z.string().max(500).optional().nullable(),
  // Mileage fields
  mileageKm: z.coerce.number().nonnegative().max(9999).optional().nullable(),
  mileageStartAddress: z.string().max(500).optional().nullable(),
  mileageEndAddress: z.string().max(500).optional().nullable(),
  mileageStops: z.array(z.string().max(500)).optional().nullable(),
  mileageRoundTrip: z.boolean().optional().nullable(),
  mileageSource: z.enum(["manual", "calculated"]).optional().nullable(),
  // Absence tracking
  absenceReasonId: z.string().optional().nullable(),
  // Phase override (defaults to entry's current phase if not provided)
  phaseId: z.string().optional().nullable(),
});

// --- Projects ---

export const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  client: z.string().max(100).optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  budgetHours: z.coerce.number().nonnegative().optional().nullable(),
  billable: z.boolean().optional(),
  currency: z.string().max(3).optional().nullable(),
  pricingType: z.enum(["hourly", "fixed_price"]).optional(),
  fixedPrice: z.coerce.number().nonnegative().optional().nullable(),
  rateMode: z
    .enum(["COMPANY_RATE", "EMPLOYEE_RATES", "PROJECT_RATE"])
    .optional(),
  projectRate: z.coerce.number().nonnegative().optional().nullable(),
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  active: z.boolean().optional(),
  locked: z.boolean().optional(),
  archived: z.boolean().optional(),
  phasesEnabled: z.boolean().optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

// --- Project Phase Segments ---

export const createProjectPhaseSchema = z.object({
  phaseId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  status: z.enum(["active", "completed"]).optional(),
});

export const updateProjectPhaseSchema = z.object({
  projectPhaseId: z.string().min(1),
  startDate: z.string().min(1).optional(),
  endDate: z.string().min(1).optional(),
  status: z.enum(["active", "completed"]).optional(),
});

// --- Team Members ---

export const createTeamMemberSchema = z.object({
  email: z.string().email(),
  firstName: z.string().max(100).optional().nullable(),
  lastName: z.string().max(100).optional().nullable(),
  role: z.enum(["admin", "manager", "employee"]).optional(),
  employmentType: z.enum(["employee", "freelancer"]).optional(),
  hourlyRate: z.coerce.number().nonnegative().optional(),
  costRate: z.coerce.number().nonnegative().optional(),
  weeklyTarget: z.coerce.number().nonnegative().max(168).optional(),
  isHourly: z.boolean().optional(),
  roleId: z.string().nullable().optional(),
});

export const updateTeamMemberSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  role: z.enum(["admin", "manager", "employee"]).optional(),
  employmentType: z.enum(["employee", "freelancer"]).optional(),
  hourlyRate: z.coerce.number().nonnegative().optional(),
  costRate: z.coerce.number().nonnegative().optional(),
  weeklyTarget: z.coerce.number().nonnegative().max(168).optional(),
  isHourly: z.boolean().optional(),
  vacationDays: z.coerce.number().int().nonnegative().max(365).optional(),
  vacationTrackingUnit: z.enum(["days", "hours"]).optional(),
  vacationHoursPerYear: z.coerce.number().nonnegative().max(2000).nullable().optional(),
  roleId: z.string().nullable().optional(),
});

// --- Expenses ---

export const createExpenseSchema = z.object({
  amount: z.coerce.number().positive(),
  description: z.string().min(1).max(500),
  category: z
    .enum(["travel", "materials", "software", "meals", "other"])
    .optional(),
  date: z.string().min(1),
  projectId: z.string().min(1),
  receiptUrl: z.string().url().optional().nullable(),
  receiptFileName: z.string().optional().nullable(),
  receiptFileSize: z.coerce.number().int().nonnegative().optional().nullable(),
});

// --- Vacations ---

export const createVacationSchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  type: z.enum(["vacation", "sick", "personal"]).optional(),
  note: z.string().max(500).optional().nullable(),
  userId: z.string().optional(),
});

// --- Company Expenses ---

export const createCompanyExpenseSchema = z.object({
  amount: z.coerce.number().positive(),
  description: z.string().min(1).max(500),
  category: z.string().min(1).max(100),
  expenseCategoryId: z.string().optional().nullable(),
  date: z.string().min(1),
  recurring: z.boolean().optional(),
  frequency: z.enum(["monthly", "quarterly", "yearly"]).optional().nullable(),
  receiptUrl: z.string().url().optional().nullable(),
  receiptFileName: z.string().optional().nullable(),
  receiptFileSize: z.coerce.number().int().nonnegative().optional().nullable(),
});

// --- Expense Categories ---

export const createExpenseCategorySchema = z.object({
  name: z.string().min(1).max(100),
});

export const updateExpenseCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  active: z.boolean().optional(),
});

// --- Approval Actions ---

export const approvalActionSchema = z.object({
  userId: z.string().min(1),
  weekStart: z.string().min(1),
  reason: z.string().max(1000).optional(),
});

// --- Day Submission ---

export const submitDaySchema = z.object({
  date: z.string().min(1), // yyyy-MM-dd
});

// --- Day Approval Actions (admin) ---

export const dayApprovalActionSchema = z.object({
  userId: z.string().min(1),
  date: z.string().min(1), // yyyy-MM-dd
  reason: z.string().max(1000).optional(),
});

// --- Mileage Calculation ---

export const calculateDistanceSchema = z.object({
  startAddress: z.string().min(3).max(500),
  endAddress: z.string().min(3).max(500),
  stops: z.array(z.string().min(3).max(500)).optional(),
  roundTrip: z.boolean().optional(),
});

// --- Resource Allocations ---

export const createResourceAllocationSchema = z.object({
  userId: z.string().min(1),
  projectId: z.string().min(1),
  startDate: z.string().min(1), // yyyy-MM-dd
  endDate: z.string().min(1), // yyyy-MM-dd
  hoursPerDay: z.coerce.number().positive().max(24).optional(),
  totalHours: z.coerce.number().positive().optional().nullable(), // If set, enables rollover mode
  status: z.enum(["tentative", "confirmed", "completed"]).optional(),
  notes: z.string().max(500).optional().nullable(),
});

export const updateResourceAllocationSchema = z.object({
  startDate: z.string().min(1).optional(),
  endDate: z.string().min(1).optional(),
  hoursPerDay: z.coerce.number().positive().max(24).optional(),
  totalHours: z.coerce.number().positive().optional().nullable(),
  status: z.enum(["tentative", "confirmed", "completed"]).optional(),
  notes: z.string().max(500).optional().nullable(),
  editDate: z.string().optional(), // ISO date — if set, only edit this day within the span (splits the allocation)
});

// --- Bulk Resource Allocation Actions ---
export const bulkResourceAllocationSchema = z.object({
  action: z.enum(["delete", "updateStatus", "move"]),
  ids: z.array(z.string().min(1)).min(1).max(200),
  status: z.enum(["tentative", "confirmed", "completed"]).optional(),
  offsetDays: z.coerce.number().int().min(-365).max(365).optional(),
});

// --- Project Milestones ---

export const createMilestoneSchema = z.object({
  title: z.string().min(1).max(200),
  dueDate: z.string().min(1), // yyyy-MM-dd
  sortOrder: z.coerce.number().int().nonnegative().optional(),
  type: z.enum(["phase", "custom"]).optional(),
  phaseId: z.string().optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  icon: z.enum(["flag", "handshake", "rocket", "eye", "calendar"]).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
});

export const updateMilestoneSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  dueDate: z.string().min(1).optional(),
  completed: z.boolean().optional(),
  sortOrder: z.coerce.number().int().nonnegative().optional(),
  type: z.enum(["phase", "custom"]).optional(),
  phaseId: z.string().optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  icon: z.enum(["flag", "handshake", "rocket", "eye", "calendar"]).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
});

// --- Project Activities (Gantt) ---

export const createActivitySchema = z.object({
  name: z.string().min(1).max(200),
  phaseId: z.string().optional().nullable(),
  categoryName: z.string().max(100).optional().nullable(),
  assignedUserId: z.string().optional().nullable(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  status: z.enum(["not_started", "in_progress", "needs_review", "complete"]).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
  sortOrder: z.coerce.number().int().nonnegative().optional(),
});

export const updateActivitySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phaseId: z.string().optional().nullable(),
  categoryName: z.string().max(100).optional().nullable(),
  assignedUserId: z.string().optional().nullable(),
  startDate: z.string().min(1).optional(),
  endDate: z.string().min(1).optional(),
  status: z.enum(["not_started", "in_progress", "needs_review", "complete"]).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
  sortOrder: z.coerce.number().int().nonnegative().optional(),
});

export const reorderActivitiesSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

// --- Project Phases ---

export const createPhaseSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const updatePhaseSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  active: z.boolean().optional(),
  applyGlobally: z.boolean().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const reorderPhasesSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

// ─── ROLES ───
export const createRoleSchema = z.object({
  name: z.string().min(1).max(100),
  defaultRate: z.number().min(0).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
});

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  defaultRate: z.number().min(0).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
});

export const reorderRolesSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

export const phaseWorkflowSchema = z.object({
  action: z.enum(["complete", "setPhase"]),
  phaseId: z.string().min(1).optional(),
});

// --- Support Access ---

export const supportAccessRequestSchema = z.object({
  companyId: z.string().min(1),
});

export const supportAccessActionSchema = z.object({
  supportAccessId: z.string().min(1),
});

// --- Project Import ---

export const importProjectSchema = z.object({
  mappings: z.object({
    employees: z.record(z.string(), z.string()),
    categories: z.record(z.string(), z.string()),
  }),
  projectSettings: z.object({
    name: z.string().min(1).max(100),
    client: z.string().max(100).optional().nullable(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    budgetHours: z.coerce.number().nonnegative().optional().nullable(),
    existingProjectId: z.string().optional().nullable(),
  }),
});

export const phaseMigrationSchema = z.object({
  assignments: z.array(z.object({
    projectId: z.string().min(1),
    phaseId: z.string().min(1).nullable(),
  })),
  backfillRanges: z.array(z.object({
    projectId: z.string().min(1),
    phaseId: z.string().min(1),
    from: z.string().min(1),
    to: z.string().min(1),
  })).optional(),
});

// --- Invoices ---

export const createInvoiceSchema = z.object({
  projectId: z.string().min(1),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  clientName: z.string().max(200).optional(),
  clientAddress: z.string().max(500).optional(),
  clientCvr: z.string().max(20).optional(),
  clientEan: z.string().max(20).optional(),
  paymentTermsDays: z.coerce.number().int().positive().max(365).optional(),
  note: z.string().max(2000).optional().nullable(),
  groupBy: z.enum(["employee", "phase", "description", "flat"]),
  includeExpenses: z.boolean(),
  phaseId: z.string().optional().nullable(),
  timeEntryIds: z.array(z.string()).optional(),
  expenseIds: z.array(z.string()).optional(),
});

export const updateInvoiceSchema = z.object({
  clientName: z.string().max(200).optional(),
  clientAddress: z.string().max(500).optional(),
  clientCvr: z.string().max(20).optional(),
  clientEan: z.string().max(20).optional(),
  paymentTermsDays: z.coerce.number().int().positive().max(365).optional(),
  note: z.string().max(2000).optional().nullable(),
  status: z.enum(["draft", "sent", "paid", "void"]).optional(),
  lines: z.array(z.object({
    id: z.string().optional(),
    description: z.string().min(1).max(500),
    quantity: z.coerce.number(),
    unitPrice: z.coerce.number(),
    type: z.enum(["time", "expense", "manual"]).optional(),
    phaseName: z.string().max(100).optional().nullable(),
  })).optional(),
});

export const invoicePreviewSchema = createInvoiceSchema;

// --- Company Billing Settings ---

export const updateCompanyBillingSchema = z.object({
  companyAddress: z.string().max(500).optional().nullable(),
  companyCvr: z.string().max(20).optional().nullable(),
  companyBankAccount: z.string().max(50).optional().nullable(),
  companyBankReg: z.string().max(20).optional().nullable(),
  defaultPaymentDays: z.coerce.number().int().positive().max(365).optional(),
  invoiceFooterNote: z.string().max(2000).optional().nullable(),
  invoicePrefix: z.string().max(20).optional().nullable(),
  accountingSystem: z.enum(["e-conomic", "billy", "dinero"]).optional().nullable(),
});

// --- Accounting ---

export const accountingCredentialsSchema = z.object({
  system: z.enum(["e-conomic", "billy", "dinero"]),
  // e-conomic
  appSecretToken: z.string().optional(),
  agreementGrantToken: z.string().optional(),
  // Billy
  accessToken: z.string().optional(),
  organizationId: z.string().optional(),
  // Dinero (legacy: clientId+clientSecret, OAuth: accessToken+refreshToken)
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  refreshToken: z.string().optional(),
  tokenExpiresAt: z.string().optional(),
});

export const customerMappingSchema = z.object({
  clientName: z.string().min(1).max(200),
  externalCustomerId: z.string().min(1).max(100),
  externalCustomerName: z.string().min(1).max(200),
});
