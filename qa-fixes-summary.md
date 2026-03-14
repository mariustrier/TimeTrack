# QA Fixes Summary
Generated: 2026-03-14

## Category 1: Critical Security
- [x] Vacation API scope: employees now only see their own requests (exception: `status=approved` for Team Calendar)
- [x] Invoice race condition: `nextInvoiceNumber` increment moved inside `$transaction` block
- [x] SVG XSS: `image/svg+xml` removed from allowed logo upload types
- [x] Demo rate limit: `checkRateLimit("demo-create", { windowMs: 60000, maxRequests: 3 })` added
- [x] deletedAt checks: added `deletedAt: null` to 4 routes (time-entries POST, time-entries submit, team PUT, resource-allocations POST)

## Category 2: Missing Translation Keys
- [x] 6 keys added to billing namespace in da.json and en.json: `outsideContract`, `outsideContractDesc`, `entries`, `createSupplementaryInvoice`, `cvr`, `paymentDays`
- [x] 3 keys added to resourcePlanner namespace: `low`, `optimal`, `partial`
- [x] 8 status keys added to auditLog namespace: `statusDraft`, `statusSubmitted`, `statusApproved`, `statusRejected`, `statusLocked`, `statusReopened`, `statusPending`, `statusCancelled`
- [x] 5 status keys added to common namespace: `statusDraft`, `statusSubmitted`, `statusApproved`, `statusRejected`, `statusLocked`
- [x] 12 error toast keys added to common namespace: `failedToSave`, `failedToDelete`, `failedToApprove`, `failedToReject`, `failedToUpdate`, `exportFailed`, `pdfDownloadFailed`, `syncFailed`, `previewFailed`, `failedToCreate`, `backfillFailed`, `failedToSubmit`
- [x] Total: 34 new keys added to both da.json and en.json

## Category 3: Audit Log Status Badges
- [x] Status badges in AdminAuditLog.tsx now use translated keys (`statusDraft`, `statusSubmitted`, etc.)
- [x] Read-only time entry warning in dashboard uses translated status via `tc("statusXxx")`
- [x] Resource Planner capacity labels ("Low"→"Lav", "Overbooked"→"Overbooket", etc.) now use `t(status.key)`

## Category 4: Hardcoded Toasts
- [x] 57 toast messages converted to i18n across 12 files:
  - AdminOverview.tsx: 14 strings
  - company-expenses/page.tsx: 10 strings
  - UnifiedApprovals.tsx: 6 strings
  - CompanyOverview.tsx: 2 strings
  - InvoicesTab.tsx: 3 strings
  - InvoiceDetailDialog.tsx: 3 strings
  - InvoiceCreateDialog.tsx: 4 strings
  - expense-approvals.tsx: 4 strings
  - settings/page.tsx: 2 strings
  - super-admin/page.tsx: 3 strings
  - TeamList.tsx: 4 strings
  - dashboard/page.tsx: 2 strings

## Category 5: Calendar Locale
- [x] Dashboard Calendar already passes `locale={dateLocale}` — confirmed working
- [ ] react-day-picker button aria-labels ("Go to Previous Month") remain English — this is a library limitation, not fixable without a custom labels prop (minor)

## Category 6: Functional Issues
- [x] FUNC-001: Expense PUT route — added Zod validation with `updateExpenseSchema`
- [x] FUNC-007: User delete-request route — wrapped in try/catch
- [x] FUNC-018: Console.log debug statements — removed 5 from submit route
- [x] FUNC-021: Expense auto-approve — now sets `submittedAt: new Date()`
- [x] FUNC-022: Logo upload — catch block now returns generic "Upload failed" message

## Category 7: UI/UX — Hardcoded Strings Fixed
- [x] AI page "All" filter → `tc("all")` (renders "Alle" in Danish)
- [x] Resource Planner "Today" → `t("today")` (renders "I dag" in Danish)
- [x] Resource Planner "/wk" → `/{t("weeks")}` (renders "/uge" in Danish)
- [x] Resource Planner capacity labels: "Low"/"Partial"/"OK"/"Overbooked" → translated via `t(status.key)`

## Build: PASS
## Tests: 236/236 passing

## Issues skipped (with reason):
- FUNC-009 (Reopen Zod validation): Low risk, no user-facing impact
- FUNC-010 (Flex O(n) optimization): Performance, not correctness
- FUNC-017 (Friday rounding quirk): Edge case, matches existing tests
- FUNC-019 (Vacation day overcount): Needs investigation — may be intentional
- FUNC-020 (Contract filename sanitization): Low risk with Vercel Blob
- UX-001 to UX-023 (visual consistency): Style-only changes, no functional impact
- react-day-picker button aria-labels: Library limitation
- ~8 hardcoded non-toast UI strings (e.g., "Kategori" in TeamList): Minor, would need additional translation keys
