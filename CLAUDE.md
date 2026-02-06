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
- Sentry error monitoring (client/server/edge) with error boundaries at root, app, and dashboard levels
- Vercel Blob for file storage (contract PDFs, receipts, company logos)

## Key Commands

- `npm run dev` - Start development server
- `npm run build` - Production build (also runs linting + type checking)
- `npm run test` - Run all 99 unit tests (Vitest)
- `npm run test:watch` - Run tests in watch mode

## Project Structure

### Pages (9 sidebar items)
- `app/(dashboard)/dashboard/` - Employee timesheet + stat cards + flex balance
- `app/(dashboard)/expenses/` - Expense tracking with receipt uploads
- `app/(dashboard)/vacations/` - Vacation requests + balance
- `app/(dashboard)/projects/` - **Tabbed**: Projects list | Timeline (with milestones)
- `app/(dashboard)/team/` - **Tabbed**: Team members | Resource Planner
- `app/(dashboard)/admin/` - **Tabbed**: Overview | Approvals | Vacations | Backups | Audit Log
- `app/(dashboard)/analytics/` - **Tabbed**: Employee | Team | Project | Company insights
- `app/(dashboard)/ai/` - AI-powered business insights
- `app/(dashboard)/settings/` - Tour replay, data export, account deletion
- `app/(dashboard)/super-admin/` - Platform-level admin (superAdminOnly)

### API Routes (69 route files across 18 domains)
- `app/api/` - All scoped by companyId
- Key domains: `time-entries`, `projects`, `team`, `admin`, `expenses`, `vacations`, `contracts`, `resource-allocations`, `analytics`, `ai`, `insights`, `mileage`, `auth`, `cron`, `super-admin`, `user`, `upload`, `absence-reasons`

### Components
- `components/admin/` - AdminOverview, AdminApprovals, AdminVacations, AdminBackups, AdminAuditLog
- `components/approvals/` - TimeEntryApprovals, ExpenseApprovals (nested tabs within admin)
- `components/analytics/` - EmployeeInsights, TeamInsights, ProjectInsights, CompanyInsights
- `components/contracts/` - ContractSection (upload, AI extraction, manual entry)
- `components/projects/` - ProjectsList, ProjectTimeline
- `components/project-timeline/` - TimelineGrid, MilestoneDialog
- `components/resource-planner/` - ResourceGrid, AllocationDialog, ViewControls, CapacitySummary
- `components/team/` - TeamList, ResourcePlanner
- `components/layout/` - Sidebar (role-based nav with badge counts)
- `components/ui/` - shadcn/ui primitives, guided-tour, page-guide, info-tooltip, theme/locale toggles

### Shared Libraries
- `lib/auth.ts` - getAuthUser helper (Clerk + Prisma)
- `lib/db.ts` - Prisma client singleton
- `lib/schemas.ts` - All Zod validation schemas
- `lib/validate.ts` - Zod validation helper for API routes
- `lib/rate-limit.ts` - In-memory rate limiter
- `lib/api-error.ts` - Standardized API error helper with Sentry integration
- `lib/i18n.ts` - useTranslations, useDateLocale hooks
- `lib/currency.ts` - convertAndFormat with SUPPORTED_CURRENCIES
- `lib/week-helpers.ts` - Week date utilities
- `lib/calculations.ts` - Flex balance, daily target calculations
- `lib/expense-utils.ts` - Expense formatting helpers
- `lib/analytics-utils.ts` - Analytics data processing

### Database (15 models)
Company, User, Project, TimeEntry, VacationRequest, AuditLog, ProjectAllocation, Contract, ContractInsight, AIApiUsage, Expense, CompanyExpense, AbsenceReason, ResourceAllocation, ProjectMilestone

### Tests
- `__tests__/lib/` - 99 unit tests across 6 suites (Vitest)

## Core Features

### Time Tracking (Dashboard)
- Weekly timesheet grid with per-cell time entry creation/editing
- 6 stat cards: Target, Billable Hours, Vacation Used, Total Hours, Flex Balance, Remaining Vacation
- **Cumulative flex balance**: Carries over from all prior weeks since user creation (not just current week)
- Daily flex balance row showing running overtime/undertime
- Per-day submit buttons + bulk "Submit Week"
- Flex calculation: Mon-Thu get rounded daily target, Friday gets remainder (e.g., 37h → 9.25×4 + 0h Fri... actually Mon-Thu=9.5, Fri=7 for 45h)
- Budget progress bars per project
- Mileage tracking in time entry modal (OpenRouteService API)
- Absence reason selection for absence project entries

### Expenses
- Create with amount, description, category, date, project, receipt upload
- Auto-submitted on creation (no manual submit step)
- Editable until approved by admin
- Admin auto-approve threshold setting
- Receipt management (PDF/images via Vercel Blob)

### Vacations
- Request with start/end date, type (vacation/sick/personal), note
- Business day calculation (weekdays only)
- Balance tracking: used vs remaining
- Admin approval/rejection workflow

### Projects
- **Projects tab**: CRUD, client assignment, color coding, budget hours, employee allocations
- Contract management dialog per project (FileText icon in actions):
  - Upload PDF/DOCX contracts (max 10MB, Vercel Blob)
  - AI extraction of terms via Claude Haiku (maxHours, maxBudget, deadline, scope, keywords, exclusions)
  - Anonymization option for sensitive data
  - Manual entry fallback for scanned PDFs
- Lock/archive: Locked prevents new entries, archived hides from employees
- System-managed projects (e.g., Absence) can't be locked/archived
- **Timeline tab**: 3-month Gantt view with project bars, milestone diamonds, today line
  - CRUD milestones (title, due date, completion tracking)
  - Drag to update project start/end dates
  - Budget health indicators (green/yellow/red)

### Team
- **Team tab**: Member list with roles, bill/cost rates, weekly targets, vacation days, employment type (employee/freelancer)
- Currency conversion display with master currency setting
- **Resource Planner tab**: Week/2-week/month grid view
  - Drag allocations across employees and dates
  - Per-day/total hours modes
  - Capacity summary with utilization percentages
  - Tentative/confirmed/completed status

### Admin
- **Overview tab**: Financial stats (revenue, costs, margins), team utilization, project budgets with allocations, absence reason management, e-conomic CSV export, company settings (currency, universal bill rate, expense threshold, AI anonymization, logo)
- **Approvals tab**: Nested Time Entry + Expense sub-tabs with per-day approve/reject, bulk actions
- **Vacations tab**: Approve/reject vacation requests with status filtering
- **Backups tab**: Full data export as ZIP (users.csv, projects.csv, time-entries.csv, metadata.json)
- **Audit Log tab**: Paginated viewer of all audit events (submit, approve, reject, lock, reopen, billing edits, expense amend/void) with action/entity/actor filters and color-coded badges

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

### Mileage Tracking
- Integrated into time entry modal (collapsible section)
- Fields: km, start/end address, intermediate stops, round trip toggle
- Address autocomplete + distance calculation via OpenRouteService API
- Rate limited: 20 requests/minute per company

## Validation & Rate Limiting

- Zod validation on all mutation API routes via `validate()` helper
- Rate limiting on expensive routes (AI, exports, uploads, mileage) via `checkRateLimit()`

## Environment Variables

- `DATABASE_URL` - Neon PostgreSQL connection string
- `CLERK_SECRET_KEY` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk auth
- `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` - Error monitoring
- `ANTHROPIC_API_KEY` - Claude AI for contract extraction + insights
- `OPENROUTESERVICE_API_KEY` - Mileage distance/autocomplete
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob storage

## Known Gaps (potential future work)

### High Value
- **Email notifications** — No notification system at all (no SMTP/SendGrid). Admins must manually check for pending approvals. Employees don't know when entries are approved/rejected.
- **In-app notification center** — Only badge counts on sidebar, no notification list
- **Settings page** — Skeleton only (tour replay, data export, account deletion). Missing: notification preferences, language persistence, timezone, default project, profile management.

### Medium Value
- **Vacation calendar view** — No visual calendar showing team vacation overlap
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
