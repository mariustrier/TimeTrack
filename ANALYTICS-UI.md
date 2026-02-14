# Analytics UI/UX Documentation

## Overview

The analytics system in Cloud Timer has 4 tabs accessible to admin/manager roles, built with **Recharts** for all chart rendering and wrapped in a reusable **ChartCard** component.

### Global Controls (top of page)
- **Granularity toggle**: Monthly / Weekly
- **Approval filter**: "Approved Only" / "All Entries"
- **Date range picker**: Default is last 3 months (`subMonths(today, 3)` to `today`)
- All charts support **PNG export** (2x canvas scale) and **CSV export** via ChartCard

### Demo Date
The app uses `getToday()` from `lib/demo-date.ts` instead of `new Date()`. For the demo deployment, this returns a pinned date (Feb 12, 2026) set via `NEXT_PUBLIC_DEMO_DATE` env var.

---

## Tab 1: Employee Insights

**Component**: `components/analytics/employee-insights.tsx`

**Layout**: Employee selector → Time Distribution (full width) → Utilization Trend + Profitability (2-column grid)

### Chart 1: Time Distribution (PieChart)
- **Type**: `PieChart`
- **Data**: `[{status, hours}]` — hours grouped by billing status
- **Data keys**: `hours` (values), `label` (translated status name)
- **Colors** (via `BILLING_COLORS`):
  - Billable: `#10B981` (green)
  - Included: `#6366F1` (indigo)
  - Non-billable: `#F59E0B` (amber)
  - Internal: `#8B5CF6` (purple)
  - Pre-sales: `#3B82F6` (blue)
- **Features**: Inner/outer radius 60/100, percentage labels on slices (only >5%), legend below
- **Height**: 350px
- **Aggregation**: `aggregateEmployeeTimeDistribution(entries)`

### Chart 2: Utilization Trend (LineChart)
- **Type**: `LineChart` with area fill and reference zones
- **Data**: `[{period, billableUtil, totalUtil, target}]`
- **Actual lines**:
  - `billableUtil` — `#10B981` (green), solid, dots r=4
  - `totalUtil` — `#6366F1` (indigo), solid, dots r=4
- **Projection lines** (dashed, `strokeDasharray="6 3"`, no dots, legend hidden):
  - `proj_billableUtil` — same green
  - `proj_totalUtil` — same indigo
- **Reference zones**:
  - Green zone: y=70 to y=85 (8% opacity)
  - Target line: y=100 (gray dashed)
- **Y-axis**: `${v}%`
- **Height**: 300px
- **Aggregation**: `aggregateEmployeeUtilizationTrend()` + `withProjection()`

### Chart 3: Profitability Over Time (ComposedChart)
- **Type**: `ComposedChart` (bars + line)
- **Data**: `[{period, revenue, cost, profit}]`
- **Bars**: `revenue` (green `#10B981`), `cost` (red `#EF4444`), rounded top
- **Line**: `profit` (indigo `#6366F1`), dots r=4
- **Projection lines** (dashed): `proj_revenue`, `proj_cost`, `proj_profit`
- **Y-axis**: Currency formatted
- **Height**: 300px
- **Aggregation**: `aggregateEmployeeProfitability()` + `withProjection()`

---

## Tab 2: Team Insights

**Component**: `components/analytics/team-insights.tsx`

**Layout**: 3 full-width charts stacked

### Chart 1: Utilization Comparison (BarChart)
- **Type**: `BarChart` (grouped, per employee)
- **Data**: `[{name, billableUtil, totalUtil}]`
- **Bars**: `billableUtil` (green), `totalUtil` (indigo), rounded top
- **Reference zones**: Green zone y=70–85, target line y=100
- **X-axis**: Employee names, rotated -20°
- **Y-axis**: `${v}%`
- **Height**: 350px
- **Aggregation**: `aggregateTeamUtilization()`

### Chart 2: Profitability Comparison (ComposedChart, dual Y-axis)
- **Type**: `ComposedChart`
- **Data**: `[{name, revenue, cost, margin}]`
- **Left Y-axis** (bars): `revenue` (green), `cost` (red) — currency formatted
- **Right Y-axis** (line): `margin` (purple `#8B5CF6`) — percentage formatted
- **X-axis**: Employee names, rotated -20°
- **Height**: 350px
- **Aggregation**: `aggregateTeamProfitability()`

### Chart 3: Time Mix Comparison (BarChart, stacked)
- **Type**: `BarChart` (stacked per employee)
- **Data**: `[{name, billable, included, non_billable, internal, presales}]`
- **Bars**: All 5 billing statuses stacked, colors from `BILLING_COLORS`
- **Y-axis**: `${v}h` (hours)
- **Height**: 350px
- **Aggregation**: `aggregateTeamTimeMix()`

---

## Tab 3: Project Insights

**Component**: `components/analytics/project-insights.tsx`

**Layout**: Project selector → Billable Mix (always visible) → Burndown + Profitability (2-column, when project selected) → Phase Distribution (full width, conditional)

### Chart 1: Billable vs Non-billable by Project (BarChart, stacked)
- **Type**: `BarChart` (stacked, always visible)
- **Data**: `[{name, billable, included, non_billable, internal, presales}]`
- **Bars**: All 5 statuses stacked, `BILLING_COLORS`, order from `BILLING_STATUS_ORDER`
- **Y-axis**: "Hours" label
- **Height**: 350px
- **Aggregation**: `aggregateProjectBillableMix()`

### Chart 2: Contract Burn-down (LineChart) — requires project selection + budget
- **Type**: `LineChart` with area fill
- **Data**: `[{period, hoursUsed, hoursRemaining, idealBurn}]`
- **Area + Line**: `hoursRemaining` (green `#10B981`, fill 10% opacity)
- **Dashed line**: `idealBurn` (gray `#9CA3AF`, `strokeDasharray="5 5"`)
- **Projection lines**: `proj_hoursUsed`, `proj_hoursRemaining` (dashed)
- **Empty state**: Message when project has no budget
- **Aggregation**: `aggregateProjectBurndown()` + `withProjection()`

### Chart 3: Project Profitability (ComposedChart) — requires project selection
- **Type**: `ComposedChart` (bars + line)
- **Data**: `[{period, revenue, cost, profit}]`
- **Same pattern as Employee Profitability** but with project-specific data
- **Projection lines**: `proj_revenue`, `proj_cost`, `proj_profit`
- **Aggregation**: `aggregateProjectProfitability()` + `withProjection()`

### Chart 4: Phase Distribution (BarChart) — conditional
- **Type**: `BarChart` (grouped)
- **Condition**: Shown when phases exist and aren't all "Unassigned"
- **Data**: `[{phaseName, hours, revenue, cost, margin}]`
- **Bars**: `hours` (indigo), `revenue` (green), `cost` (red)
- **Full width** (`lg:col-span-2`)
- **Aggregation**: `aggregatePhaseDistribution()`

---

## Tab 4: Company Insights

**Component**: `components/analytics/company-insights.tsx`

**Layout**: Revenue vs Overhead → Expense Breakdown → Non-billable Trend → Unbilled Work (chart + table)

### Chart 1: Revenue vs Overhead (ComposedChart + Forecast)
- **Type**: `ComposedChart` (area + bar + line)
- **Data**: `[{period, revenue, overhead, contributionMargin}]`
- **Area**: `revenue` (green `#10B981`, fill 15% opacity)
- **Bar**: `overhead` (orange `#F97316`, rounded top)
- **Line**: `contributionMargin` (indigo `#6366F1`, dots r=4)
- **Forecast** (when monthly + 3+ data points):
  - `forecastRevenue` — dashed green line extending 3 months
  - `forecastMargin` — dashed indigo line extending 3 months
  - Based on 3-month rolling average
- **Projection lines**: `proj_revenue`, `proj_contributionMargin` (dashed, current month)
- **Height**: 350px
- **Aggregation**: `aggregateCompanyRevenueOverhead()` + `calculateForecast()` + `withProjection()`

### Chart 2: Expense Breakdown (BarChart, stacked)
- **Type**: `BarChart` (stacked by period)
- **Data**: `[{period, travel, materials, software, meals, rent, insurance, utilities, salaries, other}]`
- **9 stacked bars** using `SERIES_COLORS`:
  - Rent (#6366F1), Salaries (#10B981), Insurance (#F59E0B), Utilities (#EF4444),
  - Software (#8B5CF6), Travel (#3B82F6), Materials (#EC4899), Meals (#14B8A6), Other (#F97316)
- **Y-axis**: Currency formatted
- **Data enhanced** by `withProjection()` — current month bars show projected height
- **Height**: 350px
- **Aggregation**: `aggregateExpenseBreakdown()`

### Chart 3: Non-Billable Trend (LineChart)
- **Type**: `LineChart` with reference areas
- **Data**: `[{period, totalPercent, internal, presales, nonBillable}]`
- **Lines**:
  - `totalPercent` — gray `#9CA3AF`, dashed (overview)
  - `internal` — purple `#8B5CF6`
  - `presales` — blue `#3B82F6`
  - `nonBillable` — amber `#F59E0B`
- **Projection lines**: `proj_totalPercent`, `proj_internal`, `proj_presales`, `proj_nonBillable`
- **Reference areas**:
  - Green zone: 0–15% (healthy range)
  - Amber zone: 15–25% (warning)
- **Y-axis**: `${v}%`
- **Height**: 350px
- **Aggregation**: `aggregateNonBillableTrend()` + `withProjection()`

### Chart 4: Unbilled Work Aging (BarChart, horizontal)
- **Type**: `BarChart` (`layout="vertical"`, horizontal bars)
- **Data**: `[{projectName, hours, estimatedRevenue, oldestEntryDate, ageInDays, entryCount}]`
- **Bar**: `estimatedRevenue` (green `#10B981`, rounded right)
- **Y-axis**: Project names (width=140)
- **X-axis**: Currency formatted
- **Dynamic height**: `max(300, rows × 40 + 60)`
- **Aggregation**: `aggregateUnbilledWork()`

### Table: Unbilled Work Details
- **Columns**: Project | Hours | Estimated Revenue | Oldest Entry | Age (Days)
- **Shown**: Below chart when data exists

---

## Projection System (`withProjection`)

**File**: `lib/analytics-utils.ts`

All time-series charts use `withProjection()` to handle incomplete current periods:

```typescript
withProjection(data, getToday(), granularity, ["revenue", "cost", "profit"])
```

**How it works**:
1. Calculates what fraction of the current period has elapsed
   - Weekly: `currentWeekday / 5`
   - Monthly: `currentDay / daysInMonth`
2. If ≥95% elapsed, no projection needed
3. For the **second-to-last** data point: adds `proj_*` = actual (connection point for the dashed line)
4. For the **last** data point: adds `proj_*` = `actual / ratio` (projected full-period value)

**In charts**: Rendered as `<Line dataKey="proj_*" strokeDasharray="6 3" dot={false} legendType="none" />` with matching colors.

---

## Color Reference

### Billing Status Colors (`BILLING_COLORS`)
| Status | Color | Hex |
|--------|-------|-----|
| Billable | Green | `#10B981` |
| Included | Indigo | `#6366F1` |
| Non-billable | Amber | `#F59E0B` |
| Internal | Purple | `#8B5CF6` |
| Pre-sales | Blue | `#3B82F6` |

### Metric Colors (`METRIC_COLORS`)
| Metric | Color | Hex |
|--------|-------|-----|
| Revenue | Green | `#10B981` |
| Cost | Red | `#EF4444` |
| Profit | Indigo | `#6366F1` |
| Overhead | Orange | `#F97316` |
| Target | Gray | `#9CA3AF` |
| Margin | Purple | `#8B5CF6` |

### Chart Theme (Dark / Light)
| Property | Dark | Light |
|----------|------|-------|
| Text | `#E2E8F0` | `#1E293B` |
| Text muted | `#94A3B8` | `#64748B` |
| Grid | `#334155` | `#E2E8F0` |
| Tooltip BG | `#1E293B` | `#FFFFFF` |

---

## ChartCard Wrapper

**File**: `components/analytics/chart-card.tsx`

Every chart is wrapped in `<ChartCard>` which provides:
- **Loading state**: Skeleton at `chartHeight` (default 300px)
- **Empty state**: Icon + "No Data" message
- **PNG export**: SVG → Canvas at 2x resolution, white background
- **CSV export**: Auto-detects headers from data array
- **ResponsiveContainer**: Auto-fits parent width

---

## API Contract

**Endpoint**: `GET /api/analytics`

**Query params**: `type`, `startDate`, `endDate`, `granularity`, `approvalFilter`, `employeeId?`, `projectId?`

**Auth**: Admin/Manager only

| Type | Without ID | With ID |
|------|-----------|---------|
| employee | `{members, currency}` | `{timeDistribution, utilizationTrend, profitability, currency}` |
| team | `{utilization, profitability, timeMix, currency}` | N/A |
| project | `{projects, billableMix, currency}` | `{burndown, profitability, billableMix, phaseDistribution, phaseVelocity, currency}` |
| company | `{revenueOverhead, nonBillableTrend, unbilledWork, expenseBreakdown, currency}` | N/A |

---

## Key Files

| File | Purpose |
|------|---------|
| `app/(dashboard)/analytics/page.tsx` | Tab container, global controls |
| `components/analytics/employee-insights.tsx` | Employee tab charts |
| `components/analytics/team-insights.tsx` | Team tab charts |
| `components/analytics/project-insights.tsx` | Project tab charts |
| `components/analytics/company-insights.tsx` | Company tab charts |
| `components/analytics/chart-card.tsx` | Chart wrapper (loading, export) |
| `lib/analytics-utils.ts` | Data aggregation functions + withProjection |
| `lib/chart-theme.ts` | Dark/light theme colors |
| `lib/chart-colors.ts` | Billing, metric, series color palettes |
| `app/api/analytics/route.ts` | Analytics API endpoint |
