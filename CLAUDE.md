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
- ExcelJS + file-saver for client-side Excel export, @react-pdf/renderer for PDF generation (timeline exports)

## Key Commands

- `npm run dev` - Start development server
- `npm run build` - Production build (also runs linting + type checking)
- `npm run test` - Run all 200 unit tests (Vitest)
- `npm run test:watch` - Run tests in watch mode

## Project Structure

### Pages (sidebar order: admin items first, then employee items)
1. `app/(dashboard)/dashboard/` - Employee timesheet + stat cards + flex balance
2. `app/(dashboard)/admin/` - **Tabbed**: Overview | Approvals | Vacations | Backups | Audit Log *(admin only)*
3. `app/(dashboard)/team/` - **Tabbed**: Team members | Resource Planner *(admin/manager)*
4. `app/(dashboard)/projects/` - **Tabbed**: Projects list | Timeline with milestones & activities Gantt *(admin/manager)*
5. `app/(dashboard)/ai/` - AI-powered business insights *(admin/manager)*
6. `app/(dashboard)/analytics/` - **Tabbed**: Employee | Team | Project | Company insights *(admin/manager)*
7. `app/(dashboard)/expenses/` - Expense tracking with receipt uploads
8. `app/(dashboard)/billing/` - **Tabbed**: Uninvoiced | Invoices | Settings *(admin/manager)*
9. `app/(dashboard)/vacations/` - **Tabbed**: My Requests | Planner | Team Calendar
10. `app/(dashboard)/settings/` - Tour replay, data export, account deletion
11. `app/(dashboard)/super-admin/` - Platform-level admin with support access requests *(superAdmin only)*

### API Routes (108 route files across 29 domains)
- `app/api/` - All scoped by companyId (via `getAuthUser()` which auto-overrides for support mode)
- Key domains: `time-entries`, `projects`, `projects/[id]/activities` (CRUD + reorder), `team`, `admin`, `expenses`, `vacations`, `contracts`, `resource-allocations`, `analytics`, `ai`, `insights`, `mileage`, `auth`, `cron`, `super-admin`, `super-admin/access`, `admin/support-access`, `user`, `upload`, `absence-reasons`, `admin/phases`, `phases`, `admin/expense-categories`, `invoices`, `billing`, `accounting/test`, `accounting/customers`, `accounting/mappings`, `accounting/economic` (authorize + callback), `accounting/dinero` (authorize + callback)

### Components
- `components/admin/` - AdminOverview, AdminApprovals, AdminVacations, AdminBackups, AdminAuditLog, TeamUtilizationBars, PhaseMigrationDialog
- `components/approvals/` - TimeEntryApprovals, ExpenseApprovals (nested tabs within admin)
- `components/analytics/` - EmployeeInsights, TeamInsights, ProjectInsights, CompanyInsights, analytics-shared (KpiCard, ChartCard with expand/export, MiniSelect, StatusDot, InfoTip, ChartTooltip, BudgetBar, FontLoader, AnalyticsKeyframes, color/style constants)
- `components/billing/` - UninvoicedTab, InvoicesTab, InvoiceCreateDialog, InvoiceDetailDialog, BillingSettings
- `components/contracts/` - ContractSection (upload, AI extraction, manual entry)
- `components/projects/` - ProjectsList, ProjectTimeline (self-contained ~3200-line inline-styled Gantt), PhaseProgress, TimelineExportPopover (Excel/PDF export with filter popover), TimelinePdfDocument (@react-pdf/renderer A3 Gantt PDF)
- `components/project-timeline/` - DeadlinePopover, DeadlineMarker, TimelineGrid, MilestoneDialog, MilestonePopover, ActivityGanttSection, ActivityRow, ActivityBlock, ActivityPopover, ActivityCategoryHeader, ActivityProgressBar, InlineEditCell, TimelineContextMenu, TimelineEditFooter, useTimelineEditSession, useTimelineDrag, types.ts (`TimelineViewMode: "day" | "week" | "month" | "year"`)
- `components/resource-planner/` - ResourceGrid, AllocationDialog, AllocationBlock, ViewControls, PlannerControls, PlannerGrid, PlannerRow, PlannerCell, BulkActionToolbar, CapacitySummary
- `components/team/` - TeamList, ResourcePlanner
- `components/vacations/` - VacationCalendar, VacationPlanner
- `components/layout/` - Sidebar (role-based nav with badge counts, support mode banner)
- `components/landing/` - Nav, Hero, IntegrationBar, DanishAdvantage, BrowserShowcase, TimelinePreview, ResourcePlannerPreview, InsightSection, GraphStrip, FounderQuote, CtaSection, WhyChoose, Footer, LiveDemoButton, RevealOnScroll
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
- `lib/demo-date.ts` - `getToday()` returns pinned demo date from committed `lib/demo-date-generated.json` (or real `new Date()` if `{"date":null}`). Also exports custom `isToday()` that checks against `getToday()` — **must be used instead of `date-fns isToday`** which always uses the real system date. Used by 12+ components.
- `lib/demo-date-generated.json` - Committed JSON file with `{"date":"2026-02-12"}` (or `{"date":null}` for production). Imported by `demo-date.ts`. Using a committed file avoids webpack `DefinePlugin` issues with `NEXT_PUBLIC_*` env vars on Vercel.
- `lib/demo-seed.ts` - Deterministic demo data seeder (seed 42 LCG PRNG). Pinned to Feb 12, 2026. Generates 27 weeks of time entries for 12 employees at 93%+ billable utilization across 8 projects. Per-employee `flexBias` controls flex balance (-20 to +25h range). Absence entries created for vacation/sick days (under Absence project) to keep flex neutral on off-days. Christmas period 15% skip rate. Skips entries for days after the pinned date. Includes sick days, vacations, invoices, resource allocations, and project allocations with tightly budgeted remaining hours (~30-40h above actual usage).
- `lib/seed-holidays.ts` - ensureHolidayAbsenceReason helper
- `lib/email.ts` - Resend email client (lazy-init), sendInvitationEmail
- `lib/expense-utils.ts` - Expense formatting helpers
- `lib/analytics-utils.ts` - Analytics data processing (28+ functions): aggregation for employee, team, project, company views. Key additions: `aggregateEmployeePhaseBreakdown`, `aggregateEmployeeFlexTrend`, `aggregateCapacityDetail`, `aggregateEffectiveRate`, `aggregateBudgetVelocity`, `aggregateRedList`, `aggregateTeamContribution`, `aggregateClientConcentration`, `aggregateInvoicePipeline`, `aggregateBillingVelocity`, `aggregateCollectionSummary`, `aggregateUnbilledAging`. `withProjection()` adds dashed projection lines for incomplete current periods.
- `lib/analytics-forecast.ts` - Revenue bridge forecast engine: `computeRevenueBridge()` (historical actuals + future forecast), `compute30DayForecast()`. Uses ResourceAllocations with confirmed=100%, tentative=50% weighting.
- `lib/economic-import.ts` - e-conomic Projektkort XLSX parser
- `lib/vacation-entries.ts` - createVacationEntries/deleteVacationEntries (shared by vacation routes)
- `lib/invoice-pdf.ts` - Server-side A4 invoice PDF generation (pdf-lib), multi-page support, Danish formatting
- `lib/timeline-excel-export.ts` - Client-side Excel workbook builder (ExcelJS + file-saver). 5 sheets: Projektoversigt, Aktiviteter, Milepæle, Tidslinje (Gantt via cell fills), Budgetstatus. A3 landscape, conditional formatting, today column highlight.
- `lib/accounting/` - Accounting system adapter pattern + AES-256-GCM credential encryption:
  - `lib/accounting/types.ts` - `AccountingCredentials` type (system, accessToken, refreshToken, tokenExpiresAt, etc.)
  - `lib/accounting/encryption.ts` - `encrypt()`/`decrypt()` using `ACCOUNTING_ENCRYPTION_KEY`
  - `lib/accounting/economic.ts` - e-conomic REST API adapter (token auth, never expires)
  - `lib/accounting/billy.ts` - Billy API adapter (X-Access-Token header)
  - `lib/accounting/dinero.ts` - Dinero API adapter via Visma Connect (OAuth2 + auto-refresh, also supports legacy client_credentials)

### Database (24 models)
Company (+ billing fields: `invoicePrefix`, `nextInvoiceNumber`, `defaultPaymentDays`, `companyAddress`, `companyCvr`, `companyBankAccount`, `companyBankReg`, `invoiceFooterNote`, `accountingSystem`, `accountingCredentials`, `flexStartDate`), User (`isHourly`, `weeklyTarget`, `vacationDays`, `vacationTrackingUnit`, `vacationHoursPerYear`, `deletedAt`, etc.), Project (`estimatedNonBillablePercent`), TimeEntry (`invoiceId`, `invoicedAt`, `externallyInvoiced`), VacationRequest, AuditLog, ProjectAllocation, Contract, ContractInsight, AIApiUsage, Expense (`invoiceId`, `invoicedAt`), CompanyExpense, ExpenseCategory, AbsenceReason, ResourceAllocation, ProjectMilestone (`type`, `phaseId`, `description`, `icon`, `color` — deadline fields + Phase relation), ProjectActivity, Phase, SupportAccess, CompanyHoliday, Invoice, InvoiceLine, CustomerMapping, OAuthState

### Tests
- `__tests__/lib/` - 200 unit tests across 11 suites (Vitest)

## Core Features

### Time Tracking (Dashboard)
- Weekly timesheet grid with per-cell time entry creation/editing
- 6 stat cards: Target, Billable Hours, Vacation Used, Total Hours, Flex Balance (Flexsaldo), Remaining Vacation (all numeric values use `.toFixed(1)` for clean display)
- **Hourly employees** (`isHourly`): Reduced to 3 stat cards (Total, Billable, Hourly indicator). Flex balance row, "Full Day" button, and vacation accrual hidden.
- **Cumulative flex balance**: Carries over from all prior weeks since user creation (not just current week). Skipped entirely for hourly employees. **Only accumulates targets up to and including today** — future days in the current week don't penalize the balance (e.g., Friday's target isn't counted when it's Thursday). Future days show "—" instead of a balance value.
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

### Billing / Fakturering
- **Info banner**: Blue notice on billing page explaining that invoices are drafts for use with a registered accounting system, per Danish law (bogføringsloven).
- **Uninvoiced tab**: Cards per project showing uninvoiced approved billable hours, amounts, employee count, expense totals. "Create Invoice" opens multi-step dialog. Uses `Banknote` icon (not DollarSign) for currency-neutral display.
- **Invoice creation (3-step wizard)**:
  - Step 1 (Scope) — select period (defaults to last month), grouping (employee/phase/description/flat), **phase filter** (dropdown with colored dots to invoice only a specific phase, or "All phases"), include expenses checkbox with hint text.
  - Step 2 (Review) — editable line items table (add/remove/modify lines), see subtotal/25% MOMS/total. Quantity and unit price step by 1 (not 0.01). Flat grouping uses project name as description (not hardcoded text).
  - Step 3 (Confirm) — client info (name, CVR, address), payment terms with **"Set as default" button** (appears when value differs from company default, saves via billing settings API for future invoices), invoice note, final summary.
- **Payment terms default**: Dialog fetches company's saved `defaultPaymentDays` on open instead of hardcoding 8. "Set as default" button persists changes for all future invoices.
- **Empty invoice validation**: API returns 400 error if no billable entries or expenses found for the selected period/filters.
- **Invoice model**: Draft → Sent → Paid → Void lifecycle. Atomic invoice number increment via Prisma `$transaction`. Links to time entries and expenses (marks them as invoiced). Audit log entry on creation.
- **PDF generation**: Server-side A4 Danish invoice PDFs via pdf-lib — company header, "FAKTURA" title, client info, line items table, subtotal/MOMS/total, bank details, footer note. Danish number formatting (period thousands, comma decimals). **Multi-page support**: long invoices flow onto additional pages with repeated table headers; totals and bank details automatically move to new page if insufficient space.
- **Bill rate priority**: Employee rate (EMPLOYEE_RATES mode) → project rate (PROJECT_RATE mode) → company default rate
- **Accounting integrations (adapter pattern)**: Credentials encrypted at rest with AES-256-GCM (`ACCOUNTING_ENCRYPTION_KEY` env var).
  - **e-conomic**: OAuth-style grant token flow — "Connect" button redirects to e-conomic installation page, customer grants access, callback receives `agreementGrantToken`. Token never expires. Routes: `/api/accounting/economic/authorize` + `/api/accounting/economic/callback`.
  - **Dinero**: Standard OAuth2 Authorization Code flow via Visma Connect — "Connect" button redirects to Visma login, customer authorizes, callback exchanges code for access + refresh tokens. Access tokens expire in ~1 hour, auto-refreshed via `DineroAdapter.refreshAccessToken()` with 5-minute buffer. Routes: `/api/accounting/dinero/authorize` + `/api/accounting/dinero/callback`.
  - **Billy**: Manual token entry only (no OAuth available). Access Token + Organization ID entered directly in settings.
  - **OAuthState model**: CSRF protection during OAuth flows — random state token stored in DB with companyId, provider, and 10-minute expiry. Validated on callback.
  - **Test connection**: Works with both manual credentials (Billy) and saved/encrypted credentials (e-conomic, Dinero) via `/api/accounting/test`.
- **Customer mapping**: Maps Cloud Timer client names to external accounting system customer IDs. Used during invoice sync to push drafts. CRUD via `/api/accounting/mappings`.
- **Billing settings (BillingSettings component)**:
  - **Company details card**: Labeled "Your Company (Invoice Sender)" / "Dit firma (afsender på faktura)" — address, CVR, bank account/reg, payment terms, invoice prefix, footer note.
  - **Accounting system card**: Shows green "Connected" badge with dark mode support when connected. "Test Connection" and "Disconnect" buttons for connected state. Three provider options (e-conomic, Dinero with OAuth; Billy with manual entry) for unconnected state.
  - **Customer mapping card**: Appears when connected. Table of existing mappings with delete, add new mapping via client name + external customer dropdown.
  - **OAuth callback handling**: Reads `?connected=` and `?error=` query params from URL on mount → shows success/error toast, cleans URL.
- **Sidebar badge**: Shows count of projects with uninvoiced approved billable entries. Badge dismissed after visiting the billing tab; reappears only when new uninvoiced entries are added (localStorage-based seen count).
- **Externally invoiced section**: Imported entries (from e-conomic import) are marked `externallyInvoiced: true` in TimeEntry. They keep `billingStatus: "billable"` for analytics but are excluded from uninvoiced/invoice creation queries. A green-tinted section on the Uninvoiced tab shows "Already invoiced in [e-conomic/Billy/Dinero]" with per-project hours, amounts, and entry counts. API: `GET /api/invoices/externally-invoiced`.

### Vacations
- Request with start/end date, type (vacation/sick/personal), note
- Business day calculation (weekdays only)
- **Accrual system**: Salaried employees earn 2.08 vacation days/month (Danish standard, ~25/year). Disabled for hourly employees (`isHourly`).
- **Hours-based vacation tracking** (`User.vacationTrackingUnit`): Per-employee toggle between "days" (default) and "hours". For part-time/variable-hours employees, vacation is tracked in hours: accrual = `vacationHoursPerYear / 12` per month. Used hours = approved vacation business days × daily target (`weeklyTarget / 5`). Admin sets annual entitlement via `User.vacationHoursPerYear` (e.g., 150h for 30h/week employee). Dashboard, vacations page, planner, and admin view all adapt to show hours when applicable.
- `User.vacationDays` field = admin-added **bonus days/hours** on top of accrual (default 0). Repurposed as bonus hours when tracking unit is "hours".
- Total allowance (days mode) = `2.08 × current month number + bonusDays`
- Total allowance (hours mode) = `(vacationHoursPerYear / 12) × current month number + bonusHours`
- Admin approval/rejection workflow
- **Admin add on behalf**: Admins/managers can create vacation requests for any employee via an employee dropdown in the request modal. Requests created on behalf are auto-approved with absence time entries generated immediately. Shared logic in `lib/vacation-entries.ts`.
- **Auto-fill on approval**: When admin approves a vacation, absence time entries are automatically created for each business day (skipping weekends/holidays), using the employee's daily target hours, under the Absence project with matching absence reason (vacation→VACATION, sick→SICK). Skipped for hourly employees (no daily target).
- **Auto-cleanup on rejection/cancellation**: System-created entries are deleted when vacation is rejected or cancelled
- **Employee can cancel approved vacations**: Status set to "cancelled" (soft delete), admin notified via sidebar badge, auto-created entries cleaned up, vacation days restored
- **Cancelled status**: Visible in admin vacation tab with filter, counted in sidebar badge alongside pending
- **Planner tab**: Monthly grid (Jan–Dec) showing cumulative vacation balance per month — earned days stack, planned vacations deduct, balance carries forward. Current month highlighted, green/red balance indicators.
- **Team Calendar tab**: Month view of all approved vacations across the company

### Projects
- **Projects tab**: CRUD, client assignment, color coding, budget hours, employee allocations, estimated non-billable percentage
- **Estimated non-billable percentage** (`Project.estimatedNonBillablePercent`): Optional 0-100% input on billable projects. For imported projects with only billable hours, this estimates the non-billable portion. Formula: `estimatedNonBillableHours = actualBillableHours × (percent / 100)`. Affects analytics calculations (profitability, utilization, billable mix, overhead) but not flex or billing. Helper text shows estimated hours in the edit modal.
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
  - Creates project, allocations, and time entries (pre-approved, `externallyInvoiced: true`) in a single Prisma transaction
  - **Re-import safe**: Deletes existing entries for mapped employees on the target project before inserting, preventing duplicates. Allocations use upsert to replace hours (not accumulate).
  - Audit log: IMPORT action with metadata
  - API: `POST /api/projects/import` (multipart/form-data, admin/manager only, rate-limited)
  - Parser: `lib/economic-import.ts` — extracts invoices, task categories, time entries from Projektkort format
- **Timeline tab**: Self-contained ~3200-line `ProjectTimeline.tsx` component with all inline styles (no Tailwind). Two-level Gantt view with project bars, milestone markers, today line.
  - **Architecture**: Week-based internal positioning system with `ANCHOR` date (+ `MONTH_ANCHOR` for year view), `dateToWeek()`/`weekToDate()` conversion. `useReducer` undo/redo for project/activity position edits. Window-level `mousemove`/`mouseup` listeners for drag-and-drop (always-on during edit mode). Refs (`dragRef`, `dragDeltaRef`, `justDraggedRef`) to avoid stale closures. Milestones in separate `useState` (not undo/redo) for immediate API calls.
  - **Day/Week/Month/Year view toggle**: Day view (36px columns, 35 visible, daily precision with weekend dimming), Week view (56px columns, 16 visible), Month view (96px columns, 10 visible), Year view (64px columns, 18 visible, **month-based** — uses `differenceInCalendarMonths`/`addMonths` instead of week math, columns show month names with year labels at January). Navigation step: 7 days / 4 weeks / 4 months / 6 months. Data refetches on view switch with activity cache cleared.
  - **Date handling**: `dateToWeek` uses `differenceInCalendarDays` (day mode), `differenceInCalendarWeeks` (week/month), or `differenceInCalendarMonths` (year mode). Handles both `"yyyy-MM-dd"` and ISO `"yyyy-MM-ddTHH:mm:ss.000Z"` formats via `dateStr.slice(0, 10)`.
  - **Focus Mode**: Toggle to focus on a single project — hides all other projects, expands the focused project's activities. Activated via "Focus" button in toolbar or by clicking a project's focus icon.
  - CRUD milestones (title, due date, completion tracking)
  - **Deadline system**: Extends milestones with `type` (phase/custom), `phaseId`, `description`, `icon`, `color`
    - **Phase deadlines**: Linked to company phases, dashed vertical line in phase color. Auto-completed when phase is advanced via PhaseProgress.
    - **Custom deadlines**: Freeform with icon picker (Flag, Handshake, Rocket, Eye, Calendar), description, color. Dotted vertical line.
    - **DeadlinePopover**: Two-tab create/edit (Phase Deadline / Custom), excludes phases that already have deadlines. Rendered at component root level. State: `deadlinePopover` with `{ open, position, milestone, projectId, projectColor, defaultDate? }`.
    - **DeadlineMarker**: Vertical line + Lucide icon in milestone row, color-coded by overdue/completed/type
    - Collapsed key deadline diamond is clickable (opens DeadlinePopover via `milestoneId` lookup in `liveMilestones`)
    - "**+ Add deadline**" button in expanded project left panel (below "+ Add activity"), opens DeadlinePopover
    - Double-click empty milestone row area creates deadline at that week
    - `phaseDeadlinesByProject` useMemo tracks existing phase deadlines per project to prevent duplicates
  - Budget health indicators (green/yellow/red)
  - **Per-project activity Gantt (Level 2)**: Expand any project to see a full activity Gantt chart
    - `ProjectActivity` model: name, dates, status, phase/category grouping, assignee, color, notes, sortOrder
    - Activities grouped by phase (when phases enabled) or free-text category
    - Status system: not_started (dashed), in_progress (solid), needs_review (orange stripe), complete (muted), overdue (computed: red ring)
    - **Drag-to-move/resize**: Window-level mouse listeners with `dragRef` for project bars and activity blocks. Commit on mouseup via `commitDrag()`. Delta calculated from `(e.clientX - startMouseX) / COL_WIDTH`.
    - Activity list in left panel with "**+ Add activity**" button (edit mode)
    - Color fallback: `activity.color → phaseColor → projectColor`
    - Lazy-loaded: activities fetched only when project expanded, cached in `activityCache`
    - API: `GET/POST/PUT/DELETE /api/projects/[id]/activities`, `PUT /api/projects/[id]/activities/reorder`
  - **Edit mode**: Toggle via "Edit Timeline" button. Footer bar shows unsaved change count, undo/redo/discard/save buttons. Undo/redo via `useReducer` with `past`/`present`/`future` stacks. Save batches all project + activity date changes into parallel API calls.
  - **Export (Excel + PDF)**: "Eksportér" button opens `TimelineExportPopover` with project selection (Alle/Aktive/Fakturerbare + checklist), date range picker, include toggles (Aktiviteter, Milepæle, Budget). Generates client-side via dynamic imports. Excel: 5-sheet workbook (ExcelJS) with Gantt chart via cell fills. PDF: A3 landscape Gantt (@react-pdf/renderer) with project bars, activity bars, milestone diamonds, today line. Activities fetched on-demand per project. Raw `TimelineProject[]` stored in `rawProjectsRef` for export data. Ctrl/Cmd+E keyboard shortcut.

### Team
- **Team tab**: Member list with roles, bill/cost rates, weekly targets, extra vacation days, employment type (employee/freelancer), hourly toggle
- **Cost rate visibility toggle**: Cost rates hidden by default (shows "*** kr./h" or "*** kr./t"). Eye icon toggle in column header to reveal actual values. Always defaults to hidden on page load for screen privacy.
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
  - **Multi-select & bulk actions**: Toggle "Multi-select" mode via toolbar button. Click to select individual blocks, drag across cells to select multiple. Selected blocks show blue ring + checkmark. Floating BulkActionToolbar at bottom with: select all/clear, bulk status change (tentative/confirmed/completed), move by N days, delete with confirmation. Drag-and-drop selected blocks to move all at once. Escape exits selection mode. Bulk API: `POST /api/resource-allocations/bulk` (actions: delete, updateStatus, move).

### Admin
- **Overview tab**: Financial stats (revenue, costs, margins), team utilization (1 decimal place), project budgets with allocations, absence reason management, e-conomic CSV export, company settings (currency, universal bill rate, expense threshold, AI anonymization, logo, flex start date)
- **Flex balance start date** (`Company.flexStartDate`): Admin sets a company-wide go-live date. Flex calculations use `max(user.createdAt, flexStartDate)` as the anchor, avoiding massive negative flex balances when starting to use Cloud Timer. Configurable via settings card in Admin Overview with save/clear buttons.
- **Approvals tab**: Nested Time Entry + Expense sub-tabs with per-day approve/reject, bulk actions
- **Vacations tab**: Approve/reject vacation requests with status filtering (pending/approved/rejected/cancelled)
- **Backups tab**: Full data export as ZIP (users.csv with Status/Removed At columns, projects.csv, time-entries.csv, metadata.json)
- **Audit Log tab**: Paginated viewer of all audit events (submit, approve, reject, lock, reopen, billing edits, expense amend/void, member removal) with action/entity/actor filters and color-coded badges

### Analytics
- **Architecture**: Fully inline-styled (no Tailwind/shadcn), DM Sans + JetBrains Mono fonts, warm stone palette (#FAFAF9 bg, #E5E7EB borders, #1F2937 text). All charts via Recharts with `ResponsiveContainer`. Shared components in `analytics-shared.tsx`.
- **Sticky header**: Tab pills (Employee/Team/Project/Company), granularity toggle (monthly/weekly), approval filter (approved only/all), date range display (last 3 months)
- **5 global KPI cards**: Revenue Forecast (30d), EBITDA Est., Avg. Effective Rate, Unbilled Revenue, Leave Liability — fetched via `type=kpis`
- **Employee tab**: Employee selector → 4 KPIs (utilization color-coded, total hours, flex balance, absence days) → Time Distribution donut + Phase Breakdown horizontal bar → Utilization Trend with planned line + green zone (70-85%) → Profitability composed chart + Flex Balance Trend area
- **Team tab**: Capacity & Health stacked bar (billable/internal/vacation/available with burnout 115% line) → Bench list (employees <50% allocation) + Effective Hourly Rate ranking → Utilization Comparison + Time Mix stacked bars
- **Project tab**: Red List table (>85% budget or <20% margin, badge count on tab) → Budget Velocity scatter (time vs budget with diagonal reference) + Billable Mix → Contract Burn-down area + Profitability composed → Phase Distribution + Team Contribution pie
- **Company tab**: Revenue Bridge composed chart (actual bars + forecast bars + break-even line) → Client Concentration pie + Invoice Pipeline stacked → Billing Velocity card + Collection Summary + Expense Breakdown → Non-Billable Trend lines (with zones) + Unbilled Work Aging list
- **ChartCard features**: Expand to fullscreen modal, PNG export (html2canvas), CSV data export
- **Projection lines**: `withProjection()` utility adds dashed lines for incomplete current periods on trend charts
- **API**: Single `GET /api/analytics` endpoint with `type` param (employee/team/project/company/kpis). Revenue forecast uses `lib/analytics-forecast.ts` with ResourceAllocation data.
- Estimated non-billable hours from project percentages factored into profitability, billable mix, and overhead calculations

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

### Landing Page (`app/page.tsx`)
- Pure CSS design (`.lp-*` classes in `globals.css`), no Tailwind
- Warm stone palette: `--lp-bg: #FAFAF9`, `--lp-accent: #1E3A5F`, `--lp-text: #1F2937`, `--lp-dim: #6B7280`
- Typography: Newsreader (serif headings), JetBrains Mono (data/metadata), DM Sans (body)
- Glass-morphism nav with backdrop blur, reveal-on-scroll animations
- Sections: Hero, IntegrationBar, DanishAdvantage, BrowserShowcase (×2 with TimelinePreview + ResourcePlannerPreview), InsightSection, GraphStrip, FounderQuote, WhyChoose, CtaSection, Footer
- **Live demo**: `LiveDemoButton` triggers demo seed → redirects to dashboard with pinned demo date
- **Beta messaging**: All "14-day free trial" references replaced with "Gratis i beta" / "Free during beta"
- Footer: Privatlivspolitik, Vilkår, Cookiepolitik, Kontakt + CVR info (Danish e-handelsloven §7)

### Legal Pages (`app/legal/`)
- Server layout (`layout.tsx`) loads Newsreader + JetBrains Mono fonts
- Client shell (`LegalShell.tsx`) provides nav, sub-nav pills, content card, footer — all matching landing page aesthetic
- 4 pages: Privacy (`/legal/privacy`), Terms (`/legal/terms`), DPA (`/legal/dpa`), Cookies (`/legal/cookies`)
- All inline-styled with landing page palette (Newsreader serif headings, JetBrains Mono dates, warm stone colors)
- Redirect: `/privacy` → `/legal/privacy`

### Mileage Tracking
- Integrated into time entry modal (collapsible section)
- Fields: km, start/end address, intermediate stops, round trip toggle
- Address autocomplete + distance calculation via OpenRouteService API
- Rate limited: 20 requests/minute per company

## Build Constraints & Gotchas

- **Case-sensitive file imports**: Vercel runs Linux (case-sensitive). Windows dev is case-insensitive. File names must match import casing exactly (e.g., `Sidebar.tsx` for `import from '@/components/layout/Sidebar'`). Use `git mv` to rename if needed.
- **Strict mode function declarations**: Next.js build rejects `function foo() {}` inside `if`/`else`/`for` blocks. Use `const foo = () => {}` arrow functions instead.
- **Map/Set iteration**: `for...of` on `Map` or `Set` objects fails in production builds (`--downlevelIteration` not enabled). Use `Record<string, T>` with `Object.values().forEach()` / `Object.keys().forEach()` for Maps. Use `Array.from(set).forEach()` for Sets.
- **Uint8Array as response body**: `new NextResponse(uint8Array)` fails type check. Wrap with `Buffer.from(uint8Array)`.
- **Prisma uses `db push`**: Schema changes use `npx prisma db push` (NOT migrations). No migration history.
- **Demo date convention**: Dashboard components must use `getToday()` from `lib/demo-date.ts` instead of `new Date()` for determining "today" / current week / current month. The pinned date is stored in the committed file `lib/demo-date-generated.json` (`{"date":"2026-02-12"}` for demo, `{"date":null}` for production). **Critical**: Never use `date-fns isToday()` — it always checks against the real system date. Import `isToday` from `@/lib/demo-date` instead. Components that highlight "today" (dashboard, resource planner cells, vacation calendar) all use this custom version. Applies to initial state, "Today" buttons, vacation accrual calculations, analytics date ranges, timeline anchors, and flex balance calculations.
- **Vacation counting (admin users)**: `/api/vacations` returns ALL company vacations for admin users. Dashboard must filter by the current user's ID (from `/api/user/me`) before counting used vacation days, otherwise admins see the sum of all employees' vacation days.

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
- `ACCOUNTING_ENCRYPTION_KEY` - Hex-encoded 32-byte key for AES-256-GCM encryption of accounting credentials
- `ECONOMIC_APP_SECRET_TOKEN` / `ECONOMIC_APP_PUBLIC_TOKEN` - e-conomic developer app credentials (for OAuth grant flow)
- `DINERO_CLIENT_ID` / `DINERO_CLIENT_SECRET` - Visma Connect OAuth2 credentials (for Dinero integration)
- `NEXT_PUBLIC_DEMO_DATE` - Local dev fallback for demo date pinning (e.g., `2026-02-12`). **Production/Vercel uses `lib/demo-date-generated.json` instead** (committed to git) because `NEXT_PUBLIC_*` env vars were unreliable with webpack DefinePlugin on Vercel.

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
- **Activity Gantt enhancements** — Drag-to-create (draw blocks across empty cells), row reordering via drag grip, right-click context menu, per-activity color picker
- Keyboard shortcuts (Cmd+S save, Cmd+Enter submit)
- Offline support / service worker
- Optimistic UI updates
- Custom report builder
- Slack/Teams integration
- Client portal
