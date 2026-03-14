# Cloud Timer — UX Audit Report
Date: 2026-03-14 19:28 CET

## Executive Summary

Cloud Timer is a well-structured, feature-rich time tracking and billing platform built for Danish architecture firms. The visual design is clean and professional with a consistent purple brand color, well-designed stat cards, and a polished weekly timesheet grid. The strongest aspects are the dashboard's information density (stat cards + timesheet in one view), the excellent mobile bottom navigation pattern, and the comprehensive Analytics section with real business intelligence (Revenue Bridge, EBITDA, Client Concentration). The biggest weaknesses are: **several pages showing only loading skeletons when API fails** (no graceful degradation), and **mixed Danish/English text** throughout the UI creating a disjointed experience. The timeline toolbar is crowded on smaller screens. *(Note: the minimal mobile nav is intentional by design. The Expenses page title is rendered by `<PageHeader>` but was hidden behind loading skeletons during the audit — not actually missing.)*

## Scores (1-10)
- Visual consistency: 7/10
- Navigation clarity: 7/10
- Task efficiency: 8/10
- Error handling: 4/10
- Empty state handling: 6/10
- Loading state handling: 5/10
- Mobile readiness: 7/10
- Dark mode: 7/10
- Overall polish: 7/10

---

## Part 1: First Impressions

### /dashboard
- **Visual hierarchy**: Eyes go to the stat cards first (Target 37h, Total 6.0h), then the weekly timesheet grid below. Clear two-section layout.
- **Purpose**: Immediately clear — this is where you log and review your weekly time.
- **Feel**: Clean and functional. The 7 stat cards feel slightly excessive in one row on desktop — "Vacation" and "Vacation Days" could be merged. The "Show less" toggle is a nice touch.
- **Consistency**: Strong brand identity with purple accents, clean white cards.

### /management (Approvals tab)
- **Visual hierarchy**: Page title + tabs are clear. Content area shows loading skeletons.
- **Purpose**: Tabs (Approvals, Team, Resource Planner, Setup) make purpose clear.
- **Feel**: Clean header. The Approvals tab shows persistent skeleton loading when API is unavailable — no empty state or error message.

### /management (Team tab)
- **Visual hierarchy**: "Invite Member" CTA button is prominent (purple). Team table is clear.
- **Purpose**: Obvious — manage team members with roles, rates, and targets.
- **Feel**: Well-structured table. DKK currency dropdown feels misplaced above the table — could be in Setup instead.

### /management (Resource Planner)
- **Visual hierarchy**: Only loading skeletons visible when data is unavailable.
- **Issue**: No empty state — just gray blocks. User can't tell what this page does without data.

### /management (Setup)
- **Visual hierarchy**: Accordion pattern with 8 sections. Company Settings expanded by default.
- **Purpose**: Clear admin configuration area.
- **Feel**: Well-organized. Good use of expandable sections to avoid overwhelming the user.

### /projects (Projects tab)
- **Visual hierarchy**: Loading skeletons only. No page description or empty state.
- **Issue**: Without data, it's impossible to know what this page looks like.

### /projects (Timeline)
- **Visual hierarchy**: Project list on left, Gantt chart on right. "Today" column highlighted in orange/yellow.
- **Purpose**: Excellent — immediately clear this is a project timeline/Gantt view.
- **Feel**: Professional. The toolbar (Day/Week/Month/Year, Filter, Export, Focus, Edit Timeline) is comprehensive but slightly crowded. Project progress bars (26%, 138%, 40%, 100%) with color coding are very effective.

### /analytics
- **Visual hierarchy**: Tab bar (Employee/Team/Project/Company) + KPI cards + charts below.
- **Purpose**: Clear analytics dashboard. The "Approved only / All entries" toggle is a smart filter.
- **Feel**: Information-dense but organized. The 5 KPI cards (Revenue Forecast, EBITDA, Avg Effective Rate, Unbilled Revenue, Leave Liability) show real business intelligence. "Unbilled Revenue" card has a yellow highlight — effective visual prioritization.

### /ai
- **Visual hierarchy**: Only loading skeletons visible. No title, no description.
- **Issue**: Worst first impression of all pages. No indication of what "AI Assistant" does.

### /billing
- **Visual hierarchy**: Title + tabs (Uninvoiced/Invoices) + informational banner about Danish invoicing law.
- **Purpose**: The legal disclaimer banner is informative and well-placed.
- **Feel**: Clean. Loading skeletons below the banner.

### /expenses
- **Visual hierarchy**: Loading skeletons initially. Title is rendered by `<PageHeader>` but was hidden during the audit while data loaded.
- *(False positive — page title exists but was obscured by loading state during audit.)*

### /settings
- **Visual hierarchy**: Clean vertical stack of card sections (Profile, Language, Notifications, Replay Tour, Export Data, Account Deletion).
- **Purpose**: Very clear user settings page.
- **Feel**: Well-organized. Each section has an icon, heading, description, and action. The notification toggles are clean. GDPR-compliant features (Export Data, Account Deletion) are a nice touch.

### /super-admin (Platform)
- **Visual hierarchy**: Platform Admin header + 4 stat cards + Companies table + AI Cost Breakdown.
- **Purpose**: Clear super-admin dashboard for managing multiple tenants.
- **Feel**: Professional. Good data density without feeling cluttered.

---

## Part 2: Navigation & Information Architecture

### Sidebar Navigation
- [x] **Order**: Dashboard → Management → Projects → Analytics → AI Assistant → Billing → Expenses → Settings → Platform. Logical grouping — daily use (Dashboard) first, admin (Platform) last.
- [x] **Icons**: All sidebar items have distinct icons that make sense. Dashboard (grid), Management (chart), Projects (calendar), Analytics (chart line), etc.
- [ ] **Too many items?**: 9 items is borderline. Consider merging "Expenses" into "Billing" since they're related. "Platform" should only show for super-admins.
- [x] **Active state**: Clear — active item has a blue/purple highlight with a left border accent. Very visible.
- [ ] **Badge counts**: Not visible in current state — cannot verify if they update.
- [x] **Width**: Appropriate at ~240px. Collapses to icon-only on tablet.

### Tab Navigation
- [x] **Consistent styling**: Tabs use the same pill/button pattern across Management, Projects, Analytics, and Billing.
- [x] **Active tab visible**: Active tab has a distinct blue/purple text color with a subtle background.
- [ ] **State persistence**: Tabs do NOT remember state when navigating away and back — always resets to first tab.
- [ ] **Too many tabs**: Management has 4 tabs (Approvals, Team, Resource Planner, Setup) — acceptable but Setup is really a sub-area.

---

## Part 3: User Flows

### Flow 1: Log 7.5 hours on a project for today
- **Steps**: Dashboard → click "+" on project row for today's column → modal opens pre-filled with project + date → enter hours → add comment → click "Log Time"
- **Click count**: 3 clicks + 2 field entries (hours + comment) = efficient
- **Findings**:
  - Project dropdown is pre-filled — excellent, one less step.
  - Date is pre-filled to the clicked day — excellent.
  - "Full day" button next to hours field is a great shortcut.
  - "Fakturering & Klassificering" section uses Danish while rest of modal is in English — language inconsistency.
  - "Log Time" button is disabled until hours are entered — good validation feedback.
  - Mileage tracking is a nice collapsible extra.

### Flow 2: Submit a full week of time entries
- Each day has a "Submit" row at the bottom of the timesheet — currently showing "—" dashes.
- **Observation**: Submission appears to be per-week ("Submitted for approval. Waiting for admin review." banner visible), which is the right approach.
- **Feedback**: The yellow "Submitted for approval" banner is clear and well-placed.

### Flow 3: Create a new project
- Could not test — Projects list page shows only loading skeletons without backend connection.

### Flow 4: Approve pending time entries
- Could not fully test — Approvals tab shows loading skeletons.
- **Navigation**: Management → Approvals tab = 2 clicks to reach.

### Flow 5: Create a vacation request
- **Issue**: No "Vacations" page in the sidebar! The audit prompt references `/vacations` but this route doesn't exist. Vacation data shows on the Dashboard stat cards (6.0d used, 20.2 remaining) but there's no dedicated vacation request flow visible.
- **Missing feature** or it may be hidden under a different location.

### Flow 6: Check project profitability
- Analytics → Project tab → "Red List" section immediately shows flagged projects (>85% budget or <20% margin).
- **Click count**: 2 clicks (Analytics → Project tab).
- **Excellent**: "Ai guide" project shows 95% budget used, 72.2% margin, "On track" status. Color-coded progress bar (red = danger). Very clear at a glance.

### Flow 7: Create an invoice
- Billing → Uninvoiced tab is the starting point.
- Could not test the full wizard due to loading skeletons.
- **Good**: The legal disclaimer about Danish accounting law is helpful onboarding context.

### Flow 8: Check team utilization
- Analytics → Team tab shows KPI cards + Revenue Bridge chart.
- **Issue**: The "Team" tab shows company-level financial metrics, not per-person utilization. No clear "who is overloaded vs. has capacity" view on this tab.
- **Better**: Resource Planner (Management → Resource Planner) would show this, but it only shows loading skeletons.

---

## Part 4: Consistency Audit

### Headers
- Most pages follow: `<h1> Page Title` + tab bar pattern (Management, Projects, Analytics, Billing).
- ~~Expenses page has no visible title~~ *(false positive — `<PageHeader>` renders the title; it was hidden behind loading skeletons during audit)*
- **Inconsistency**: Dashboard says "Timesheet" instead of "Dashboard" — the sidebar says "Dashboard" but the page title says "Timesheet". This is confusing.
- Settings uses `<h1> Settings` with no tabs — consistent single-page approach.
- Platform uses a different header style (icon + title + subtitle) — acceptable for super-admin.

### Cards
- Dashboard stat cards: Consistent border-radius, padding, and icon placement (icon in top-right).
- Analytics KPI cards: Similar style but with uppercase labels and "i" info icons — slightly different from Dashboard cards.
- Platform stat cards: Different style again — colored icon circles on left side, not top-right.
- **Verdict**: 3 different card styles across 3 pages. Should be unified.

### Tables
- Team table: Standard header row, clean row layout with avatar + name.
- Platform table: Same header style, consistent row height.
- Timesheet grid: Specialized table with clickable cells — different from standard tables but appropriately so.
- **Verdict**: Tables are reasonably consistent.

### Modals
- Time entry modal: Clean layout — title, close button (X), form fields, Cancel + primary CTA.
- **Good**: Cancel is left, primary action (Log Time) is right — correct pattern.
- **Good**: Close X button in top-right corner.
- **Issue**: Radix Dialog warning about missing aria-description (console).

### Buttons
- Primary buttons: Purple/indigo throughout (Invite Member, Save, Log Time) — consistent.
- "Full day" button in modal: Outlined/secondary style — appropriate.
- "Fakturerbar/Udenfor kontrakt/Ikke fakturerbar": Green active, outlined inactive — clear toggle pattern.
- Delete/destructive: Red trash icon buttons in Team table — correct pattern.
- **Verdict**: Button consistency is good.

### Empty States
- Dashboard (no projects): Clock icon + "Ingen projekter endnu" + descriptive text — good.
- Other pages: Most show loading skeletons indefinitely when API fails — **no fallback to empty state**.
- **Issue**: Loading skeletons should timeout and show an error state or empty state.

### Form Inputs
- Text inputs: Consistent border, height, and focus ring (blue outline on focus).
- Dropdowns: Consistent chevron indicator.
- Date picker: Native browser date picker.
- Number input: Standard with placeholder "e.g. 8".
- **Verdict**: Form inputs are consistent.

---

## Part 5: Micro-Interactions & Polish

### Hover states
- [x] Buttons change on hover (opacity/color shift)
- [x] Sidebar items highlight on hover (background color change)
- [x] Timesheet "+" cells are clickable with hover cursor
- [ ] Table rows in Team/Platform don't have obvious hover highlight

### Loading states
- [x] Dashboard shows skeleton placeholders while loading
- [x] Management pages show skeleton loaders
- [ ] Skeletons persist indefinitely when API fails — no timeout or error state
- [ ] Save buttons don't show loading spinner during API calls (could not verify)

### Feedback
- [x] "Submitted for approval. Waiting for admin review." banner — clear status feedback
- [ ] Could not test toast notifications (API unavailable)
- [ ] Could not test delete confirmations

### Animations
- [x] Modal animates in smoothly (Radix Dialog)
- [x] Sidebar active state transitions smoothly
- [ ] Could not test toast animations
- [ ] "Show less" toggle on stat cards is instant (no animation)

### Keyboard Navigation
- [x] Escape closes modals — confirmed working
- [x] Form fields in modal are tabbable
- [ ] Could not verify Enter to submit (Log Time button was disabled)
- [x] Sidebar links are keyboard-navigable (standard links)
- [ ] Timesheet grid "+" buttons don't have visible focus indicators

---

## Part 6: Data Density & Readability

### Dashboard
- [x] Timesheet grid is readable with 4 projects — would need horizontal scroll or grouping at 10+.
- [ ] 7 stat cards in one row is too many. "Vacation" + "Vacation Days" should be merged. Consider showing 4-5 by default.
- [x] Budget column with colored progress bars (24h left, 12h left, 2h left) is very useful.
- [x] Flex balance row is helpful — shows running daily flex balance.
- [x] Daily Total row provides quick validation that hours add up.

### Analytics
- The Company tab has a good density — Revenue Bridge chart, Client Concentration pie, Invoice Pipeline, Expense Breakdown, Non-Billable Trend, Unbilled Work — all in one scrollable view.
- [x] KPI row is above the fold on 1440px screens.
- [x] Charts have titles, legends, and info icons.
- [ ] Break-even line on Revenue Bridge chart is a great feature but the dashed red line label ("Break-even 14k kr.") bleeds off the right edge.

### Resource Planner
- Could not evaluate — shows only loading skeletons.

### Timeline
- [x] Readable with 4 projects. The left panel (project list) is well-sized.
- [x] Project bars are distinguishable by color (purple, green, pink).
- [x] "Today" column is highlighted in orange/yellow — very visible.
- [ ] Toolbar is crowded: Overview badge, nav arrows, Today, date range, Day/Week/Month/Year, Filter, Export, Focus, Edit Timeline — 11 controls in one row.
- [ ] "Eksportér" button is in Danish while other buttons are in English.

---

## Part 7: Mobile & Narrow Viewport (375px)

- [x] Sidebar collapses to bottom navigation bar — excellent pattern.
- [x] Bottom nav shows 5 items: Dashboard, Management, Expenses, Projects, Menu.
- [ ] **Critical**: Menu drawer only shows Dashboard, Management, Expenses, Projects, Settings. **Missing: Analytics, AI Assistant, Billing, Platform**. Users cannot access these pages on mobile at all.
- [x] Dashboard timesheet shows stat cards in 2-column grid — readable.
- [x] Buttons are large enough to tap (the "+" cells in timesheet grid are good size).
- [x] Text is readable without zooming.
- [x] Timeline scrolls horizontally with a scrollbar — functional.
- [ ] Timeline toolbar wraps but some buttons may be cut off on very narrow screens.
- [ ] "View as..." button appears on mobile dashboard — nice addition.

### Tablet (768px)
- [x] Sidebar shows icon-only mode — all 9 nav items visible.
- [x] Dashboard shows full timesheet grid with day columns.
- [x] Stat cards in 2-column layout.
- [x] Overall tablet experience is strong.

---

## Part 8: Dark Mode

- [x] Toggle button in sidebar footer switches correctly (moon/sun icon).
- [x] Sidebar background switches to dark — text and icons remain readable.
- [x] Analytics page: KPI cards, chart backgrounds, and text adapt correctly.
- [x] Tab buttons have appropriate contrast in dark mode.
- [ ] "Unbilled Revenue" card keeps its yellow/cream highlight — slightly jarring in dark mode, but acceptable as an alert color.
- [ ] Loading skeletons in dark mode show as dark gray blocks on dark background — very low contrast, hard to tell something is loading.
- [ ] Could not test charts in dark mode fully (Revenue Bridge chart background was empty in Team tab).
- [x] Modal backgrounds should be dark (could not verify — API unavailable for full modal test).

---

## Part 9: Product Suggestions

### Remove
1. **"Vacation" and "Vacation Days" stat cards** — merge into one card showing "6.0d used / 20.2 remaining".
2. **"Platform" in sidebar for non-super-admins** — should only show for platform administrators.
3. **"View as..." button** — unclear what it does, seems redundant with the weekly timesheet being the default.
4. **Separate "Settings" and "Setup" (under Management)** — these overlap. Company settings should be in one place.

### Biggest Friction
1. **No vacation request flow visible** — users see vacation days on Dashboard but have no way to request time off.
2. ~~Missing mobile navigation~~ *(intentional by design — minimal mobile nav is a deliberate choice)*
3. **Language mixing** — "Fakturerbar", "Eksportér", "Ugentlig timeseddel" mixed with English labels creates confusion. Pick one language or ensure full i18n coverage.
4. **Infinite loading skeletons** — when API fails, pages show loading animations forever with no error message or retry button.

### Missing
1. **Quick-fill shortcuts** — ability to copy last week's entries, or "Fill 7.5h for Mon-Fri" button.
2. **Vacation/Leave request page** — referenced in audit prompt but doesn't exist.
3. **Notification bell/badge** — no visible notification indicator in the UI.
4. **Search** — no global search to find projects, team members, or entries.
5. **Breadcrumbs** — when deep in Setup or Analytics tabs, no way to see your location hierarchy.

### Wow Factor
- The **Analytics Company view** with Revenue Bridge + Break-even line is genuinely impressive — this is CFO-level business intelligence in a time tracking tool.
- The **Red List** on the Project analytics tab (flagged projects >85% budget) is an excellent risk management feature.
- The **timeline/Gantt view** with drag handles and focus mode is a premium feature.
- **Onboarding**: Settings has "Replay Guided Tour" — good for discovery, but the tour itself couldn't be tested.

### Quick Wins (top 5)
1. ~~Add Analytics + Billing to mobile menu~~ *(intentional — minimal mobile nav is by design)*
2. **Merge Vacation + Vacation Days cards** into one — 15 min, cleaner dashboard.
3. **Add error state for failed API calls** — replace infinite skeleton with "Failed to load. Retry?" message — 1 hour.
4. ~~Fix "Expenses" page missing title~~ *(false positive — title exists via `<PageHeader>`, hidden behind loading skeletons during audit)*
5. **Fix mixed language strings** — "Eksportér" → "Export", "Fakturerbar" → "Billable" when language is English — 30 min.

---

## Prioritized Recommendations

### High Impact + Low Effort
1. ~~Add Analytics, AI Assistant, Billing to mobile navigation menu~~ *(intentional)*
2. ~~Add page title to Expenses page~~ *(false positive)*
3. Merge Vacation + Vacation Days stat cards
4. Fix mixed Danish/English strings (Eksportér, Faktureringstype, etc.)
5. Rename Dashboard page heading from "Timesheet" to "Dashboard" (or add "Dashboard" as the page-level heading above "Timesheet")
6. Add error/empty states when API calls fail (replace infinite skeletons)

### High Impact + Medium Effort
1. Add a vacation/leave request page (or integrate into Dashboard)
2. Add global search (projects, people, entries)
3. Add "Copy last week" quick-fill for timesheet
4. Unify card styles across Dashboard, Analytics, and Platform
5. Add loading timeout + retry button for all data-fetching components
6. Add keyboard shortcuts for common actions (N = new entry, S = submit week)

### High Impact + High Effort
1. Full i18n audit — ensure all strings are translated consistently in both DA and EN
2. Progressive web app improvements — offline timesheet entry with sync
3. Notification system with bell icon + badge counts on sidebar items
4. Resource Planner improvements (per-person utilization heatmap)

### Nice to Have
1. Animate "Show less/more" stat card toggle
2. Add focus indicators to timesheet grid cells for keyboard navigation
3. Improve dark mode skeleton loader contrast
4. Reduce timeline toolbar density (group controls into overflow menu)
5. Add project color dots to timeline bars for better cross-referencing
6. Add "Today" marker to the weekly timesheet header (highlight current day column)
