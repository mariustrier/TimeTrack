# Cloud Timer QA Audit Report
Generated: 2026-03-14 (Updated with browser-based testing)

## Summary
- Pages tested: All 11 dashboard pages + all sub-tabs (code-level + browser-based)
- Total issues found: 78
- Critical bugs: 3 (from code audit)
- i18n issues: 24 (13 code-level + 11 browser-confirmed)
- Functional issues: 23 (22 code-level + 1 browser-confirmed)
- UI/UX improvements: 28 (23 code-level + 5 browser-confirmed)
- Build: PASS (zero errors)
- Tests: 236/236 passing (15 suites)

### Browser Testing Coverage
- Time entry CRUD: Create, Edit, Submit — all working
- i18n audit: All 11 pages checked in Danish mode
- Language persistence: Confirmed not persisting across URL navigations (known gap)
- Calendar picker, column settings, stat cards all verified
- Submitted entries correctly read-only

---

## Critical Bugs (app crashes, data loss, security)

### [BUG-001] Vacation API Leaks All Company Vacations to Employees
- **File**: `app/api/vacations/route.ts`, line 25
- **Severity**: Critical (data leak)
- **Description**: When an employee passes any `status` query parameter (e.g., `?status=pending`), the `userId` filter is skipped, exposing ALL company vacation requests to that employee. The condition `!status` is too broad — it should only bypass user filtering for `status=approved` (Team Calendar), not for `pending`, `rejected`, or `cancelled`.
- **Fix**: Change condition to `if (status !== "approved") { where.userId = user.id; }` for non-admin users.

### [BUG-002] Demo Create Endpoint Has No Rate Limiting
- **File**: `app/api/demo/create/route.ts`
- **Severity**: Critical (abuse vector)
- **Description**: This public endpoint (no auth required) creates a Clerk user, Prisma company, and seeds extensive demo data. No rate limiting — an attacker could exhaust Clerk quotas and fill the database.
- **Fix**: Add `checkRateLimit("demo-create", { windowMs: 60000, maxRequests: 3 })`.

### [BUG-003] Invoice Number Race Condition
- **File**: `app/api/invoices/route.ts`, lines 232-238
- **Severity**: Critical (data integrity)
- **Description**: Invoice number is obtained via `company.update({ nextInvoiceNumber: { increment: 1 } })` OUTSIDE the `$transaction` that creates the invoice. Concurrent requests could get the same number, or a failed transaction burns a number.
- **Fix**: Move the invoice number increment inside the `$transaction`.

---

## i18n Issues (raw translation keys / missing translations)

### A. Missing Translation Keys (11 keys — code audit)

| # | Key | Namespace | File | Line |
|---|-----|-----------|------|------|
| [i18n-001] | `unknown` | common | `app/(dashboard)/admin/company-expenses/page.tsx` | 109 |
| [i18n-002] | `apply` | common | `components/admin/PhaseMigrationDialog.tsx` | 176 |
| [i18n-003] | `tentative` | common | `components/resource-planner/AllocationBlock.tsx` | 88 |
| [i18n-004] | `confirmed` | common | `components/resource-planner/AllocationBlock.tsx` | 88 |
| [i18n-005] | `completed` | common | `components/resource-planner/AllocationBlock.tsx` | 88 |
| [i18n-006] | `outsideContract` | billing | `components/billing/UninvoicedTab.tsx` | 188 |
| [i18n-007] | `outsideContractDesc` | billing | `components/billing/UninvoicedTab.tsx` | 192 |
| [i18n-008] | `entries` | billing | `components/billing/UninvoicedTab.tsx` | 233 |
| [i18n-009] | `createSupplementaryInvoice` | billing | `components/billing/UninvoicedTab.tsx` | 249 |
| [i18n-010] | `cvr` | billing | `components/settings/BillingCompanyDetails.tsx` | 97 |
| [i18n-011] | `paymentDays` | billing | `components/settings/BillingCompanyDetails.tsx` | 109 |

### B. Browser-Confirmed i18n Issues (visible on screen in Danish mode)

| # | Page | Location | Issue |
|---|------|----------|-------|
| [B-i18n-01] | Dashboard | Time entry modal | "Close" button text is English — should be "Luk" |
| [B-i18n-02] | Dashboard | Calendar week picker | "Go to the Previous Month" / "Go to the Next Month" button labels are English (from react-day-picker) |
| [B-i18n-03] | Dashboard | Calendar week picker | "Today, lørdag den 14. marts 2026" — "Today" prefix is English mixed with Danish date |
| [B-i18n-04] | Admin > Resource Planner | Column header | "Today mar. 14" — "Today" is English, should be "I dag" |
| [B-i18n-05] | Admin > Resource Planner | Capacity label | "Low" displayed in English — should be "Lav" |
| [B-i18n-06] | Admin > Resource Planner | Employee row | "37t/wk" — "wk" is English abbreviation, should be "37t/uge" |
| [B-i18n-07] | Admin > Resource Planner | Period slider | "2 uge" — incorrect Danish grammar, should be "2 uger" (plural) |
| [B-i18n-08] | Admin > Audit Log | Status badges | "submitted", "approved", "draft" displayed as raw English — should be "indsendt", "godkendt", "kladde" |
| [B-i18n-09] | AI Assistent | Category filter | "All" button is English — should be "Alle" |
| [B-i18n-10] | Dashboard | Read-only entry warning | "Denne registrering er **submitted** og kan ikke redigeres." — "submitted" is English, should be "indsendt" |
| [B-i18n-11] | Global | Sidebar/footer | "Open user menu", "Switch to dark mode" aria-labels are English |

### C. Hardcoded Strings (should use translations — code audit)

| # | Issue | File | Line |
|---|-------|------|------|
| [i18n-012] | Hardcoded "per employee" text inline with translation | `components/admin/AdminOverview.tsx` | 2368 |
| [i18n-013] | Hardcoded "per employee" text inline with translation | `components/management/CompanyOverview.tsx` | 953 |

### D. Hardcoded English Toast Messages (31 instances across 12 files)
Not individually numbered — these are English-only error strings in `toast.error()` calls that won't display in Danish:

| File | Count | Examples |
|------|-------|---------|
| `components/admin/AdminOverview.tsx` | 7 | "Failed to save", "Failed to delete", "Export failed" |
| `app/(dashboard)/admin/company-expenses/page.tsx` | 5 | "Failed to save", "Failed to delete" |
| `components/management/UnifiedApprovals.tsx` | 3 | "Failed to approve" |
| `components/management/CompanyOverview.tsx` | 2 | "Failed to update project" |
| `components/billing/InvoicesTab.tsx` | 2 | "PDF download failed", "Sync failed" |
| `components/billing/InvoiceDetailDialog.tsx` | 2 | "PDF download failed", "Sync failed" |
| `components/billing/InvoiceCreateDialog.tsx` | 2 | "Preview failed", "Failed to create invoice" |
| `components/approvals/expense-approvals.tsx` | 2 | "Failed to approve", "Failed to reject" |
| `app/(dashboard)/settings/page.tsx` | 2 | "Export failed", "Failed to submit request" |
| `app/(dashboard)/super-admin/page.tsx` | 2 | "Backfill failed" |
| `components/team/TeamList.tsx` | 1 | "Failed to remove member" |
| `app/(dashboard)/dashboard/page.tsx` | 1 | "Failed to save time entry" |

---

## Functional Issues (features not working correctly)

### Browser-Confirmed Functional Results

| Test | Result | Notes |
|------|--------|-------|
| Time entry CREATE | PASS | Created 7.5h on Ai guide, Mon Mar 9 — appeared in grid, stats updated |
| Time entry EDIT | PASS | Changed 7.5→6h and updated comment — persisted correctly |
| Stat card updates | PASS | Total, Flex Balance, Billable all recalculated on create/edit |
| Day SUBMIT | PASS | Toast "Dag indsendt til godkendelse", banner appeared, submit button removed |
| Submitted entry read-only | PASS | All fields disabled, dialog title changed to "Vis tidsregistrering" |
| "Hel dag" button | PRESENT | Visible in modal but not explicitly tested |
| Phase selector | N/A | Phases not enabled for this company |
| Language toggle | WORKS per-page | Does not persist across URL navigations (known gap) |

### Code-Level Functional Issues

#### High Severity

| # | Issue | File | Line |
|---|-------|------|------|
| [FUNC-001] | Expense PUT route missing Zod input validation — accepts arbitrary fields | `app/api/expenses/[id]/route.ts` | 24 |
| [FUNC-002] | Resource allocation POST doesn't check `deletedAt: null` on target user — allows allocating to soft-deleted users | `app/api/resource-allocations/route.ts` | 102-105 |
| [FUNC-003] | Time entry POST (admin on-behalf) doesn't check `deletedAt: null` on target user | `app/api/time-entries/route.ts` | 185-191 |
| [FUNC-004] | Time entry submit (admin on-behalf) doesn't check `deletedAt: null` | `app/api/time-entries/submit/route.ts` | 34-39 |
| [FUNC-005] | Team member PUT doesn't check `deletedAt: null` — allows editing soft-deleted users | `app/api/team/[id]/route.ts` | 21-23 |
| [FUNC-006] | SVG upload allowed in logo route — stored XSS vector via embedded JavaScript | `app/api/upload/logo/route.ts` | 11 |
| [FUNC-007] | User delete-request route has no try/catch — unhandled errors leak internals | `app/api/user/delete-request/route.ts` | — |

#### Medium Severity

| # | Issue | File | Line |
|---|-------|------|------|
| [FUNC-008] | Approval routes accept arbitrary `userId` without company membership verification | `app/api/admin/approvals/approve/route.ts` | 21 |
| [FUNC-009] | Reopen route missing Zod validation — `reason` field has no length limit | `app/api/admin/approvals/reopen/route.ts` | 17 |
| [FUNC-010] | Flex balance calculation iterates day-by-day from user creation — O(n) per request, slow for long-tenured users | `app/api/time-entries/route.ts` | 115-122 |
| [FUNC-011] | Expense approval routes: no max array length on `expenseIds` — unbounded batch operations | `app/api/admin/expense-approvals/approve/route.ts` | 16 |
| [FUNC-012] | Admin approvals GET: unbounded query — no pagination or date range limit | `app/api/admin/approvals/route.ts` | 28 |
| [FUNC-013] | Contract upload route has no rate limiting (unlike receipt/logo uploads) | `app/api/contracts/upload/route.ts` | — |
| [FUNC-014] | User export route queries without explicit companyId scope (relies on userId only) | `app/api/user/export/route.ts` | 27-40 |
| [FUNC-015] | ProjectPhase PUT/DELETE missing company-scoped project ownership verification | `app/api/projects/[id]/project-phases/route.ts` | 181 |
| [FUNC-016] | Holiday fill cron creates entries for hourly users (should skip them) | `app/api/cron/fill-holiday-entries/route.ts` | 60 |

#### Low Severity

| # | Issue | File | Line |
|---|-------|------|------|
| [FUNC-017] | getDailyTarget rounding quirk — Friday target can exceed Mon-Thu for odd weekly hours | `lib/calculations.ts` | 36-38 |
| [FUNC-018] | Console.log debug statements left in submit route | `app/api/time-entries/submit/route.ts` | 17, 19, 61, 73-76 |
| [FUNC-019] | Vacation days: `differenceInBusinessDays + 1` may overcount by 1 day | `app/(dashboard)/dashboard/page.tsx` | 414 |
| [FUNC-020] | Contract upload uses raw filename in blob path (unsanitized) | `app/api/contracts/upload/route.ts` | 56 |
| [FUNC-021] | Expense auto-approve doesn't set `submittedAt` — null in reports/filters | `app/api/expenses/route.ts` | 100-101 |
| [FUNC-022] | Logo upload catch block leaks internal error messages to client | `app/api/upload/logo/route.ts` | 74-79 |

#### Browser-Found Functional Issue

| # | Issue | Page | Details |
|---|-------|------|---------|
| [FUNC-023] | Language preference does not persist across page navigations | Global | Switching to DA on one page resets to EN when navigating via URL. Language toggle works per-page but state is lost on route change. Known gap per CLAUDE.md but confirmed as user-facing issue. |

---

## UI/UX Improvements (visual inconsistencies, polish)

### Code-Level Issues

#### Consistency Issues

| # | Issue | Files |
|---|-------|-------|
| [UX-001] | 5 custom toggle switches with inconsistent sizing instead of shadcn `<Switch>` | `AdminOverview.tsx` (4×), `TeamList.tsx` (1×) |
| [UX-002] | 3 components use raw `<table>` with different styling vs shadcn `<Table>` | `AdminVacations.tsx`, `AdminAuditLog.tsx`, `time-entry-approvals.tsx` |
| [UX-003] | Empty state padding inconsistent: `py-12` vs `py-16` across components | `expense-approvals.tsx`, `AdminVacations.tsx`, `InvoicesTab.tsx`, `UnifiedApprovals.tsx` |
| [UX-004] | Icon-only buttons use `size="sm"` instead of `size="icon"` | `InvoicesTab.tsx` (4 buttons) |
| [UX-005] | ProjectsList mixes shadcn `<Button>` and raw `<button>` for action icons | `ProjectsList.tsx`, lines 580-635 |

#### Dark Mode Issues

| # | Issue | Files |
|---|-------|-------|
| [UX-006] | TilbudOverview: fully inline-styled with hardcoded light-mode hex colors — broken in dark mode | `components/tilbud/TilbudOverview.tsx` (20+ instances) |
| [UX-007] | BillingStatusOverview: hardcoded light colors (`#6b7280`, `#e5e7eb`, etc.) | `components/economic-sync/BillingStatusOverview.tsx` (15+ instances) |
| [UX-008] | ActivityBlock resize handles use `bg-white` without `dark:` variant | `components/project-timeline/ActivityBlock.tsx`, lines 85, 111 |
| [UX-009] | TimelineExportPopover: `background: "#fff"` hardcoded in 4 places | `components/projects/TimelineExportPopover.tsx` |
| [UX-010] | `border-gray-300` without `dark:border-*` on checkboxes | `expense-approvals.tsx`, `AdminOverview.tsx` |

#### Accessibility Issues

| # | Issue | Files |
|---|-------|-------|
| [UX-011] | ~30 icon-only buttons missing `aria-label` across entire app | `AdminOverview.tsx`, `InvoicesTab.tsx`, `TeamList.tsx`, `ProjectsList.tsx`, `PlannerControls.tsx`, `TimelineEditFooter.tsx`, etc. |
| [UX-012] | AdminOverview custom toggles lack `role="switch"` and `aria-checked` | `AdminOverview.tsx` (4 instances) |
| [UX-013] | Clickable div without keyboard support (expandable submission rows) | `time-entry-approvals.tsx`, line 313 |
| [UX-014] | Native checkboxes without labels or aria-labels | `expense-approvals.tsx`, lines 283-291, 315-320 |
| [UX-015] | Receipt link has no accessible text — Paperclip icon only | `expense-approvals.tsx`, lines 350-359 |

#### Overflow Issues

| # | Issue | Files |
|---|-------|-------|
| [UX-016] | 5 tables missing `overflow-x-auto` wrapper — will break on mobile | `TeamList.tsx`, `expense-approvals.tsx`, `ProjectsList.tsx`, `BillingSettings.tsx` (5 tables) |
| [UX-017] | Fixed 4-column and 3-column grids with no responsive breakpoints | `BillingStatusOverview.tsx`, `TilbudOverview.tsx` |

#### Interactive Element Issues

| # | Issue | Files |
|---|-------|-------|
| [UX-018] | Invoice table rows show `cursor-pointer` but row body is not clickable | `InvoicesTab.tsx`, line 185 |
| [UX-019] | Invoice action buttons (delete, download, sync) lack loading/disabled state during API calls | `InvoicesTab.tsx`, lines 87-131 |
| [UX-020] | Phase reorder buttons fire API calls without loading/disabled state | `AdminOverview.tsx`, lines 1462-1498 |
| [UX-021] | Invalid Tailwind class `hover:bg-muted/50/50` — double `/50` produces no hover effect | `AdminVacations.tsx`, line 180 |
| [UX-022] | Color picker buttons missing focus-visible indicators for keyboard navigation | `ProjectsList.tsx`, lines 676-683 |
| [UX-023] | Column toggle/reorder buttons missing `cursor-pointer` class | `ProjectsList.tsx`, lines 450-471 |

### Browser-Confirmed UI/UX Issues

| # | Page | Issue |
|---|------|-------|
| [B-UX-01] | Dashboard > Time entry modal | Radix dialog missing `Description` or `aria-describedby` — console warning on every open |
| [B-UX-02] | Dashboard > Calendar picker | react-day-picker navigation buttons not localized (aria-labels in English) |
| [B-UX-03] | Admin > Resource Planner | Saturday column for "today" (Mar 14) not visually highlighted differently from weekdays |
| [B-UX-04] | Dashboard | Flex balance -208.5h is extremely negative — no visual explanation for new users about what this means |
| [B-UX-05] | Admin > Approvals | Empty state "Alt er opdateret!" with icon is well done — consistent with design |

---

## Build & Test Status

- **Build**: PASS — `npm run build` completes with zero errors, zero type errors
- **Tests**: 236/236 passing — `npm run test` all green (15 test suites, Vitest v4.0.18)
- **Console warnings** (browser):
  - Clerk dev mode warnings (expected in development)
  - Radix UI dialog missing `Description` or `aria-describedby` (2 warnings per modal open)
  - No runtime errors during normal operation

---

## Recommendations (prioritized)

### High Priority (fix before next deploy)
1. **[BUG-001]** Fix vacation API data leak — single-line condition change
2. **[BUG-002]** Add rate limiting to demo create endpoint
3. **[BUG-003]** Move invoice number increment inside `$transaction`
4. **[FUNC-006]** Remove `image/svg+xml` from allowed logo upload types (XSS risk)
5. **[FUNC-002-005]** Add `deletedAt: null` to all 4 user lookups that are missing it
6. **[i18n-001 to i18n-011]** Add 11 missing translation keys to both en.json and da.json

### Medium Priority (fix in next sprint)
7. **[B-i18n-08]** Translate audit log status badges ("submitted"→"indsendt", "approved"→"godkendt", "draft"→"kladde")
8. **[B-i18n-04-07]** Fix Resource Planner i18n: "Today"→"I dag", "Low"→"Lav", "wk"→"uge", "2 uge"→"2 uger"
9. **[B-i18n-10]** Translate "submitted" in read-only entry warning
10. **[FUNC-001]** Add Zod validation to expense PUT route
11. **[FUNC-009]** Add Zod validation to reopen route
12. **[UX-011]** Add aria-labels to all ~30 icon-only buttons
13. **[UX-016]** Add `overflow-x-auto` wrappers to 5 tables
14. **[UX-021]** Fix invalid Tailwind class in AdminVacations
15. **[UX-006-007]** Fix dark mode colors in TilbudOverview and BillingStatusOverview
16. Translate 31 hardcoded English toast error messages
17. **[B-UX-01]** Add `aria-describedby` to Radix dialog in time entry modal

### Low Priority (polish / technical debt)
18. **[B-i18n-01-03]** Fix calendar picker and modal close button i18n (react-day-picker localization)
19. **[B-i18n-09]** Change AI Assistent "All" filter to "Alle"
20. **[B-i18n-11]** Translate global aria-labels ("Open user menu", "Switch to dark mode")
21. **[UX-001]** Replace 5 custom toggle switches with shadcn `<Switch>`
22. **[UX-002]** Standardize 3 raw tables to shadcn `<Table>`
23. **[FUNC-010]** Optimize flex balance day-iteration with caching
24. **[FUNC-018]** Remove console.log debug statements from submit route
25. **[UX-019-020]** Add loading states to invoice and phase reorder actions
26. **[UX-012]** Add proper ARIA attributes to custom toggles
27. **[FUNC-023]** Implement language preference persistence (localStorage or user preferences API)

---

## Testing Methodology
- **Code audit**: Static analysis of all 124 API routes, 30+ components, translation files, and shared libraries
- **Browser testing**: Playwright MCP used for all browser interactions — visited all 11 pages, tested CRUD operations, verified translations in Danish mode, checked interactive elements
- **Build verification**: Full `npm run build` (zero errors) and `npm run test` (236/236 passing)
- **Environment**: Windows 11, Next.js dev server on localhost:3000, logged in as super admin (Marius Trier Krogh)
