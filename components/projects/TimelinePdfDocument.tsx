import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Font,
  StyleSheet,
} from "@react-pdf/renderer";
import {
  parseISO,
  startOfWeek,
  startOfMonth,
  addWeeks,
  addMonths,
  differenceInCalendarWeeks,
  differenceInCalendarDays,
  format,
  isWithinInterval,
  isBefore,
  isAfter,
  subWeeks,
} from "date-fns";
import { getToday } from "@/lib/demo-date";
import type {
  TimelineProject,
  TimelineActivity,
  TimelineMilestone,
} from "@/components/project-timeline/types";

// ---------------------------------------------------------------------------
// Font registration
// ---------------------------------------------------------------------------

Font.register({
  family: "DM Sans",
  fonts: [
    { src: "/fonts/DMSans-Regular.ttf", fontWeight: 400 },
    { src: "/fonts/DMSans-Medium.ttf", fontWeight: 500 },
    { src: "/fonts/DMSans-SemiBold.ttf", fontWeight: 600 },
    { src: "/fonts/DMSans-Bold.ttf", fontWeight: 700 },
  ],
});

Font.register({
  family: "JetBrains Mono",
  src: "/fonts/JetBrainsMono-Regular.ttf",
  fontWeight: 400,
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_WIDTH = 1190.55; // A3 landscape width in points (420mm)
const PAGE_HEIGHT = 841.89; // A3 landscape height in points (297mm)
const PADDING = 36;
const LEFT_COL_WIDTH = 170;
const GRID_LEFT = PADDING + LEFT_COL_WIDTH + 12;
const GRID_WIDTH = PAGE_WIDTH - GRID_LEFT - PADDING;

const PROJECT_BAR_HEIGHT = 14;
const ACTIVITY_BAR_HEIGHT = 10;
const MILESTONE_SIZE = 6;

const STATUS_COLORS: Record<string, string> = {
  not_started: "#9CA3AF",
  in_progress: "#F59E0B",
  needs_review: "#F97316",
  complete: "#22C55E",
};

const HEALTH_COLORS = {
  red: "#EF4444",
  yellow: "#F59E0B",
  green: "#22C55E",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TimelinePdfProps {
  projects: TimelineProject[];
  activities: Record<string, TimelineActivity[]>;
  milestones?: TimelineMilestone[];
  title?: string;
  companyName?: string;
  dateRange?: { start: Date; end: Date };
  generatedBy?: string;
  includeBudget?: boolean;
  includeMilestones?: boolean;
  includeActivities?: boolean;
  isDemo?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inferDateRange(projects: TimelineProject[]): {
  start: Date;
  end: Date;
} {
  let earliest: Date | null = null;
  let latest: Date | null = null;

  projects.forEach((p) => {
    if (!p.startDate || !p.endDate) return;
    const s = parseISO(p.startDate.slice(0, 10));
    const e = parseISO(p.endDate.slice(0, 10));
    if (!earliest || isBefore(s, earliest)) earliest = s;
    if (!latest || isAfter(e, latest)) latest = e;
  });

  if (!earliest || !latest) {
    const now = new Date();
    return { start: subWeeks(now, 4), end: addWeeks(now, 12) };
  }

  return {
    start: subWeeks(earliest, 2),
    end: addWeeks(latest, 4),
  };
}

interface PositionSystem {
  dateToX: (dateStr: string) => number;
  dateSpanWidth: (startStr: string, endStr: string) => number;
  getMonthSpans: () => Array<{ label: string; x: number; width: number }>;
  getWeekLabels: () => Array<{ label: string; x: number }>;
  getTodayX: (isDemo?: boolean) => number;
}

function createPositionSystem(dateRange: {
  start: Date;
  end: Date;
}): PositionSystem {
  const anchor = startOfWeek(dateRange.start, { weekStartsOn: 1 });
  const totalWeeks =
    differenceInCalendarWeeks(dateRange.end, anchor, { weekStartsOn: 1 }) + 2;
  const colWidthPt = GRID_WIDTH / totalWeeks;

  function dateToX(dateStr: string): number {
    const d = parseISO(dateStr.slice(0, 10));
    const daysDiff = differenceInCalendarDays(d, anchor);
    return (daysDiff / 7) * colWidthPt;
  }

  function dateSpanWidth(startStr: string, endStr: string): number {
    const s = parseISO(startStr.slice(0, 10));
    const e = parseISO(endStr.slice(0, 10));
    const daysDiff = differenceInCalendarDays(e, s) + 1;
    const w = (daysDiff / 7) * colWidthPt;
    return Math.max(w, colWidthPt * 0.5);
  }

  function getMonthSpans(): Array<{
    label: string;
    x: number;
    width: number;
  }> {
    const spans: Array<{ label: string; x: number; width: number }> = [];
    let current = startOfMonth(anchor);

    while (isBefore(current, dateRange.end) || current <= dateRange.end) {
      const nextMonth = addMonths(current, 1);
      const monthStart = isBefore(current, anchor) ? anchor : current;
      const monthEnd = isAfter(nextMonth, dateRange.end)
        ? dateRange.end
        : nextMonth;

      const startWeeks = differenceInCalendarWeeks(monthStart, anchor, {
        weekStartsOn: 1,
      });
      const endWeeks = differenceInCalendarWeeks(monthEnd, anchor, {
        weekStartsOn: 1,
      });

      const x = startWeeks * colWidthPt;
      const width = (endWeeks - startWeeks) * colWidthPt;

      if (width > 0) {
        spans.push({
          label: format(current, "MMM yyyy"),
          x,
          width,
        });
      }

      current = nextMonth;
    }

    return spans;
  }

  function getWeekLabels(): Array<{ label: string; x: number }> {
    const labels: Array<{ label: string; x: number }> = [];

    for (let i = 0; i < totalWeeks; i++) {
      // Show every other week
      if (i % 2 !== 0) continue;
      const weekDate = addWeeks(anchor, i);
      labels.push({
        label: format(weekDate, "w"),
        x: i * colWidthPt,
      });
    }

    return labels;
  }

  function getTodayX(isDemo?: boolean): number {
    const today = getToday(isDemo);
    if (
      isBefore(today, anchor) ||
      isAfter(today, addWeeks(anchor, totalWeeks))
    ) {
      return -1;
    }
    const daysDiff = differenceInCalendarDays(today, anchor);
    return (daysDiff / 7) * colWidthPt;
  }

  return { dateToX, dateSpanWidth, getMonthSpans, getWeekLabels, getTodayX };
}

function groupActivitiesByCategory(
  activities: TimelineActivity[]
): Array<{ name: string; color: string; activities: TimelineActivity[] }> {
  const groups: Record<
    string,
    { color: string; activities: TimelineActivity[] }
  > = {};

  activities.forEach((act) => {
    const key = act.phaseName || act.categoryName || "Aktiviteter";
    if (!groups[key]) {
      groups[key] = {
        color: act.phaseColor || act.color || "#6B7280",
        activities: [],
      };
    }
    groups[key].activities.push(act);
  });

  return Object.keys(groups).map((name) => ({
    name,
    color: groups[name].color,
    activities: groups[name].activities,
  }));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return null;
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function hexWithOpacity(hex: string, opacity: number): string {
  const c = hexToRgb(hex);
  if (!c) return hex;
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${opacity})`;
}

function getActivityOpacity(status: string): number {
  if (status === "not_started") return 0.5;
  if (status === "complete") return 0.7;
  return 1.0;
}

function getBudgetHealth(
  hoursUsed: number,
  budgetHours: number
): "red" | "yellow" | "green" {
  const ratio = hoursUsed / budgetHours;
  if (ratio >= 0.9) return "red";
  if (ratio >= 0.75) return "yellow";
  return "green";
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    padding: PADDING,
    backgroundColor: "#FAFAF9",
    fontFamily: "DM Sans",
  },
  // Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    color: "#1F2937",
  },
  subtitle: {
    fontSize: 8.5,
    color: "#6B7280",
    marginTop: 2,
  },
  metaText: {
    fontSize: 7.5,
    fontFamily: "JetBrains Mono",
    color: "#6B7280",
    textAlign: "right" as const,
  },
  // Grid area
  gridContainer: {
    flexDirection: "row",
    flex: 1,
  },
  leftColumn: {
    width: LEFT_COL_WIDTH,
    paddingRight: 8,
  },
  timelineArea: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
  },
  // Month header
  monthHeaderRow: {
    flexDirection: "row",
    height: 16,
    marginBottom: 2,
  },
  monthLabel: {
    fontSize: 8,
    fontWeight: 700,
    color: "#374151",
    paddingLeft: 4,
  },
  // Week header
  weekHeaderRow: {
    flexDirection: "row",
    height: 12,
    marginBottom: 6,
  },
  weekLabel: {
    fontSize: 6,
    fontFamily: "JetBrains Mono",
    color: "#9CA3AF",
  },
  // Project row
  projectRow: {
    flexDirection: "row",
    minHeight: 22,
    marginBottom: 4,
    alignItems: "center",
  },
  projectLeftCell: {
    width: LEFT_COL_WIDTH,
    paddingRight: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  projectDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  projectNameText: {
    fontSize: 8,
    fontWeight: 600,
    color: "#1F2937",
    maxLines: 1,
  },
  projectClientText: {
    fontSize: 6.5,
    color: "#6B7280",
    marginTop: 1,
  },
  phaseBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    marginTop: 2,
  },
  phaseBadgeText: {
    fontSize: 5.5,
    fontWeight: 500,
    color: "#FFFFFF",
  },
  // Budget bar
  budgetBarOuter: {
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    marginTop: 3,
    width: "100%",
  },
  budgetBarInner: {
    height: 4,
    borderRadius: 2,
  },
  budgetText: {
    fontSize: 5.5,
    fontFamily: "JetBrains Mono",
    color: "#6B7280",
    marginTop: 1,
  },
  // Project bar in timeline
  projectBar: {
    height: PROJECT_BAR_HEIGHT,
    borderRadius: 3,
    position: "absolute",
  },
  projectBarLabel: {
    fontSize: 6,
    fontWeight: 600,
    color: "#FFFFFF",
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  // Activity group
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    marginBottom: 1,
    height: 10,
  },
  categoryDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginRight: 4,
  },
  categoryText: {
    fontSize: 6,
    fontWeight: 500,
    color: "#6B7280",
  },
  // Activity row
  activityRow: {
    flexDirection: "row",
    minHeight: 14,
    marginBottom: 2,
    alignItems: "center",
  },
  activityLeftCell: {
    width: LEFT_COL_WIDTH,
    paddingRight: 8,
    paddingLeft: 18,
  },
  activityNameText: {
    fontSize: 6.5,
    color: "#374151",
    maxLines: 1,
  },
  activityAssignee: {
    fontSize: 5.5,
    color: "#9CA3AF",
    marginTop: 0.5,
  },
  // Activity bar in timeline
  activityBar: {
    height: ACTIVITY_BAR_HEIGHT,
    borderRadius: 2,
    position: "absolute",
  },
  activityStatusStripe: {
    height: 2,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    position: "absolute",
    top: 0,
    left: 0,
  },
  // Milestone
  milestoneRow: {
    flexDirection: "row",
    minHeight: 12,
    marginBottom: 2,
    alignItems: "center",
  },
  milestoneDiamond: {
    width: MILESTONE_SIZE,
    height: MILESTONE_SIZE,
    position: "absolute",
    transform: "rotate(45deg)",
  },
  milestoneLeftCell: {
    width: LEFT_COL_WIDTH,
    paddingRight: 8,
    paddingLeft: 18,
  },
  milestoneText: {
    fontSize: 6,
    color: "#6B7280",
    maxLines: 1,
  },
  // Today line
  todayLine: {
    position: "absolute",
    top: 0,
    width: 1.5,
    backgroundColor: "rgba(245, 158, 11, 0.5)",
  },
  // Footer
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: "#E5E7EB",
  },
  footerText: {
    fontSize: 6.5,
    color: "#9CA3AF",
  },
  footerBrand: {
    fontSize: 6.5,
    color: "#9CA3AF",
    fontWeight: 500,
  },
  // Non-billable style overlay
  nonBillableWrapper: {
    opacity: 0.6,
  },
  nonBillableBorder: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#D1D5DB",
    borderRadius: 3,
    padding: 2,
    marginBottom: 2,
  },
});

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MonthHeaders({ pos }: { pos: PositionSystem }) {
  const months = pos.getMonthSpans();
  return (
    <View style={styles.monthHeaderRow}>
      {months.map((m, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: m.x,
            width: m.width,
            height: 16,
            borderBottomWidth: 0.5,
            borderBottomColor: "#E5E7EB",
          }}
        >
          <Text style={styles.monthLabel}>{m.label}</Text>
        </View>
      ))}
    </View>
  );
}

function WeekHeaders({ pos }: { pos: PositionSystem }) {
  const weeks = pos.getWeekLabels();
  return (
    <View style={styles.weekHeaderRow}>
      {weeks.map((w, i) => (
        <View key={i} style={{ position: "absolute", left: w.x }}>
          <Text style={styles.weekLabel}>{w.label}</Text>
        </View>
      ))}
    </View>
  );
}

function TodayLine({
  pos,
  height,
  isDemo,
}: {
  pos: PositionSystem;
  height: number;
  isDemo?: boolean;
}) {
  const x = pos.getTodayX(isDemo);
  if (x < 0) return null;
  return (
    <View
      style={[
        styles.todayLine,
        {
          left: x,
          height,
        },
      ]}
    />
  );
}

function BudgetBar({
  hoursUsed,
  budgetHours,
}: {
  hoursUsed: number;
  budgetHours: number;
}) {
  const pct = Math.min((hoursUsed / budgetHours) * 100, 100);
  const health = getBudgetHealth(hoursUsed, budgetHours);
  return (
    <View>
      <View style={styles.budgetBarOuter}>
        <View
          style={[
            styles.budgetBarInner,
            {
              width: `${pct}%`,
              backgroundColor: HEALTH_COLORS[health],
            },
          ]}
        />
      </View>
      <Text style={styles.budgetText}>
        {hoursUsed.toFixed(0)}h / {budgetHours.toFixed(0)}h
      </Text>
    </View>
  );
}

function ProjectLeftPanel({
  project,
  includeBudget,
}: {
  project: TimelineProject;
  includeBudget?: boolean;
}) {
  const isNonBillable = !project.budgetHours || project.budgetHours === 0;

  return (
    <View
      style={[
        styles.projectLeftCell,
        isNonBillable ? styles.nonBillableWrapper : {},
      ]}
    >
      <View style={[styles.projectDot, { backgroundColor: project.color }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.projectNameText}>{project.name}</Text>
        {project.client ? (
          <Text style={styles.projectClientText}>{project.client}</Text>
        ) : null}
        {project.currentPhase ? (
          <View
            style={[
              styles.phaseBadge,
              { backgroundColor: project.currentPhase.color },
            ]}
          >
            <Text style={styles.phaseBadgeText}>
              {project.currentPhase.name}
            </Text>
          </View>
        ) : null}
        {includeBudget && project.budgetHours && project.budgetHours > 0 ? (
          <BudgetBar
            hoursUsed={project.hoursUsed}
            budgetHours={project.budgetHours}
          />
        ) : null}
      </View>
    </View>
  );
}

function ProjectBarView({
  project,
  pos,
}: {
  project: TimelineProject;
  pos: PositionSystem;
}) {
  if (!project.startDate || !project.endDate) return null;

  const x = pos.dateToX(project.startDate);
  const w = pos.dateSpanWidth(project.startDate, project.endDate);
  const isNonBillable = !project.budgetHours || project.budgetHours === 0;

  return (
    <View
      style={[
        styles.projectBar,
        {
          left: x,
          width: w,
          backgroundColor: hexWithOpacity(project.color, 0.85),
          ...(isNonBillable
            ? {
                borderWidth: 1,
                borderStyle: "dashed",
                borderColor: hexWithOpacity(project.color, 0.5),
                backgroundColor: hexWithOpacity(project.color, 0.5),
              }
            : {}),
        },
      ]}
    >
      {w > 30 ? (
        <Text style={styles.projectBarLabel}>{project.name}</Text>
      ) : null}
    </View>
  );
}

function ActivityBarView({
  activity,
  pos,
  projectColor,
}: {
  activity: TimelineActivity;
  pos: PositionSystem;
  projectColor: string;
}) {
  const x = pos.dateToX(activity.startDate);
  const w = pos.dateSpanWidth(activity.startDate, activity.endDate);
  const barColor = activity.color || activity.phaseColor || projectColor;
  const statusColor = STATUS_COLORS[activity.status] || STATUS_COLORS.not_started;
  const opacity = getActivityOpacity(activity.status);

  return (
    <View
      style={[
        styles.activityBar,
        {
          left: x,
          width: w,
          backgroundColor: hexWithOpacity(barColor, opacity),
        },
      ]}
    >
      <View
        style={[
          styles.activityStatusStripe,
          {
            width: w,
            backgroundColor: statusColor,
          },
        ]}
      />
    </View>
  );
}

function MilestoneDiamondView({
  milestone,
  pos,
}: {
  milestone: TimelineMilestone;
  pos: PositionSystem;
}) {
  const x = pos.dateToX(milestone.dueDate);
  const diamondColor = milestone.completed
    ? "#22C55E"
    : milestone.color || milestone.phaseColor || "#F59E0B";

  return (
    <View
      style={[
        styles.milestoneDiamond,
        {
          left: x - MILESTONE_SIZE / 2,
          backgroundColor: diamondColor,
        },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Main Document
// ---------------------------------------------------------------------------

export function TimelinePdfDocument({
  projects,
  activities,
  milestones = [],
  title = "Project Timeline",
  companyName,
  dateRange: dateRangeProp,
  generatedBy,
  includeBudget = true,
  includeMilestones = true,
  includeActivities = true,
  isDemo,
}: TimelinePdfProps) {
  // Filter projects with valid dates and sort by startDate ascending
  const validProjects = projects
    .filter((p) => p.startDate && p.endDate)
    .sort((a, b) => {
      const aDate = parseISO(a.startDate!.slice(0, 10));
      const bDate = parseISO(b.startDate!.slice(0, 10));
      return aDate.getTime() - bDate.getTime();
    });

  const dateRange = dateRangeProp || inferDateRange(validProjects);
  const pos = createPositionSystem(dateRange);

  const today = getToday(isDemo);
  const dateRangeLabel = `${format(dateRange.start, "d MMM yyyy")} — ${format(dateRange.end, "d MMM yyyy")}`;

  // Calculate content height for today line
  // Rough estimate: headers (30) + per project (26) + activities + milestones
  let contentRows = validProjects.length;
  if (includeActivities) {
    validProjects.forEach((p) => {
      const acts = activities[p.id] || [];
      if (acts.length > 0) {
        const grouped = groupActivitiesByCategory(acts);
        contentRows += grouped.length; // category headers
        contentRows += acts.length; // activity rows
      }
    });
  }
  if (includeMilestones) {
    contentRows += milestones.length;
  }
  const timelineContentHeight = 30 + contentRows * 16;

  return (
    <Document>
      <Page size="A3" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{dateRangeLabel}</Text>
          </View>
          <View>
            {companyName ? (
              <Text style={styles.metaText}>{companyName}</Text>
            ) : null}
            <Text style={styles.metaText}>
              {format(today, "d MMM yyyy HH:mm")}
            </Text>
            {generatedBy ? (
              <Text style={styles.metaText}>{generatedBy}</Text>
            ) : null}
          </View>
        </View>

        {/* Main grid */}
        <View style={styles.gridContainer}>
          {/* Left column - project names */}
          <View style={styles.leftColumn}>
            {/* Spacer for month + week headers */}
            <View style={{ height: 30 }} />

            {validProjects.map((project) => {
              const projectActivities = activities[project.id] || [];
              const projectMilestones = includeMilestones
                ? milestones.filter((m) => m.projectId === project.id)
                : [];
              const grouped =
                includeActivities && projectActivities.length > 0
                  ? groupActivitiesByCategory(projectActivities)
                  : [];

              return (
                <View key={project.id}>
                  {/* Project row left */}
                  <View style={{ minHeight: 22, marginBottom: 4, justifyContent: "center" }}>
                    <ProjectLeftPanel
                      project={project}
                      includeBudget={includeBudget}
                    />
                  </View>

                  {/* Activity left labels */}
                  {grouped.map((group, gi) => (
                    <View key={`${project.id}-g-${gi}`}>
                      <View style={styles.categoryHeader}>
                        <View
                          style={[
                            styles.categoryDot,
                            { backgroundColor: group.color },
                          ]}
                        />
                        <Text style={styles.categoryText}>{group.name}</Text>
                      </View>
                      {group.activities.map((act) => (
                        <View key={act.id} style={styles.activityRow}>
                          <View style={styles.activityLeftCell}>
                            <Text style={styles.activityNameText}>
                              {act.name}
                            </Text>
                            {act.assignedUserName ? (
                              <Text style={styles.activityAssignee}>
                                {act.assignedUserName}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      ))}
                    </View>
                  ))}

                  {/* Milestone left labels */}
                  {projectMilestones.map((ms) => (
                    <View key={ms.id} style={styles.milestoneRow}>
                      <View style={styles.milestoneLeftCell}>
                        <Text style={styles.milestoneText}>
                          {ms.completed ? "\u2713 " : "\u25C6 "}
                          {ms.title}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              );
            })}
          </View>

          {/* Timeline area */}
          <View style={styles.timelineArea}>
            {/* Month headers */}
            <MonthHeaders pos={pos} />

            {/* Week headers */}
            <WeekHeaders pos={pos} />

            {/* Today line spanning full timeline content */}
            <TodayLine
              pos={pos}
              height={timelineContentHeight}
              isDemo={isDemo}
            />

            {/* Project rows with bars */}
            {validProjects.map((project) => {
              const projectActivities = activities[project.id] || [];
              const projectMilestones = includeMilestones
                ? milestones.filter((m) => m.projectId === project.id)
                : [];
              const grouped =
                includeActivities && projectActivities.length > 0
                  ? groupActivitiesByCategory(projectActivities)
                  : [];

              return (
                <View key={project.id}>
                  {/* Project bar row */}
                  <View
                    style={{
                      position: "relative",
                      height: 22,
                      marginBottom: 4,
                    }}
                  >
                    <ProjectBarView project={project} pos={pos} />
                  </View>

                  {/* Activity bars */}
                  {grouped.map((group, gi) => (
                    <View key={`${project.id}-gb-${gi}`}>
                      {/* Category header spacer */}
                      <View style={{ height: 10, marginTop: 2, marginBottom: 1 }} />

                      {group.activities.map((act) => (
                        <View
                          key={act.id}
                          style={{
                            position: "relative",
                            height: 14,
                            marginBottom: 2,
                          }}
                        >
                          <ActivityBarView
                            activity={act}
                            pos={pos}
                            projectColor={project.color}
                          />
                        </View>
                      ))}
                    </View>
                  ))}

                  {/* Milestone diamonds */}
                  {projectMilestones.map((ms) => (
                    <View
                      key={ms.id}
                      style={{
                        position: "relative",
                        height: 12,
                        marginBottom: 2,
                      }}
                    >
                      <MilestoneDiamondView milestone={ms} pos={pos} />
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View>
            {companyName ? (
              <Text style={styles.footerText}>{companyName}</Text>
            ) : null}
            <Text style={styles.footerText}>{dateRangeLabel}</Text>
          </View>
          <Text style={styles.footerBrand}>Cloud Timer</Text>
        </View>
      </Page>
    </Document>
  );
}

export default TimelinePdfDocument;
