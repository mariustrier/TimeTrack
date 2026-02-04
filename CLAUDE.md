# Cloud Timer (cloudtimer.dk)

SaaS time-tracking application for companies. Deployed on Vercel with auto-deploy from master.

## Tech Stack

- Next.js 14.2 (App Router) with TypeScript
- Prisma ORM with PostgreSQL (Neon)
- Clerk authentication (role-based: admin/manager/employee)
- Multi-tenant architecture (companyId scoping on all queries)
- Tailwind CSS, Lucide icons, Sonner toasts
- All dashboard pages are "use client" components
- Translations via `lib/i18n` (useTranslations hook)

## Key Commands

- `npm run dev` - Start development server
- `npm run build` - Production build
- `npm run test` - Run all 99 unit tests (Vitest)
- `npm run test:watch` - Run tests in watch mode

## Project Structure

- `app/(dashboard)/` - Dashboard pages (admin, analytics, projects, team, expenses, vacations, settings)
- `app/api/` - 60 API routes, all scoped by companyId
- `lib/` - Shared utilities (calculations, currency, week-helpers, expense-utils, analytics-utils)
- `lib/schemas.ts` - All Zod validation schemas
- `lib/validate.ts` - Zod validation helper for API routes
- `lib/rate-limit.ts` - In-memory rate limiter
- `lib/api-error.ts` - Standardized API error helper with Sentry integration
- `components/` - Reusable UI components
- `__tests__/lib/` - Unit tests for lib utilities
- `prisma/schema.prisma` - Database schema

## Error Monitoring

Sentry is configured (client/server/edge). DSN is set via `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` env vars in Vercel. Error boundaries exist at root, app, and dashboard levels.

## Validation & Rate Limiting

- Zod validation on all 12 mutation API routes via `validate()` helper
- Rate limiting on 6 expensive routes (AI, exports, uploads) via `checkRateLimit()`

## Recent Updates (Feb 2026)

### Daily Time Entry Submission
- Submit button under each day column in timesheet (not just whole week)
- Submitting one day keeps other days editable
- "Submit Week" button still available for bulk submission
- Weekends show submit button only if they have entries
- Admin notifications only trigger when Friday (or weekend) is submitted
- New API endpoints: `POST /api/time-entries/submit` accepts `date` param for single day

### Admin Approvals Enhancements
- Separate badge counts for Time Entries and Expenses tabs
- Per-day approve/reject buttons within expanded week view
- New API endpoints: `/api/admin/approvals/approve-day`, `/api/admin/approvals/reject-day`

### Expenses Auto-Submit
- Expenses automatically submitted on creation (no manual submit step)
- Users can edit/delete their expenses until approved by admin
- Removed "Submit Expenses" button from UI

### Mileage Tracking
- Mileage registration integrated into time entry modal (collapsible section)
- Fields: kilometers driven, start address, end address, intermediate stops, round trip toggle
- Address autocomplete via OpenRouteService geocoding API
- Automatic distance calculation via OpenRouteService directions API
- Supports multi-stop routes (start → stops → end)
- Round trip option doubles the calculated distance
- Rate limited: 20 requests/minute per company
- New API endpoints:
  - `POST /api/mileage/calculate` - Calculate distance between addresses
  - `GET /api/mileage/autocomplete` - Address suggestions
- Database fields on TimeEntry: `mileageKm`, `mileageStartAddress`, `mileageEndAddress`, `mileageStops`, `mileageRoundTrip`, `mileageSource`
- Environment variable: `OPENROUTESERVICE_API_KEY`

## Development Roadmap

### Phase 1: Foundation & Quality - COMPLETE
- [x] Vitest testing infrastructure (99 tests across 6 suites)
- [x] Sentry error monitoring with error boundaries
- [x] Zod input validation on 12 API routes
- [x] Rate limiting on 6 routes
- [x] Prisma query optimizations (Promise.all consolidation, groupBy, select clauses)
- [x] Settings loading skeleton

### Phase 2: User Experience
- [ ] Keyboard shortcuts (Cmd+S save, Cmd+Enter submit, Esc cancel)
- [ ] Offline support with service worker
- [ ] Optimistic UI updates
- [ ] Bulk actions (multi-select time entries)
- [ ] Improved mobile responsiveness

### Phase 3: Features
- [ ] Recurring time entries / templates
- [ ] Timer mode (start/stop tracking)
- [ ] Team calendar view
- [ ] Slack/Teams integration for reminders
- [ ] Client portal (read-only project view)

### Phase 4: Analytics & Reporting
- [ ] Custom report builder
- [ ] Scheduled email reports
- [ ] Budget forecasting with trend lines
- [ ] Employee utilization heatmaps
- [ ] Export to accounting software (e-conomic, Dinero)

### Phase 5: Scale & Polish
- [ ] Multi-language support (Danish, English)
- [ ] Audit log UI for admins
- [ ] API rate limiting dashboard
- [ ] Performance monitoring dashboard
- [ ] SOC 2 compliance documentation
