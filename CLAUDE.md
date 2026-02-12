# Cloud Timer (cloudtimer.dk)

SaaS time-tracking application for companies. Deployed on Vercel with auto-deploy from master.

## Tech Stack

- Next.js 14.2 (App Router) with TypeScript
- Prisma ORM with PostgreSQL (Neon)
- Clerk authentication (role-based: admin/manager/employee)
- Multi-tenant architecture (companyId scoping on all queries)
- Tailwind CSS, Radix UI (shadcn/ui), Lucide icons, Sonner toasts
- All dashboard pages are "use client" components
- Bilingual: English + Danish via `lib/i18n` (useTranslations hook), `messages/en.json` + `messages/da.json`
- SEO metadata and `<html lang>` set to Danish (da) — targeting Danish market
- Sentry error monitoring (client/server/edge) with error boundaries at root, app, and dashboard levels
- Vercel Blob for file storage (contract PDFs, receipts, company logos)
- Resend for transactional emails (team invitations)

## Key Commands

- `npm run dev` - Start development server
- `npm run build` - Production build (also runs linting + type checking)
- `npm run test` - Run all 185 unit tests (Vitest)
- `npm run test:watch` - Run tests in watch mode

## Project Structure

### Pages (sidebar order: admin items first, then employee items)
1. `app/(dashboard)/dashboard/` - Employee timesheet + stat cards + flex balance
2. `app/(dashboard)/admin/` - **Tabbed**: Overview | Approvals | Vacations | Backups | Audit Log *(admin only)*
3. `app/(dashboard)/team/` - **Tabbed**: Team members | Resource Planner *(admin/manager)*
4. `app/(dashboard)/projects/` - **Tabbed**: Projects list | Timeline with milestones *(admin/manager)*
5. `app/(dashboard)/ai/` - AI-powered business insights *(admin/manager)*
6. `app/(dashboard)/analytics/` - **Tabbed**: Employee | Team | Project | Company insights *(admin/manager)*
7. `app/(dashboard)/expenses/` - Expense tracking with receipt uploads
8. `app/(dashboard)/vacations/` - **Tabbed**: My Requests | Planner | Team Calendar
9. `app/(dashboard)/settings/` - Tour replay, data export, account deletion
10. `app/(dashboard)/super-admin/` - Platform-level admin with support access requests *(superAdmin only)*

### API Routes (78 route files across 19 domains)
- `app/api/` - All scoped by companyId (via `getAuthUser()` which auto-overrides for support mode)
- Key domains: `time-entries`, `projects`, `team`, `admin`, `expenses`, `vacations`, `contracts`, `resource-allocations`, `analytics`, `ai`, `insights`, `mileage`, `auth`, `cron`, `super-admin`, `super-admin/access`, `admin/support-access`, `user`, `upload`, `absence-reasons`, `admin/phases`, `phases`, `admin/expense-categories`

### Components
- `components/admin/` - AdminOverview, AdminApprovals, AdminVacations, AdminBackups, AdminAuditLog, TeamUtilizationBars, PhaseMigrationDialog
- `components/approvals/` - TimeEntryApprovals, ExpenseApprovals (nested tabs within admin)
- `components/analytics/` - EmployeeInsights, TeamInsights, ProjectInsights, CompanyInsights
- `components/contracts/` - ContractSection (upload, AI extraction, manual entry)
- `components/projects/` - ProjectsList, ProjectTimeline, PhaseProgress
- `components/project-timeline/` - TimelineGrid, MilestoneDialog
- `components/resource-planner/` - ResourceGrid, AllocationDialog, ViewControls, CapacitySummary
- `components/team/` - TeamList, ResourcePlanner
- `components/vacations/` - VacationCalendar, VacationPlanner
- `components/layout/` - Sidebar (role-based nav with badge counts, support mode banner)
- `components/ui/` - shadcn/ui primitives, guided-tour, page-guide, info-tooltip, theme/locale toggles

### Shared Libraries
- `lib/auth.ts` - getAuthUser helper (Clerk + Prisma, support access override for super admins, blocks soft-deleted users)
- `lib/db.ts` - Prisma client singleton
- `lib/schemas.ts` - All Zod validation schemas
- `lib/validate.ts` - Zod validation helper for API routes
- `lib/rate-limit.ts` - In-memory rate limiter
- `lib/api-error.ts` - Standardized API error helper with Sentry integration
- `lib/i18n.ts` - useTranslations, useDateLocale hooks
- `lib/currency.ts` - convertAndFormat with SUPPORTED_CURRENCIES
- `lib/week-helpers.ts` - Week date utilities
- `lib/calculations.ts` - Flex balance, daily target calculations (getDailyTarget)
- `lib/holidays.ts` - Danish holidays, company holidays, isCompanyHoliday/isDanishHoliday
- `lib/seed-holidays.ts` - ensureHolidayAbsenceReason helper
- `lib/email.ts` - Resend email client (lazy-init), sendInvitationEmail
- `lib/expense-utils.ts` - Expense formatting helpers
- `lib/analytics-utils.ts` - Analytics data processing
- `lib/economic-import.ts` - e-conomic Projektkort XLSX parser

### Database (17 models)
Company, User (`isHourly`, `weeklyTarget`, `vacationDays`, `deletedAt`, etc.), Project, TimeEntry, VacationRequest, AuditLog, ProjectAllocation, Contract, ContractInsight, AIApiUsage, Expense, CompanyExpense, ExpenseCategory, AbsenceReason, ResourceAllocation, ProjectMilestone, Phase, SupportAccess

### Tests
- `__tests__/lib/` - 185 unit tests across 10 suites (Vitest)

## Core Features

### Time Tracking (Dashboard)
- Weekly timesheet grid with per-cell time entry creation/editing
- 6 stat cards: Target, Billable Hours, Vacation Used, Total Hours, Flex Balance, Remaining Vacation (all numeric values use `.toFixed(1)` for clean display)
- **Hourly employees** (`isHourly`): Reduced to 3 stat cards (Total, Billable, Hourly indicator). Flex balance row, "Full Day" button, and vacation accrual hidden.
- **Cumulative flex balance**: Carries over from all prior weeks since user creation (not just current week). Skipped entirely for hourly employees.
- Daily flex balance row showing running overtime/undertime (hidden for hourly employees)
- Per-day submit buttons + bulk "Submit Week"
- Flex calculation: Mon-Thu get rounded daily target, Friday gets remainder (e.g., 37h → 9.25×4 + 0h Fri... actually Mon-Thu=9.5, Fri=7 for 45h)
- Budget progress bars per project (includes draft/unsubmitted hours, hidden for system-managed projects like Absence)
- **"Full day" button** in time entry modal: auto-fills hours based on day (Mon-Thu target or Friday target)
- Mileage tracking in time entry modal (OpenRouteService API)
- Absence reason selection for absence project entries (comment optional for absence, required for other projects)
- **Phase label** per project row: shows current phase badge (skipped for system-managed projects like Absence)
- **Phase override**: Time entry modal shows a phase selector dropdown for phase-enabled projects (not Absence). Defaults to project's current phase, but user can select any active phase. Colored dots match phase colors. Editable on draft entries, read-only on submitted/approved/locked. Inactive phases shown as static text. Phase updates when switching projects.
- **Planned hours**: Dashboard shows planned hours from ResourceAllocation data. "Planned" stat card (indigo, CalendarCheck icon) shows total planned hours for the current week with project count subtitle. When planned hours exist, a "Planned" column appears in the timesheet grid showing per-project breakdown, and a "Planned" footer row shows per-day planned totals. Data fetched from `GET /api/user/planned-hours?weekStart=...` which calculates weekly planned hours by finding overlapping ResourceAllocations (tentative/confirmed) and pro-rating by working days. Supports admin "view as employee" via userId param. Works for both salaried and hourly employees.
- **Admin log on behalf**: Admins/managers can select an employee from a dropdown to view their timesheet, create entries, and submit days/weeks under their account. Audit log tracks on-behalf submissions.
- **Calendar week picker**: Week navigation uses a calendar popover (click the date range to open) with left/right arrows and a "Today" button

### Expenses
- Create with amount, description, category, date, project, receipt upload
- Auto-submitted on creation (no manual submit step)
- Editable until approved by admin
- Admin auto-approve threshold setting
- Receipt management (PDF/images via Vercel Blob)
- **Company expenses**: Custom categories managed via `ExpenseCategory` model (company-scoped). 6 default categories seeded on first access (Rent, Insurance, Utilities, Software Subscriptions, Salaries & Benefits, Other). Admin CRUD via "Manage Categories" dialog on company expenses page. Soft-delete for categories in use, hard-delete if unused. Category filter dropdown on company expenses page.

### Vacations
- Request with start/end date, type (vacation/sick/personal), note
- Business day calculation (weekdays only)
- **Accrual system**: Salaried employees earn 2.08 vacation days/month (Danish standard, ~25/year). Disabled for hourly employees (`isHourly`).
- `User.vacationDays` field = admin-added **bonus days** on top of accrual (default 0)
- Total allowance = `2.08 × current month number + bonusDays`
- Admin approval/rejection workflow
- **Auto-fill on approval**: When admin approves a vacation, absence time entries are automatically created for each business day (skipping weekends/holidays), using the employee's daily target hours, under the Absence project with matching absence reason (vacation→VACATION, sick→SICK). Skipped for hourly employees (no daily target).
- **Auto-cleanup on rejection/cancellation**: System-created entries are deleted when vacation is rejected or cancelled
- **Employee can cancel approved vacations**: Status set to "cancelled" (soft delete), admin notified via sidebar badge, auto-created entries cleaned up, vacation days restored
- **Cancelled status**: Visible in admin vacation tab with filter, counted in sidebar badge alongside pending
- **Planner tab**: Monthly grid (Jan–Dec) showing cumulative vacation balance per month — earned days stack, planned vacations deduct, balance carries forward. Current month highlighted, green/red balance indicators.
- **Team Calendar tab**: Month view of all approved vacations across the company

### Projects
- **Projects tab**: CRUD, client assignment, color coding, budget hours, employee allocations
- **Customizable table columns**: Gear icon in card header opens popover to toggle visibility and reorder columns (Client, Budget, Entries, Phase, Status). Project and Actions columns are pinned. Settings persist in `localStorage` (`cloudtimer:projectsTableColumns`).
- Contract management dialog per project (FileText icon in actions):
  - Upload PDF/DOCX contracts (max 10MB, Vercel Blob)
  - AI extraction of terms via Claude Haiku (maxHours, maxBudget, deadline, scope, keywords, exclusions)
  - Anonymization option for sensitive data
  - Manual entry fallback for scanned PDFs
- **Project status**: Derived from boolean fields — Active (default), Paused (locked), Inactive (archived). Color-coded badges (green/amber/gray).
- Lock/archive: Locked prevents new entries (status → Paused), archived hides from employees (status → Inactive)
- System-managed projects (e.g., Absence) can't be locked/archived
- **Filters**: Projects page has status filter (All/Active/Paused/Inactive) + phase filter (All/[phases]/No Phases/Completed). Dashboard timesheet has status filter (All/Active/Paused).
- **Project Phases**: Company-wide phase definitions (e.g., Planning → Design → Development → QA)
  - Admin toggle in Overview → creates 4 default phases on first enable
  - Phase CRUD with reorder (up/down), rename (with optional global apply to historical entries), soft-delete, **color picker**
  - Per-project opt-out via "Use Phases" checkbox
  - Phase column in projects table with **PhaseProgress dropdown** — compact badge showing current phase name, click opens dropdown listing all phases (completed phases show checkmark, current highlighted, "Advance to [next]" action at bottom). Replaces the old horizontal stepper that rendered one button per phase.
  - **Final phase completion popup**: Asks if user wants to archive the project (set inactive)
  - Auto-advance: "Complete Phase" moves to next by sortOrder; last phase → "All Phases Complete"
  - Time entries default to project's current phase but users can **override the phase** via a dropdown in the time entry modal. Both `phaseId` and `phaseName` (denormalized snapshot) are stored. Phase can be changed on draft entries.
  - Migration dialog when enabling phases with existing projects
  - Analytics: phase distribution + velocity charts in Project Insights
  - AI insights: phase bottleneck detection, completion celebrations
  - Audit log: PHASE_CHANGE, RENAME_GLOBAL, PHASE_DELETE, PHASE_BACKFILL
- **e-conomic Import**: Import historical project data from e-conomic Projektkort (.xlsx)
  - 5-step wizard: Upload → Map Employees → Map Categories to Phases → Project Settings → Review & Confirm
  - Client-side XLSX parsing via SheetJS (`xlsx` package)
  - Auto-match employees by name similarity, categories to phases
  - Creates project, allocations, and time entries (pre-approved) in a single Prisma transaction
  - Audit log: IMPORT action with metadata
  - API: `POST /api/projects/import` (multipart/form-data, admin/manager only, rate-limited)
  - Parser: `lib/economic-import.ts` — extracts invoices, task categories, time entries from Projektkort format
- **Timeline tab**: Gantt view with project bars, milestone diamonds, today line
  - **Day/Week/Month view toggle** with **period span slider**: users drag to control visible range per view mode (Day: 1-6mo, Week: 2-12mo, Month: 6-24mo)
  - CRUD milestones (title, due date, completion tracking)
  - Budget health indicators (green/yellow/red)
  - Multi-milestone support per column in week/month views (with +N badge)

### Team
- **Team tab**: Member list with roles, bill/cost rates, weekly targets, extra vacation days, employment type (employee/freelancer), hourly toggle
- **Hourly employees** (`User.isHourly`): Toggle in team edit modal disables weekly target field. Table shows blue "Timelønnet"/"Hourly" badge instead of hours. Flex balance, vacation accrual, "Full Day" button, holiday entry creation, and admin utilization tracking are all disabled. Hourly employees can still submit vacation requests but accrual is not tracked.
- **Employee removal (soft-delete)**: Admin "Remove" sets `deletedAt` on the user, invalidates their `clerkId` to `"deleted_{id}"`, deletes their Clerk account, and creates a `MEMBER_REMOVED` audit log. All time entries, expenses, project allocations, and resource allocations are preserved for accurate company statistics. Removed employees are filtered from team lists, dropdowns, stats, and resource planner but their historical data remains in analytics, project budgets, and exports. The data export CSV marks removed employees with "Removed" status. If the same person later joins a different company on Cloud Timer, a new user record is created with no conflicts (email is not unique, companyId scoping isolates data).
- **Email invitations**: Admin invites create a pending user (`clerkId: "pending_*"`) and send a Resend email with sign-up link. When invited user signs up via Clerk, `/api/auth/sync` matches by email and links them to the existing company (bypasses onboarding form).
- Currency conversion display with master currency setting
- **Resource Planner tab**: Week/2-week/month grid view with **period span slider** (Week/2-week: 1-4wk, Month: 2-6mo)
  - Week & 2-week: daily columns with allocation bars spanning days
  - Month: week-level columns with aggregated allocation/vacation display
  - Per-day/total hours modes
  - Capacity summary with utilization percentages
  - Tentative/confirmed/completed status
  - Allocations feed into employee dashboard "Planned" stat card and timesheet grid columns

### Admin
- **Overview tab**: Financial stats (revenue, costs, margins), team utilization (1 decimal place), project budgets with allocations, absence reason management, e-conomic CSV export, company settings (currency, universal bill rate, expense threshold, AI anonymization, logo)
- **Approvals tab**: Nested Time Entry + Expense sub-tabs with per-day approve/reject, bulk actions
- **Vacations tab**: Approve/reject vacation requests with status filtering (pending/approved/rejected/cancelled)
- **Backups tab**: Full data export as ZIP (users.csv with Status/Removed At columns, projects.csv, time-entries.csv, metadata.json)
- **Audit Log tab**: Paginated viewer of all audit events (submit, approve, reject, lock, reopen, billing edits, expense amend/void, member removal) with action/entity/actor filters and color-coded badges

### Analytics
- 4 tabs: Employee, Team, Project, Company insights
- Date range picker, granularity toggle (weekly/monthly), approval filter
- Contract burn-down charts (actual vs ideal)
- Revenue/cost trends, utilization rates, billable breakdowns

### AI Assistant
- AI-powered business insights generated via Claude Sonnet
- Categories: Opportunity, Insight, Suggestion, Heads Up, Celebration
- Only generated for companies with activity in last 24 hours
- Dismissible, expire after 7 days
- AI budget tracking (daily/monthly limits per company)
- System-managed projects excluded from analysis

### Guided Tours
- Welcome tour (10 steps admin, 6 steps employee): Timesheet → Stats → Expenses → Vacations → Projects → Team → Admin → Analytics
- Admin setup tour (6 steps): Currency → Bill rate → Projects → Team → Allocations → Done
- Page-specific tours: Projects page, Team page (using dismissedGuides mechanism)
- Enhanced TourOverlay: Back button, keyboard nav (Esc/Arrow keys), auto-flip positioning, ResizeObserver, progress dots, smooth transitions
- Reset via Settings → "Replay Guided Tour"

### Super Admin Support Access
- Consent-based system for super admin to enter any company's context for support/troubleshooting
- **Flow**: Super admin requests access → Company admin sees banner in Admin Overview → Grants or denies → Super admin enters via "Enter" button → Redirected to dashboard with amber sidebar banner → Exits when done
- **Session-scoped**: Once super admin exits, the session is permanently expired — a new grant is needed to re-enter
- **Auto-expiry**: Sessions auto-expire after 4 hours
- **Single session**: Only one active/pending/granted session per super admin at a time
- **Auth override**: `getAuthUser()` detects active `SupportAccess` and overrides `companyId`, `company`, `role` to "admin" — all 70+ API routes work automatically
- **Admin notification**: Banner in AdminOverview with Grant/Deny buttons (pending) or Revoke button (active)
- **Sidebar banner**: Amber "Support Mode" banner with company name and "Exit Support" button
- **Audit logging**: SUPPORT_REQUEST, SUPPORT_GRANT, SUPPORT_DENY, SUPPORT_ENTER, SUPPORT_EXIT, SUPPORT_REVOKE
- **DB model**: `SupportAccess` with status lifecycle: `pending` → `granted` → `active` → `expired`

### Mileage Tracking
- Integrated into time entry modal (collapsible section)
- Fields: km, start/end address, intermediate stops, round trip toggle
- Address autocomplete + distance calculation via OpenRouteService API
- Rate limited: 20 requests/minute per company

## Validation & Rate Limiting

- Zod validation on all mutation API routes via `validate()` helper
- Rate limiting on expensive routes (AI, exports, uploads, mileage) via `checkRateLimit()`

## Soft-Delete Convention

- **User queries must include `deletedAt: null`** in the `where` clause when listing active team members. This applies to all `db.user.findMany()` calls that populate team lists, dropdowns, stats, analytics members, and resource planners.
- **Exception**: Data export (`/api/admin/export`) intentionally includes all users (active + removed) for complete records.
- **Auth gate**: `getAuthUser()` in `lib/auth.ts` returns `null` for users with `deletedAt` set, blocking all API access globally.
- **Auth sync**: `/api/auth/sync` checks `deletedAt` to prevent removed users from re-linking and adds `deletedAt: null` to pending user lookups.

## Environment Variables

- `DATABASE_URL` - Neon PostgreSQL connection string
- `CLERK_SECRET_KEY` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk auth
- `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` - Error monitoring
- `ANTHROPIC_API_KEY` - Claude AI for contract extraction + insights
- `OPENROUTESERVICE_API_KEY` - Mileage distance/autocomplete
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob storage
- `RESEND_API_KEY` - Resend email service
- `RESEND_FROM_EMAIL` - Sender address (e.g., `Cloud Timer <noreply@cloudtimer.dk>`)
- `SUPER_ADMIN_EMAIL` - Email address for platform super admin (enables `/super-admin` page + support access)

## Known Gaps (potential future work)

### High Value
- **Email notifications** — Only team invitation emails (via Resend). No notifications for approvals, rejections, or status changes. Admins must manually check for pending approvals.
- **In-app notification center** — Only badge counts on sidebar, no notification list
- **Settings page** — Skeleton only (tour replay, data export, account deletion). Missing: notification preferences, language persistence, timezone, default project, profile management.

### Medium Value
- **Hourly employee vacation handling** — Hourly employees can request vacations but accrual is disabled. No custom vacation allowance system for hourly workers yet.
- **Expense reports** — No grouped view by month/project/category
- **AI usage dashboard** — AIApiUsage model tracks costs but no admin UI
- **Public holidays** — Not factored into vacation day calculations
- **Half-day vacation requests** — Only full-day increments
- **Timer mode** — No start/stop real-time tracking
- **Time entry templates** — No recurring/saved entry patterns

### Low Priority
- Keyboard shortcuts (Cmd+S save, Cmd+Enter submit)
- Offline support / service worker
- Optimistic UI updates
- Custom report builder
- Slack/Teams integration
- Client portal
