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

export const updateProjectSchema = createProjectSchema.partial();

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
});

export const updateTeamMemberSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  role: z.enum(["admin", "manager", "employee"]).optional(),
  employmentType: z.enum(["employee", "freelancer"]).optional(),
  hourlyRate: z.coerce.number().nonnegative().optional(),
  costRate: z.coerce.number().nonnegative().optional(),
  weeklyTarget: z.coerce.number().nonnegative().max(168).optional(),
  vacationDays: z.coerce.number().int().nonnegative().max(365).optional(),
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
});

// --- Company Expenses ---

export const createCompanyExpenseSchema = z.object({
  amount: z.coerce.number().positive(),
  description: z.string().min(1).max(500),
  category: z.enum([
    "rent",
    "insurance",
    "utilities",
    "software",
    "salaries",
    "other",
  ]),
  date: z.string().min(1),
  recurring: z.boolean().optional(),
  frequency: z.enum(["monthly", "quarterly", "yearly"]).optional().nullable(),
  receiptUrl: z.string().url().optional().nullable(),
  receiptFileName: z.string().optional().nullable(),
  receiptFileSize: z.coerce.number().int().nonnegative().optional().nullable(),
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
