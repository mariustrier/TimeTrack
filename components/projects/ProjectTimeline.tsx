"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useReducer,
  useRef,
} from "react";
import {
  startOfWeek,
  startOfDay,
  addWeeks,
  addDays,
  differenceInCalendarWeeks,
  differenceInCalendarDays,
  format,
} from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useTranslations } from "@/lib/i18n";
import { getToday } from "@/lib/demo-date";
import { useIsDemo } from "@/lib/company-context";
import type {
  TimelineProject,
  TimelineActivity,
  TimelineMilestone,
  CompanyPhase,
  DeadlineIcon,
} from "@/components/project-timeline/types";
import { DeadlineMarker } from "@/components/project-timeline/DeadlineMarker";
import { DeadlinePopover } from "@/components/project-timeline/DeadlinePopover";

/* ─────────────────────────────────────────────
   INTERNAL TYPES (mapped from API data)
   ───────────────────────────────────────────── */

interface MProject {
  id: string;
  name: string;
  client: string;
  color: string;
  budgetHealth: number;
  startWeek: number;
  endWeek: number;
  currentPhase: string;
  keyDeadline: { week: number; label: string; milestoneId: string } | null;
  conflicts: number;
  phases: {
    id: string;
    name: string;
    start: number;
    end: number;
    color: string;
  }[];
  _startDate: string | null;
  _endDate: string | null;
}

interface MActivity {
  id: string;
  name: string;
  projectId: string;
  phase: string;
  start: number;
  end: number;
  _startDate: string;
  _endDate: string;
}

type MilestoneWithWeek = TimelineMilestone & { week: number };

/* ─────────────────────────────────────────────
   UNDO / REDO REDUCER
   ───────────────────────────────────────────── */

interface TLState {
  projects: MProject[];
  activities: Record<string, MActivity[]>;
}

interface UndoableState {
  present: TLState;
  past: TLState[];
  future: TLState[];
}

type UndoAction =
  | { type: "SET_STATE"; payload: TLState }
  | { type: "UPDATE"; payload: TLState }
  | { type: "UNDO" }
  | { type: "REDO" };

function undoReducer(state: UndoableState, action: UndoAction): UndoableState {
  switch (action.type) {
    case "SET_STATE":
      return {
        present: action.payload,
        past: [],
        future: [],
      };
    case "UPDATE":
      return {
        present: action.payload,
        past: [...state.past, state.present],
        future: [],
      };
    case "UNDO": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        present: previous,
        past: state.past.slice(0, -1),
        future: [state.present, ...state.future],
      };
    }
    case "REDO": {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        present: next,
        past: [...state.past, state.present],
        future: state.future.slice(1),
      };
    }
    default:
      return state;
  }
}

/* ─────────────────────────────────────────────
   DRAG STATE
   ───────────────────────────────────────────── */

interface DragInfo {
  type: "move" | "resize-left" | "resize-right";
  entityType: "project" | "activity";
  entityId: string;
  projectId: string;
  startMouseX: number;
  originalStartWeek: number;
  originalEndWeek: number;
}

/* ─────────────────────────────────────────────
   POPOVER STATE
   ───────────────────────────────────────────── */

interface PopoverState {
  entityType: "project" | "activity";
  entityId: string;
  projectId: string;
  name: string;
  startWeek: number;
  endWeek: number;
  anchorRect: DOMRect;
}

/* ─────────────────────────────────────────────
   HELPER COMPONENTS (from demo)
   ───────────────────────────────────────────── */

function BudgetBar({ health }: { health: number }) {
  const barColor =
    health > 0.7 ? "#059669" : health > 0.5 ? "#D97706" : "#DC2626";
  return (
    <div className="flex items-center gap-1.5">
      <div
        style={{
          width: 48,
          height: 4,
          background: "#E5E7EB",
          borderRadius: 2,
        }}
      >
        <div
          style={{
            width: `${Math.min(health, 1) * 100}%`,
            height: 4,
            background: barColor,
            borderRadius: 2,
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <span
        style={{
          fontSize: 10,
          color: barColor,
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {Math.round(health * 100)}%
      </span>
    </div>
  );
}

function ConflictBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 18,
        height: 18,
        borderRadius: 9,
        background: "#FEE2E2",
        color: "#DC2626",
        fontSize: 10,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {count}
    </span>
  );
}

function PhaseBadge({ name, color }: { name: string; color?: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 4,
        background: color || "#F3F4F6",
        fontSize: 10,
        fontWeight: 600,
        color: "#374151",
        whiteSpace: "nowrap",
      }}
    >
      {name}
    </span>
  );
}

function NavBtn({
  onClick,
  label,
  wide,
}: {
  onClick: () => void;
  label: string;
  wide?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: wide ? "5px 14px" : "5px 10px",
        borderRadius: 6,
        border: "1px solid #E5E7EB",
        background: "#fff",
        fontSize: 12,
        fontWeight: 500,
        color: "#374151",
        cursor: "pointer",
        lineHeight: 1,
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "#F9FAFB")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = "#fff")
      }
    >
      {label}
    </button>
  );
}

/* ─────────────────────────────────────────────
   MAIN COMPONENT
   ───────────────────────────────────────────── */

export function ProjectTimeline() {
  /* ─── View scale (must come before date helpers) ─── */
  const [viewScale, setViewScale] = useState<"day" | "week" | "month" | "year">("month");
  const [isFocusMode, setIsFocusMode] = useState(false);
  const t = useTranslations("timeline");
  const isDemo = useIsDemo();

  /* ─── Anchor / date helpers ─── */
  const WEEK_ANCHOR = useMemo(
    () => startOfWeek(addWeeks(getToday(isDemo), -52), { weekStartsOn: 1 }),
    [isDemo]
  );
  const DAY_ANCHOR = useMemo(
    () => startOfDay(addDays(getToday(isDemo), -365)),
    [isDemo]
  );

  const ANCHOR = viewScale === "day" ? DAY_ANCHOR : WEEK_ANCHOR; // year also uses WEEK_ANCHOR

  const TODAY_WEEK = useMemo(
    () =>
      viewScale === "day"
        ? differenceInCalendarDays(getToday(isDemo), DAY_ANCHOR)
        : differenceInCalendarWeeks(getToday(isDemo), WEEK_ANCHOR, { weekStartsOn: 1 }),
    [viewScale, DAY_ANCHOR, WEEK_ANCHOR, isDemo]
  );

  const dateToWeek = useCallback(
    (dateStr: string) => {
      // Handle both "2025-06-15" and "2025-06-15T00:00:00.000Z" formats
      const dateOnly = dateStr.slice(0, 10);
      const d = new Date(dateOnly + "T00:00:00");
      if (viewScale === "day") {
        return differenceInCalendarDays(d, DAY_ANCHOR);
      }
      return differenceInCalendarWeeks(d, WEEK_ANCHOR, { weekStartsOn: 1 });
    },
    [viewScale, DAY_ANCHOR, WEEK_ANCHOR]
  );

  const weekToDate = useCallback(
    (unit: number) => {
      if (viewScale === "day") {
        return format(addDays(DAY_ANCHOR, unit), "yyyy-MM-dd");
      }
      return format(addWeeks(WEEK_ANCHOR, unit), "yyyy-MM-dd");
    },
    [viewScale, DAY_ANCHOR, WEEK_ANCHOR]
  );

  const weekToLabel = useCallback(
    (unit: number) => {
      if (viewScale === "day") {
        const d = addDays(DAY_ANCHOR, unit);
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      }
      const d = addWeeks(WEEK_ANCHOR, unit);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    },
    [viewScale, DAY_ANCHOR, WEEK_ANCHOR]
  );

  /* ─── UI State ─── */
  const [loading, setLoading] = useState(true);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [hoveredActivity, setHoveredActivity] = useState<string | null>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [drag, setDrag] = useState<DragInfo | null>(null);
  const [dragDelta, setDragDelta] = useState(0);
  const dragRef = useRef<DragInfo | null>(null);
  const dragDeltaRef = useRef(0);
  const justDraggedRef = useRef(false);

  /* ─── Activity cache (lazy loaded per project) ─── */
  const [activityCache, setActivityCache] = useState<
    Record<string, MActivity[]>
  >({});
  const loadingActivitiesRef = useRef<Set<string>>(new Set());

  /* ─── Milestones (outside undo/redo — immediate API calls) ─── */
  const [liveMilestones, setLiveMilestones] = useState<MilestoneWithWeek[]>([]);
  const [companyPhases, setCompanyPhases] = useState<CompanyPhase[]>([]);
  const [deadlinePopover, setDeadlinePopover] = useState<{
    open: boolean;
    position: { top: number; left: number } | null;
    milestone: TimelineMilestone | null;
    projectId: string;
    projectColor: string;
    defaultDate?: string;
  }>({ open: false, position: null, milestone: null, projectId: "", projectColor: "" });

  /* ─── Undo/Redo state ─── */
  const [undoState, dispatch] = useReducer(undoReducer, {
    present: { projects: [], activities: {} },
    past: [],
    future: [],
  });

  const editBaselineRef = useRef<TLState | null>(null);
  const isSavingRef = useRef(false);

  /* ─── Filters ─── */
  const [filterPhase, setFilterPhase] = useState<string>("all");
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterOpen, setFilterOpen] = useState(false);

  /* ─── Derived ─── */
  const allProjects = undoState.present.projects;
  const projects = useMemo(() => {
    let filtered = allProjects;
    if (filterPhase !== "all") {
      filtered = filtered.filter((p) => p.currentPhase === filterPhase);
    }
    if (filterClient !== "all") {
      filtered = filtered.filter((p) => p.client === filterClient);
    }
    return filtered;
  }, [allProjects, filterPhase, filterClient]);

  const uniqueClients = useMemo(() => {
    const set = new Set<string>();
    allProjects.forEach((p) => { if (p.client) set.add(p.client); });
    return Array.from(set).sort();
  }, [allProjects]);

  const uniquePhases = useMemo(() => {
    const set = new Set<string>();
    allProjects.forEach((p) => { if (p.currentPhase) set.add(p.currentPhase); });
    return Array.from(set).sort();
  }, [allProjects]);

  const activeFilterCount = (filterPhase !== "all" ? 1 : 0) + (filterClient !== "all" ? 1 : 0);

  const phaseDeadlinesByProject = useMemo(() => {
    const map: Record<string, string[]> = {};
    liveMilestones.forEach((m) => {
      if (m.type === "phase" && m.phaseId) {
        if (!map[m.projectId]) map[m.projectId] = [];
        map[m.projectId].push(m.phaseId);
      }
    });
    return map;
  }, [liveMilestones]);

  const COL_WIDTH = viewScale === "day" ? 36 : viewScale === "week" ? 56 : viewScale === "month" ? 96 : 20;
  const focusModeContainerRef = useRef<HTMLDivElement>(null);
  const [focusWidth, setFocusWidth] = useState(0);

  useEffect(() => {
    if (isFocusMode) {
      setFocusWidth(window.innerWidth);
      const handleResize = () => setFocusWidth(window.innerWidth);
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, [isFocusMode]);

  const LEFT_COL = 260;
  const availableGridWidth = isFocusMode && focusWidth > 0 ? focusWidth - LEFT_COL - 20 : 0;
  const VISIBLE_COLS = isFocusMode && availableGridWidth > 0
    ? Math.max(1, Math.floor(availableGridWidth / COL_WIDTH))
    : viewScale === "day" ? 35 : viewScale === "week" ? 16 : viewScale === "month" ? 10 : 52;

  const TOTAL_WEEKS = useMemo(() => {
    const defaultTotal = viewScale === "day" ? 180 : viewScale === "year" ? 156 : 26;
    if (allProjects.length === 0) return defaultTotal;
    let minW = Infinity;
    let maxW = -Infinity;
    for (const p of allProjects) {
      if (p.startWeek < minW) minW = p.startWeek;
      if (p.endWeek > maxW) maxW = p.endWeek;
    }
    const padding = viewScale === "day" ? 30 : viewScale === "year" ? 12 : 6;
    const range = maxW - minW + padding;
    return Math.max(defaultTotal, range);
  }, [allProjects, viewScale]);

  const viewMode = editMode
    ? "edit"
    : expandedProject
    ? "planning"
    : "overview";

  const weekNumbers = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i < VISIBLE_COLS; i++) arr.push(i + scrollOffset);
    return arr;
  }, [scrollOffset, VISIBLE_COLS]);

  const changeCount = undoState.past.length;

  /* ─── Map API data to internal format ─── */
  const mapProjectsFromApi = useCallback(
    (
      apiProjects: TimelineProject[],
      apiMilestones: TimelineMilestone[]
    ): { projects: MProject[]; milestones: MilestoneWithWeek[] } => {
      const mProjects: MProject[] = apiProjects.map((p) => {
        const startWeek = p.startDate ? dateToWeek(p.startDate) : 0;
        const endWeek = p.endDate
          ? dateToWeek(p.endDate)
          : startWeek + 12;
        const budgetHealth =
          p.budgetHours && p.budgetHours > 0
            ? p.hoursUsed / p.budgetHours
            : 1;

        const phaseName = p.currentPhase?.name || "";

        // Find the first upcoming milestone as key deadline
        const projectMilestones = apiMilestones.filter(
          (m) => m.projectId === p.id && !m.completed
        );
        let keyDeadline: { week: number; label: string; milestoneId: string } | null = null;
        if (projectMilestones.length > 0) {
          const sorted = projectMilestones.sort(
            (a, b) =>
              new Date(a.dueDate).getTime() -
              new Date(b.dueDate).getTime()
          );
          keyDeadline = {
            week: dateToWeek(sorted[0].dueDate),
            label: sorted[0].title,
            milestoneId: sorted[0].id,
          };
        }

        const phases = (p.projectPhases || []).map((pp) => ({
          id: pp.id,
          name: pp.phaseName,
          start: dateToWeek(pp.startDate),
          end: dateToWeek(pp.endDate),
          color: pp.phaseColor,
        }));

        return {
          id: p.id,
          name: p.name,
          client: p.client || "",
          color: p.color,
          budgetHealth,
          startWeek,
          endWeek,
          currentPhase: phaseName,
          keyDeadline,
          conflicts: 0,
          phases,
          _startDate: p.startDate,
          _endDate: p.endDate,
        };
      });

      const mMilestones: MilestoneWithWeek[] = apiMilestones.map((m) => ({
        ...m,
        week: dateToWeek(m.dueDate),
      }));

      return { projects: mProjects, milestones: mMilestones };
    },
    [dateToWeek]
  );

  const mapActivitiesFromApi = useCallback(
    (apiActivities: TimelineActivity[], projectId: string): MActivity[] => {
      return apiActivities.map((a) => ({
        id: a.id,
        name: a.name,
        projectId,
        phase: a.phaseName || a.categoryName || "",
        start: dateToWeek(a.startDate),
        end: dateToWeek(a.endDate),
        _startDate: a.startDate,
        _endDate: a.endDate,
      }));
    },
    [dateToWeek]
  );

  /* ─── Data fetching ─── */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const startDate = weekToDate(scrollOffset - 4);
      const endDate = weekToDate(scrollOffset + VISIBLE_COLS + 4);

      const params = new URLSearchParams({
        startDate,
        endDate,
        status: "active",
        include: "phases",
      });

      const res = await fetch(`/api/projects/timeline?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch timeline data");

      const data = await res.json();
      const { projects: mp, milestones: mm } = mapProjectsFromApi(
        data.projects || [],
        data.milestones || []
      );

      const newState: TLState = {
        projects: mp,
        activities: {},
      };

      dispatch({ type: "SET_STATE", payload: newState });
      setLiveMilestones(mm);
      setCompanyPhases(data.phases || []);

      // Auto-set scroll to show today
      if (mp.length > 0) {
        const targetOffset = Math.max(
          0,
          TODAY_WEEK - Math.floor(VISIBLE_COLS / 2)
        );
        setScrollOffset(targetOffset);
      }
    } catch (error) {
      console.error("Error fetching timeline data:", error);
      toast.error(t("fetchError"));
    } finally {
      setLoading(false);
    }
  }, [weekToDate, scrollOffset, VISIBLE_COLS, mapProjectsFromApi, TODAY_WEEK]);

  // Initial load + refetch on viewScale change
  const prevViewScaleRef = useRef(viewScale);
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      fetchData();
    } else if (prevViewScaleRef.current !== viewScale) {
      prevViewScaleRef.current = viewScale;
      setActivityCache({});
      loadingActivitiesRef.current.clear();
      fetchData();
    }
  }, [fetchData, viewScale]);

  /* ─── Lazy load activities when project expanded ─── */
  const fetchActivities = useCallback(
    async (projectId: string) => {
      if (
        activityCache[projectId] ||
        loadingActivitiesRef.current.has(projectId)
      )
        return;
      loadingActivitiesRef.current.add(projectId);
      try {
        const res = await fetch(`/api/projects/${projectId}/activities`);
        if (!res.ok) throw new Error("Failed to fetch activities");
        const data: TimelineActivity[] = await res.json();
        const mapped = mapActivitiesFromApi(data, projectId);
        setActivityCache((prev) => ({ ...prev, [projectId]: mapped }));
        // Also add to undo state
        dispatch({
          type: "SET_STATE",
          payload: {
            ...undoState.present,
            activities: {
              ...undoState.present.activities,
              [projectId]: mapped,
            },
          },
        });
      } catch (error) {
        console.error("Error fetching activities:", error);
      } finally {
        loadingActivitiesRef.current.delete(projectId);
      }
    },
    [activityCache, mapActivitiesFromApi, undoState.present]
  );

  useEffect(() => {
    if (expandedProject) {
      fetchActivities(expandedProject);
    }
  }, [expandedProject, fetchActivities]);

  /* ─── Navigation ─── */
  const handleExpand = useCallback(
    (id: string) => {
      setExpandedProject((prev) => (prev === id ? null : id));
    },
    []
  );

  const NAV_STEP = viewScale === "day" ? 7 : viewScale === "year" ? 13 : 4;
  const handlePrev = () => setScrollOffset((s) => Math.max(0, s - NAV_STEP));
  const handleNext = () =>
    setScrollOffset((s) =>
      Math.min(TOTAL_WEEKS - VISIBLE_COLS, s + NAV_STEP)
    );
  const handleToday = () =>
    setScrollOffset(
      Math.max(0, TODAY_WEEK - Math.floor(VISIBLE_COLS / 2))
    );

  /* ─── Edit mode toggle ─── */
  const enterEditMode = useCallback(() => {
    editBaselineRef.current = JSON.parse(
      JSON.stringify(undoState.present)
    );
    setEditMode(true);
  }, [undoState.present]);

  const exitEditMode = useCallback(() => {
    setEditMode(false);
    setPopover(null);
    dragRef.current = null;
    dragDeltaRef.current = 0;
    setDrag(null);
    setDragDelta(0);
  }, []);

  /* ─── Undo / Redo ─── */
  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const redo = useCallback(() => dispatch({ type: "REDO" }), []);

  /* ─── Keyboard shortcuts ─── */
  useEffect(() => {
    if (!editMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        ((e.key === "z" && e.shiftKey) || e.key === "y")
      ) {
        e.preventDefault();
        redo();
      } else if (e.key === "Escape") {
        setPopover(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editMode, undo, redo]);

  /* ─── Focus mode Escape key ─── */
  useEffect(() => {
    if (!isFocusMode) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !editMode) setIsFocusMode(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isFocusMode, editMode]);

  /* ─── Discard ─── */
  const discard = useCallback(() => {
    if (editBaselineRef.current) {
      dispatch({ type: "SET_STATE", payload: editBaselineRef.current });
      // Also restore activity cache
      setActivityCache(editBaselineRef.current.activities);
    }
    exitEditMode();
  }, [exitEditMode]);

  /* ─── Save ─── */
  const save = useCallback(async () => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    const baseline = editBaselineRef.current;
    if (!baseline) {
      exitEditMode();
      isSavingRef.current = false;
      return;
    }

    try {
      const promises: Promise<Response>[] = [];

      // Diff projects
      for (const proj of undoState.present.projects) {
        const orig = baseline.projects.find((p) => p.id === proj.id);
        if (!orig) continue;
        if (
          proj.startWeek !== orig.startWeek ||
          proj.endWeek !== orig.endWeek
        ) {
          promises.push(
            fetch(`/api/projects/${proj.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                startDate: weekToDate(proj.startWeek),
                endDate: weekToDate(proj.endWeek),
              }),
            })
          );
        }
      }

      // Diff activities
      for (const [projectId, activities] of Object.entries(
        undoState.present.activities
      )) {
        const origActivities = baseline.activities[projectId] || [];
        for (const act of activities) {
          const isNew = act.id.startsWith("temp_");
          const orig = origActivities.find((a) => a.id === act.id);

          if (isNew) {
            // New activity — POST
            promises.push(
              fetch(`/api/projects/${projectId}/activities`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: act.name,
                  startDate: weekToDate(act.start),
                  endDate: weekToDate(act.end),
                  status: "not_started",
                }),
              })
            );
          } else if (orig) {
            // Existing activity — check if changed
            if (act.start !== orig.start || act.end !== orig.end || act.name !== orig.name) {
              promises.push(
                fetch(`/api/projects/${projectId}/activities`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    activityId: act.id,
                    name: act.name,
                    startDate: weekToDate(act.start),
                    endDate: weekToDate(act.end),
                  }),
                })
              );
            }
          }
        }

        // Check for deleted activities
        for (const orig of origActivities) {
          if (!activities.find((a) => a.id === orig.id)) {
            promises.push(
              fetch(`/api/projects/${projectId}/activities?activityId=${orig.id}`, {
                method: "DELETE",
              })
            );
          }
        }
      }

      if (promises.length > 0) {
        const results = await Promise.all(promises);
        const failedCount = results.filter((r) => !r.ok).length;
        if (failedCount > 0) {
          toast.error(t("updatesFailed", { count: failedCount }));
        } else {
          toast.success(t("allChangesSaved"));
        }
      } else {
        toast.success(t("noChangesToSave"));
      }

      exitEditMode();
    } catch (error) {
      console.error("Error saving:", error);
      toast.error(t("failedToSave"));
    } finally {
      isSavingRef.current = false;
    }
  }, [undoState.present, weekToDate, exitEditMode]);

  /* ─── DRAG HANDLING (window-level listeners) ─── */
  const gridRef = useRef<HTMLDivElement>(null);
  const colWidthRef = useRef(COL_WIDTH);
  colWidthRef.current = COL_WIDTH;
  const undoStateRef = useRef(undoState.present);
  undoStateRef.current = undoState.present;

  const commitDrag = useCallback(() => {
    const d = dragRef.current;
    const delta = dragDeltaRef.current;

    // Always suppress click-to-create after any drag attempt
    justDraggedRef.current = true;
    setTimeout(() => { justDraggedRef.current = false; }, 100);

    if (!d || delta === 0) {
      dragRef.current = null;
      dragDeltaRef.current = 0;
      setDrag(null);
      setDragDelta(0);
      return;
    }

    let newStart = d.originalStartWeek;
    let newEnd = d.originalEndWeek;

    if (d.type === "move") {
      newStart = d.originalStartWeek + delta;
      newEnd = d.originalEndWeek + delta;
    } else if (d.type === "resize-left") {
      newStart = d.originalStartWeek + delta;
      if (newStart >= newEnd) newStart = newEnd - 1;
    } else if (d.type === "resize-right") {
      newEnd = d.originalEndWeek + delta;
      if (newEnd <= newStart) newEnd = newStart + 1;
    }

    const currentState = undoStateRef.current;
    let newState: TLState;

    if (d.entityType === "project") {
      newState = {
        ...currentState,
        projects: currentState.projects.map((p) =>
          p.id === d.entityId
            ? { ...p, startWeek: newStart, endWeek: newEnd }
            : p
        ),
      };
    } else {
      const projActivities =
        currentState.activities[d.projectId] || [];
      newState = {
        ...currentState,
        activities: {
          ...currentState.activities,
          [d.projectId]: projActivities.map((a) =>
            a.id === d.entityId
              ? { ...a, start: newStart, end: newEnd }
              : a
          ),
        },
      };
    }

    dispatch({ type: "UPDATE", payload: newState });

    if (d.entityType === "activity") {
      setActivityCache((prev) => ({
        ...prev,
        [d.projectId]: (prev[d.projectId] || []).map((a) =>
          a.id === d.entityId
            ? { ...a, start: newStart, end: newEnd }
            : a
        ),
      }));
    }

    dragRef.current = null;
    dragDeltaRef.current = 0;
    setDrag(null);
    setDragDelta(0);
  }, []);

  // Window-level mousemove/mouseup — always on during edit mode
  // Uses refs to avoid stale closure / timing gap between setDrag and useEffect
  useEffect(() => {
    if (!editMode) return;

    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const delta = Math.round(
        (e.clientX - d.startMouseX) / colWidthRef.current
      );
      if (delta !== dragDeltaRef.current) {
        dragDeltaRef.current = delta;
        setDragDelta(delta);
      }
    };

    const onUp = () => {
      if (!dragRef.current) return;
      commitDrag();
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [editMode, commitDrag]);

  const startDrag = useCallback(
    (
      e: React.MouseEvent,
      type: DragInfo["type"],
      entityType: "project" | "activity",
      entityId: string,
      projectId: string,
      startWeek: number,
      endWeek: number
    ) => {
      if (!editMode) return;
      e.preventDefault();
      e.stopPropagation();
      const info: DragInfo = {
        type,
        entityType,
        entityId,
        projectId,
        startMouseX: e.clientX,
        originalStartWeek: startWeek,
        originalEndWeek: endWeek,
      };
      dragRef.current = info;
      dragDeltaRef.current = 0;
      setDrag(info);
      setDragDelta(0);
    },
    [editMode]
  );

  // Compute dragged bar positions
  const getDraggedPosition = useCallback(
    (
      entityType: "project" | "activity",
      entityId: string,
      startW: number,
      endW: number
    ): { startWeek: number; endWeek: number } => {
      if (
        !drag ||
        drag.entityType !== entityType ||
        drag.entityId !== entityId
      ) {
        return { startWeek: startW, endWeek: endW };
      }
      let ns = startW;
      let ne = endW;
      if (drag.type === "move") {
        ns = drag.originalStartWeek + dragDelta;
        ne = drag.originalEndWeek + dragDelta;
      } else if (drag.type === "resize-left") {
        ns = drag.originalStartWeek + dragDelta;
        if (ns >= ne) ns = ne - 1;
      } else if (drag.type === "resize-right") {
        ne = drag.originalEndWeek + dragDelta;
        if (ne <= ns) ne = ns + 1;
      }
      return { startWeek: ns, endWeek: ne };
    },
    [drag, dragDelta]
  );

  /* ─── DOUBLE-CLICK POPOVER ─── */
  const handleDoubleClick = useCallback(
    (
      e: React.MouseEvent,
      entityType: "project" | "activity",
      entityId: string,
      projectId: string,
      name: string,
      startWeek: number,
      endWeek: number
    ) => {
      if (!editMode) return;
      const rect = e.currentTarget.getBoundingClientRect();
      setPopover({
        entityType,
        entityId,
        projectId,
        name,
        startWeek,
        endWeek,
        anchorRect: rect,
      });
    },
    [editMode]
  );

  const handlePopoverApply = useCallback(
    (newStart: number, newEnd: number, newName: string) => {
      if (!popover) return;
      const currentState = undoState.present;
      let newState: TLState;

      if (popover.entityType === "project") {
        newState = {
          ...currentState,
          projects: currentState.projects.map((p) =>
            p.id === popover.entityId
              ? { ...p, startWeek: newStart, endWeek: newEnd, name: newName }
              : p
          ),
        };
      } else {
        const projActivities =
          currentState.activities[popover.projectId] || [];
        newState = {
          ...currentState,
          activities: {
            ...currentState.activities,
            [popover.projectId]: projActivities.map((a) =>
              a.id === popover.entityId
                ? { ...a, start: newStart, end: newEnd, name: newName }
                : a
            ),
          },
        };
        setActivityCache((prev) => ({
          ...prev,
          [popover.projectId]: (prev[popover.projectId] || []).map(
            (a) =>
              a.id === popover.entityId
                ? { ...a, start: newStart, end: newEnd, name: newName }
                : a
          ),
        }));
      }

      dispatch({ type: "UPDATE", payload: newState });
      setPopover(null);
    },
    [popover, undoState.present]
  );

  const handlePopoverDelete = useCallback(() => {
    if (!popover) return;
    const currentState = undoState.present;
    let newState: TLState;
    const deleteName =
      popover.entityType === "project"
        ? allProjects.find((p) => p.id === popover.entityId)?.name || "Item"
        : "Activity";

    if (popover.entityType === "project") {
      newState = {
        ...currentState,
        projects: currentState.projects.filter(
          (p) => p.id !== popover.entityId
        ),
      };
      // Also clean up milestones for this project
      setLiveMilestones((prev) =>
        prev.filter((m) => m.projectId !== popover.entityId)
      );
    } else {
      const projActivities =
        currentState.activities[popover.projectId] || [];
      newState = {
        ...currentState,
        activities: {
          ...currentState.activities,
          [popover.projectId]: projActivities.filter(
            (a) => a.id !== popover.entityId
          ),
        },
      };
      setActivityCache((prev) => ({
        ...prev,
        [popover.projectId]: (prev[popover.projectId] || []).filter(
          (a) => a.id !== popover.entityId
        ),
      }));
    }

    dispatch({ type: "UPDATE", payload: newState });
    setPopover(null);
    toast.success(t("deletedItem", { name: deleteName }));
  }, [popover, undoState.present, allProjects]);

  /* ─── Add new activity ─── */
  const handleAddActivity = useCallback(
    (projectId: string, atWeek?: number) => {
      const proj = undoState.present.projects.find((p) => p.id === projectId);
      if (!proj) return;
      const start = atWeek ?? proj.startWeek;
      const end = start + 2;
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newAct: MActivity = {
        id: tempId,
        name: "New Activity",
        projectId,
        phase: "",
        start,
        end,
        _startDate: weekToDate(start),
        _endDate: weekToDate(end),
      };

      const currentState = undoState.present;
      const projActivities = currentState.activities[projectId] || activityCache[projectId] || [];
      const newState: TLState = {
        ...currentState,
        activities: {
          ...currentState.activities,
          [projectId]: [...projActivities, newAct],
        },
      };
      dispatch({ type: "UPDATE", payload: newState });
      setActivityCache((prev) => ({
        ...prev,
        [projectId]: [...(prev[projectId] || []), newAct],
      }));

      // Immediately open popover to name it
      setTimeout(() => {
        const barEl = document.querySelector(`[data-activity-id="${tempId}"]`);
        if (barEl) {
          const rect = barEl.getBoundingClientRect();
          setPopover({
            entityType: "activity",
            entityId: tempId,
            projectId,
            name: "New Activity",
            startWeek: start,
            endWeek: end,
            anchorRect: rect,
          });
        }
      }, 50);
    },
    [undoState.present, activityCache, weekToDate]
  );

  /* ─── Click on empty grid area to add activity ─── */
  const handleGridClick = useCallback(
    (e: React.MouseEvent, projectId: string) => {
      if (!editMode) return;
      // Suppress if we just finished a drag
      if (justDraggedRef.current) return;
      if (dragRef.current) return;
      // Only handle clicks on the background, not on existing bars
      if ((e.target as HTMLElement).closest("[data-activity-id]")) return;
      const gridRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const relX = e.clientX - gridRect.left;
      const weekClicked = Math.floor(relX / COL_WIDTH) + scrollOffset;
      handleAddActivity(projectId, weekClicked);
    },
    [editMode, COL_WIDTH, scrollOffset, handleAddActivity]
  );

  /* ─── Deadline CRUD (immediate API, not undo/redo) ─── */
  const handleSaveDeadline = useCallback(
    async (data: {
      projectId: string;
      milestoneId?: string;
      title: string;
      dueDate: string;
      completed?: boolean;
      type: "phase" | "custom";
      phaseId?: string | null;
      description?: string | null;
      icon?: DeadlineIcon | null;
      color?: string | null;
    }) => {
      try {
        const isUpdate = !!data.milestoneId;
        const url = `/api/projects/${data.projectId}/milestones`;
        const method = isUpdate ? "PUT" : "POST";
        const body = isUpdate
          ? {
              milestoneId: data.milestoneId,
              title: data.title,
              dueDate: data.dueDate,
              completed: data.completed,
              type: data.type,
              phaseId: data.phaseId,
              description: data.description,
              icon: data.icon,
              color: data.color,
            }
          : {
              title: data.title,
              dueDate: data.dueDate,
              type: data.type,
              phaseId: data.phaseId,
              description: data.description,
              icon: data.icon,
              color: data.color,
            };

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("Failed to save deadline");

        const saved = await res.json();
        const dueDateStr = saved.dueDate
          ? format(new Date(saved.dueDate), "yyyy-MM-dd")
          : data.dueDate;

        const savedMs: MilestoneWithWeek = {
          id: saved.id,
          projectId: saved.projectId || data.projectId,
          title: saved.title,
          dueDate: dueDateStr,
          completed: saved.completed ?? false,
          completedAt: saved.completedAt ?? null,
          sortOrder: saved.sortOrder ?? 0,
          type: saved.type || "custom",
          phaseId: saved.phaseId || null,
          phaseName: saved.phase?.name || null,
          phaseColor: saved.phase?.color || null,
          description: saved.description || null,
          icon: saved.icon || null,
          color: saved.color || null,
          week: dateToWeek(dueDateStr),
        };

        setLiveMilestones((prev) =>
          isUpdate
            ? prev.map((m) => (m.id === savedMs.id ? savedMs : m))
            : [...prev, savedMs]
        );
        toast.success(isUpdate ? t("deadlineUpdated") : t("deadlineCreated"));
      } catch (error) {
        console.error("Error saving deadline:", error);
        toast.error(t("failedToSaveDeadline"));
      }
    },
    [dateToWeek]
  );

  const handleDeleteDeadline = useCallback(
    async (milestoneId: string, projectId: string) => {
      try {
        const res = await fetch(
          `/api/projects/${projectId}/milestones?milestoneId=${milestoneId}`,
          { method: "DELETE" }
        );
        if (!res.ok) throw new Error("Failed to delete deadline");

        setLiveMilestones((prev) => prev.filter((m) => m.id !== milestoneId));
        toast.success(t("deadlineDeleted"));
      } catch (error) {
        console.error("Error deleting deadline:", error);
        toast.error(t("failedToDeleteDeadline"));
      }
    },
    []
  );

  const handleMilestoneClick = useCallback(
    (e: React.MouseEvent, milestone: MilestoneWithWeek, projectColor: string) => {
      e.stopPropagation();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setDeadlinePopover({
        open: true,
        position: { top: rect.bottom + 4, left: Math.max(16, rect.left - 100) },
        milestone,
        projectId: milestone.projectId,
        projectColor,
      });
    },
    []
  );

  const handleCreateDeadline = useCallback(
    (e: React.MouseEvent, projectId: string, projectColor: string, atWeek?: number) => {
      e.stopPropagation();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setDeadlinePopover({
        open: true,
        position: { top: rect.bottom + 4, left: Math.max(16, rect.left - 100) },
        milestone: null,
        projectId,
        projectColor,
        defaultDate: atWeek !== undefined ? weekToDate(atWeek) : undefined,
      });
    },
    [weekToDate]
  );

  /* ─── Mode badge ─── */
  const modeBadge = {
    overview: {
      label: t("overview"),
      bg: "#F0FDF4",
      fg: "#166534",
      ring: "#BBF7D0",
    },
    planning: {
      label: t("planning"),
      bg: "#EFF6FF",
      fg: "#1E40AF",
      ring: "#BFDBFE",
    },
    edit: {
      label: t("editing"),
      bg: "#FEF3C7",
      fg: "#92400E",
      ring: "#FDE68A",
    },
  }[viewMode];

  /* ─── Loading skeleton ─── */
  if (loading && allProjects.length === 0) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  /* ─── No projects ─── */
  if (!loading && allProjects.length === 0) {
    return (
      <div
        style={{
          fontFamily: "'DM Sans', 'Avenir Next', system-ui, sans-serif",
          background: "#FAFAF9",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#6B7280",
          fontSize: 16,
          fontWeight: 500,
        }}
      >
        {t("noProjects")}
      </div>
    );
  }

  /* ─── Get activities for a project ─── */
  const getActivities = (projectId: string): MActivity[] => {
    return (
      undoState.present.activities[projectId] ||
      activityCache[projectId] ||
      []
    );
  };

  /* ─── Get milestones for a project ─── */
  const getProjectMilestones = (projectId: string): MilestoneWithWeek[] => {
    return liveMilestones.filter((m) => m.projectId === projectId);
  };

  /* ─── Footer button style ─── */
  const btnStyle: React.CSSProperties = {
    padding: "6px 16px",
    borderRadius: 6,
    border: "none",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s",
  };

  return (
    <div
      ref={focusModeContainerRef}
      style={{
        fontFamily: "'DM Sans', 'Avenir Next', system-ui, sans-serif",
        background: "#FAFAF9",
        color: "#1F2937",
        ...(isFocusMode
          ? {
              position: "fixed" as const,
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              zIndex: 9999,
              overflow: "auto",
            }
          : { minHeight: "100vh" }),
      }}
    >
      {/* Google Font */}
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />

      {/* ══════════════════════════════════
          TOP BAR
         ══════════════════════════════════ */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 28px",
          borderBottom: "1px solid #E5E7EB",
          background: "#fff",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        {/* Left cluster */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <h1
            style={{
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            {t("title")}
          </h1>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "3px 10px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              background: modeBadge.bg,
              color: modeBadge.fg,
              border: `1px solid ${modeBadge.ring}`,
              transition: "all 0.25s ease",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                background: modeBadge.fg,
                opacity: viewMode === "edit" ? 1 : 0.6,
                animation:
                  viewMode === "edit"
                    ? "pulse 1.5s ease infinite"
                    : "none",
              }}
            />
            {modeBadge.label}
          </span>
        </div>

        {/* Center: navigation */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <NavBtn onClick={handlePrev} label={"\u2190"} />
          <NavBtn onClick={handleToday} label={t("today")} wide />
          <NavBtn onClick={handleNext} label={"\u2192"} />
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "#6B7280",
              marginLeft: 8,
              fontVariantNumeric: "tabular-nums",
              minWidth: 160,
              textAlign: "center",
            }}
          >
            {weekToLabel(scrollOffset)}
            {" \u2014 "}
            {weekToLabel(scrollOffset + VISIBLE_COLS - 1)}
          </span>
        </div>

        {/* Right cluster */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* View scale toggle */}
          <div
            style={{
              display: "flex",
              borderRadius: 6,
              border: "1px solid #E5E7EB",
              overflow: "hidden",
            }}
          >
            {(["day", "week", "month", "year"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setViewScale(s)}
                style={{
                  padding: "5px 14px",
                  fontSize: 11,
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  background: viewScale === s ? "#1F2937" : "#fff",
                  color: viewScale === s ? "#fff" : "#6B7280",
                  transition: "all 0.2s ease",
                }}
              >
                {s === "day" ? t("viewDay") : s === "week" ? t("viewWeek") : s === "month" ? t("viewMonth") : t("viewYear")}
              </button>
            ))}
          </div>

          {/* Filter button */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              style={{
                padding: "5px 14px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                border: activeFilterCount > 0 ? "1.5px solid #3B82F6" : "1.5px solid #E5E7EB",
                background: activeFilterCount > 0 ? "#EFF6FF" : "#fff",
                color: activeFilterCount > 0 ? "#2563EB" : "#6B7280",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.2s ease",
              }}
            >
              {"\u2630"} {t("filter")}
              {activeFilterCount > 0 && (
                <span
                  style={{
                    background: "#2563EB",
                    color: "#fff",
                    borderRadius: 99,
                    fontSize: 10,
                    fontWeight: 700,
                    width: 18,
                    height: 18,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>

            {filterOpen && (
              <>
                <div
                  onClick={() => setFilterOpen(false)}
                  style={{ position: "fixed", inset: 0, zIndex: 98 }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    right: 0,
                    width: 240,
                    background: "#fff",
                    borderRadius: 10,
                    boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
                    border: "1px solid #E5E7EB",
                    padding: 14,
                    zIndex: 99,
                    fontFamily: "'DM Sans', 'Avenir Next', system-ui, sans-serif",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Phase filter */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 4 }}>
                      {t("filterPhase")}
                    </label>
                    <select
                      value={filterPhase}
                      onChange={(e) => setFilterPhase(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid #E5E7EB",
                        fontSize: 12,
                        color: "#1F2937",
                        background: "#fff",
                        outline: "none",
                        cursor: "pointer",
                      }}
                    >
                      <option value="all">{t("allPhases")}</option>
                      {uniquePhases.map((phase) => (
                        <option key={phase} value={phase}>{phase}</option>
                      ))}
                    </select>
                  </div>

                  {/* Client filter */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 4 }}>
                      {t("filterClient")}
                    </label>
                    <select
                      value={filterClient}
                      onChange={(e) => setFilterClient(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid #E5E7EB",
                        fontSize: 12,
                        color: "#1F2937",
                        background: "#fff",
                        outline: "none",
                        cursor: "pointer",
                      }}
                    >
                      <option value="all">{t("allClientsFilter")}</option>
                      {uniqueClients.map((client) => (
                        <option key={client} value={client}>{client}</option>
                      ))}
                    </select>
                  </div>

                  {/* Clear button */}
                  {activeFilterCount > 0 && (
                    <button
                      onClick={() => {
                        setFilterPhase("all");
                        setFilterClient("all");
                      }}
                      style={{
                        width: "100%",
                        padding: "6px 0",
                        borderRadius: 6,
                        border: "1px solid #E5E7EB",
                        background: "#F9FAFB",
                        color: "#6B7280",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      {t("clearFilters")}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Focus mode toggle */}
          <button
            onClick={() => setIsFocusMode((v) => !v)}
            style={{
              padding: "6px 16px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              border: isFocusMode
                ? "1.5px solid #6366F1"
                : "1.5px solid #E5E7EB",
              background: isFocusMode ? "#EEF2FF" : "#fff",
              color: isFocusMode ? "#4338CA" : "#374151",
              cursor: "pointer",
              transition: "all 0.25s ease",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {isFocusMode ? (
              <>
                <span style={{ fontSize: 13 }}>{"\u2716"}</span> {t("exitFocus")}
              </>
            ) : (
              <>
                <span style={{ fontSize: 13 }}>{"\u26F6"}</span> {t("focusMode")}
              </>
            )}
          </button>

          {/* Edit toggle */}
          <button
            onClick={() => {
              if (editMode) {
                if (changeCount > 0) {
                  // prompt is handled by footer; just toggle Done
                  exitEditMode();
                } else {
                  exitEditMode();
                }
              } else {
                enterEditMode();
              }
            }}
            style={{
              padding: "6px 16px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              border: editMode
                ? "1.5px solid #D97706"
                : "1.5px solid #E5E7EB",
              background: editMode ? "#FFFBEB" : "#fff",
              color: editMode ? "#92400E" : "#374151",
              cursor: "pointer",
              transition: "all 0.25s ease",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {editMode ? (
              <>
                <span style={{ fontSize: 13 }}>{"\u2713"}</span> {t("doneEditing")}
              </>
            ) : (
              <>
                <span style={{ fontSize: 11 }}>{"\u270E"}</span> {t("editTimeline")}
              </>
            )}
          </button>
        </div>
      </header>

      {/* ══════════════════════════════════
          TIMELINE BODY
         ══════════════════════════════════ */}
      <div
        style={{ display: "flex", overflow: "hidden" }}
      >
        {/* ─── LEFT COLUMN ─── */}
        <div
          style={{
            width: LEFT_COL,
            flexShrink: 0,
            borderRight: "1px solid #E5E7EB",
            background: "#fff",
            zIndex: 10,
          }}
        >
          {/* Header cell */}
          <div
            style={{
              height: 44,
              borderBottom: "1px solid #E5E7EB",
              display: "flex",
              alignItems: "center",
              padding: "0 20px",
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "#9CA3AF",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {t("projects")}
            </span>
          </div>

          {/* Project rows */}
          {projects.map((proj) => {
            const isExpanded = expandedProject === proj.id;
            const isCollapsed = expandedProject !== null && !isExpanded;
            const activities = getActivities(proj.id);
            return (
              <div
                key={proj.id}
                style={{
                  borderBottom: "1px solid #F3F4F6",
                  transition:
                    "all 0.35s cubic-bezier(0.4,0,0.2,1)",
                  opacity: isCollapsed ? 0.45 : 1,
                  background: isExpanded ? "#FAFAF9" : "#fff",
                }}
              >
                <div
                  onClick={() => handleExpand(proj.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "0 20px",
                    height: isCollapsed ? 48 : 72,
                    cursor: editMode ? "default" : "pointer",
                    transition: "background 0.15s, height 0.3s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!editMode)
                      e.currentTarget.style.background =
                        "#F9FAFB";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      isExpanded ? "#FAFAF9" : "#fff";
                  }}
                >
                  {/* Color dot */}
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 3,
                      background: proj.color,
                      flexShrink: 0,
                    }}
                  />

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        lineHeight: 1.3,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {proj.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#9CA3AF",
                        marginTop: 1,
                      }}
                    >
                      {proj.client}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 6,
                      }}
                    >
                      {proj.currentPhase && (
                        <PhaseBadge
                          name={proj.currentPhase}
                          color={
                            proj.phases.find(
                              (p) =>
                                p.name === proj.currentPhase
                            )?.color
                          }
                        />
                      )}
                      <BudgetBar health={proj.budgetHealth} />
                      <ConflictBadge count={proj.conflicts} />
                    </div>
                  </div>

                  {/* Chevron */}
                  {!editMode && (
                    <span
                      style={{
                        fontSize: 12,
                        color: "#9CA3AF",
                        transition: "transform 0.3s ease",
                        transform: isExpanded
                          ? "rotate(90deg)"
                          : "rotate(0deg)",
                      }}
                    >
                      {"\u25B8"}
                    </span>
                  )}
                </div>

                {/* Expanded: activity list in left column */}
                <div
                  style={{
                    maxHeight: isExpanded ? 600 : 0,
                    overflow: "hidden",
                    transition:
                      "max-height 0.45s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease",
                    opacity: isExpanded ? 1 : 0,
                  }}
                >
                  <div style={{ padding: "0 20px 12px 40px" }}>
                    {proj.phases.length > 0
                      ? proj.phases.map((phase) => {
                          const acts = activities.filter(
                            (a) => a.phase === phase.name
                          );
                          return (
                            <div
                              key={phase.name}
                              style={{ marginBottom: 4 }}
                            >
                              <div
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  color: "#9CA3AF",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.08em",
                                  height: 24,
                                  display: "flex",
                                  alignItems: "center",
                                }}
                              >
                                {phase.name}
                              </div>
                              {acts.map((act) => (
                                <div
                                  key={act.id}
                                  style={{
                                    fontSize: 11,
                                    color: "#6B7280",
                                    height: 28,
                                    marginBottom: 3,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                  }}
                                >
                                  <span
                                    style={{
                                      width: 4,
                                      height: 4,
                                      borderRadius: 2,
                                      background: proj.color,
                                      opacity: 0.5,
                                    }}
                                  />
                                  {act.name}
                                </div>
                              ))}
                            </div>
                          );
                        })
                      : activities.map((act) => (
                          <div
                            key={act.id}
                            style={{
                              fontSize: 11,
                              color: "#6B7280",
                              height: 28,
                              marginBottom: 3,
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <span
                              style={{
                                width: 4,
                                height: 4,
                                borderRadius: 2,
                                background: proj.color,
                                opacity: 0.5,
                              }}
                            />
                            {act.name}
                          </div>
                        ))}

                    {/* Add activity button (edit mode) */}
                    {editMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddActivity(proj.id);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11,
                          color: proj.color,
                          padding: "4px 0",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontWeight: 500,
                          opacity: 0.7,
                          transition: "opacity 0.15s",
                          marginTop: 4,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
                      >
                        <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
                        {t("addActivity")}
                      </button>
                    )}
                    {editMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCreateDeadline(e, proj.id, proj.color);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11,
                          color: proj.color,
                          padding: "4px 0",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontWeight: 500,
                          opacity: 0.7,
                          transition: "opacity 0.15s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
                      >
                        <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
                        {t("addDeadline")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── GRID AREA ─── */}
        <div ref={gridRef} style={{ flex: 1, overflowX: "auto" }}>
          {/* Week headers */}
          <div
            style={{
              display: "flex",
              height: 44,
              borderBottom: "1px solid #E5E7EB",
              background: "#fff",
              zIndex: 5,
            }}
          >
            {weekNumbers.map((w) => {
              const isToday = w === TODAY_WEEK;
              let topLabel: string;
              let bottomLabel: string;

              if (viewScale === "day") {
                const d = addDays(DAY_ANCHOR, w);
                const dayOfWeek = d.getDay(); // 0=Sun, 6=Sat
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                const dayNames = ["S", "M", "T", "W", "T", "F", "S"];
                topLabel = isToday ? t("today") : dayNames[dayOfWeek];
                bottomLabel = format(d, "d");

                return (
                  <div
                    key={w}
                    style={{
                      width: COL_WIDTH,
                      flexShrink: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRight: "1px solid #F3F4F6",
                      background: isToday
                        ? "#FFFBEB"
                        : isWeekend
                        ? "#F9FAFB"
                        : "transparent",
                      opacity: isWeekend && !isToday ? 0.6 : 1,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 600,
                        color: isToday ? "#D97706" : "#9CA3AF",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {topLabel}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: isToday ? "#92400E" : "#6B7280",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {bottomLabel}
                    </span>
                  </div>
                );
              }

              topLabel = isToday ? t("today") : `W${w + 1}`;
              bottomLabel = weekToLabel(w);

              return (
                <div
                  key={w}
                  style={{
                    width: COL_WIDTH,
                    flexShrink: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRight: "1px solid #F3F4F6",
                    background: isToday ? "#FFFBEB" : "transparent",
                  }}
                >
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      color: isToday ? "#D97706" : "#9CA3AF",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {topLabel}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: isToday ? "#92400E" : "#6B7280",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {bottomLabel}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Project rows */}
          {projects.map((proj) => {
            const isExpanded = expandedProject === proj.id;
            const isCollapsed =
              expandedProject !== null && !isExpanded;
            const activities = getActivities(proj.id);
            const projectMilestones = getProjectMilestones(
              proj.id
            );

            // Apply drag preview for project bar
            const { startWeek: pStart, endWeek: pEnd } =
              getDraggedPosition(
                "project",
                proj.id,
                proj.startWeek,
                proj.endWeek
              );
            const isDraggingThisProject =
              drag?.entityType === "project" &&
              drag?.entityId === proj.id &&
              dragDelta !== 0;

            return (
              <div
                key={proj.id}
                style={{
                  borderBottom: "1px solid #F3F4F6",
                  transition:
                    "all 0.35s cubic-bezier(0.4,0,0.2,1)",
                  opacity: isCollapsed ? 0.35 : 1,
                }}
              >
                {/* Overview bar row */}
                <div
                  style={{
                    position: "relative",
                    height: isCollapsed ? 48 : 72,
                    transition: "height 0.3s ease",
                  }}
                >
                  {/* Grid lines */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                    }}
                  >
                    {weekNumbers.map((w) => {
                      const isWeekendCell = viewScale === "day" && (() => {
                        const d = addDays(DAY_ANCHOR, w);
                        const dow = d.getDay();
                        return dow === 0 || dow === 6;
                      })();
                      return (
                        <div
                          key={w}
                          style={{
                            width: COL_WIDTH,
                            flexShrink: 0,
                            borderRight: "1px solid #F9FAFB",
                            background:
                              w === TODAY_WEEK
                                ? "rgba(251,191,36,0.06)"
                                : isWeekendCell
                                ? "rgba(0,0,0,0.02)"
                                : "transparent",
                          }}
                        />
                      );
                    })}
                  </div>

                  {/* Today line */}
                  {TODAY_WEEK >= scrollOffset &&
                    TODAY_WEEK <
                      scrollOffset + VISIBLE_COLS && (
                      <div
                        style={{
                          position: "absolute",
                          left:
                            (TODAY_WEEK - scrollOffset) *
                              COL_WIDTH +
                            COL_WIDTH / 2,
                          top: 0,
                          bottom: 0,
                          width: 2,
                          background: "#F59E0B",
                          opacity: 0.4,
                          zIndex: 3,
                        }}
                      />
                    )}

                  {/* Ghost bar (original position during drag) */}
                  {isDraggingThisProject &&
                    drag.originalStartWeek <
                      scrollOffset + VISIBLE_COLS &&
                    drag.originalEndWeek > scrollOffset && (
                      <div
                        style={{
                          position: "absolute",
                          left: Math.max(
                            0,
                            (drag.originalStartWeek -
                              scrollOffset) *
                              COL_WIDTH
                          ),
                          width:
                            (Math.min(
                              drag.originalEndWeek,
                              scrollOffset + VISIBLE_COLS
                            ) -
                              Math.max(
                                drag.originalStartWeek,
                                scrollOffset
                              )) *
                            COL_WIDTH,
                          top: isCollapsed ? 16 : 24,
                          height: isCollapsed ? 16 : 24,
                          borderRadius: isCollapsed ? 4 : 6,
                          background: proj.color,
                          opacity: 0.2,
                          border: `1px dashed ${proj.color}`,
                          zIndex: 1,
                        }}
                      />
                    )}

                  {/* Project bar */}
                  {pStart < scrollOffset + VISIBLE_COLS &&
                    pEnd > scrollOffset && (
                      <div
                        onMouseDown={(e) =>
                          startDrag(
                            e,
                            "move",
                            "project",
                            proj.id,
                            proj.id,
                            proj.startWeek,
                            proj.endWeek
                          )
                        }
                        onDoubleClick={(e) =>
                          handleDoubleClick(
                            e,
                            "project",
                            proj.id,
                            proj.id,
                            proj.name,
                            pStart,
                            pEnd
                          )
                        }
                        style={{
                          position: "absolute",
                          left: Math.max(
                            0,
                            (pStart - scrollOffset) *
                              COL_WIDTH
                          ),
                          right: "auto",
                          width:
                            (Math.min(
                              pEnd,
                              scrollOffset + VISIBLE_COLS
                            ) -
                              Math.max(
                                pStart,
                                scrollOffset
                              )) *
                            COL_WIDTH,
                          top: isCollapsed ? 16 : 24,
                          height: isCollapsed ? 16 : 24,
                          borderRadius: isCollapsed ? 4 : 6,
                          background: proj.color,
                          opacity: isExpanded ? 0.15 : 0.85,
                          transition: isDraggingThisProject
                            ? "none"
                            : "all 0.35s ease",
                          zIndex: 2,
                          cursor: editMode ? "move" : "default",
                        }}
                      >
                        {/* Drag handles in edit mode */}
                        {editMode && !isCollapsed && (
                          <>
                            <div
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                startDrag(
                                  e,
                                  "resize-left",
                                  "project",
                                  proj.id,
                                  proj.id,
                                  proj.startWeek,
                                  proj.endWeek
                                );
                              }}
                              style={{
                                position: "absolute",
                                left: -1,
                                top: 0,
                                bottom: 0,
                                width: 6,
                                borderRadius:
                                  "6px 0 0 6px",
                                background: proj.color,
                                cursor: "ew-resize",
                                opacity: 0.9,
                              }}
                            />
                            <div
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                startDrag(
                                  e,
                                  "resize-right",
                                  "project",
                                  proj.id,
                                  proj.id,
                                  proj.startWeek,
                                  proj.endWeek
                                );
                              }}
                              style={{
                                position: "absolute",
                                right: -1,
                                top: 0,
                                bottom: 0,
                                width: 6,
                                borderRadius:
                                  "0 6px 6px 0",
                                background: proj.color,
                                cursor: "ew-resize",
                                opacity: 0.9,
                              }}
                            />
                          </>
                        )}
                      </div>
                    )}

                  {/* Key deadline diamond (overview only) */}
                  {!isExpanded &&
                    proj.keyDeadline &&
                    proj.keyDeadline.week >= scrollOffset &&
                    proj.keyDeadline.week <
                      scrollOffset + VISIBLE_COLS && (
                      <div
                        style={{
                          position: "absolute",
                          left:
                            (proj.keyDeadline.week -
                              scrollOffset) *
                              COL_WIDTH +
                            COL_WIDTH / 2 -
                            6,
                          top: isCollapsed ? 10 : 18,
                          width: 12,
                          height: 12,
                          background: "#DC2626",
                          borderRadius: 2,
                          transform: "rotate(45deg)",
                          zIndex: 4,
                          boxShadow:
                            "0 1px 3px rgba(220,38,38,0.3)",
                          cursor: "pointer",
                        }}
                        title={proj.keyDeadline.label}
                        onClick={(e) => {
                          e.stopPropagation();
                          const ms = liveMilestones.find(
                            (m) => m.id === proj.keyDeadline!.milestoneId
                          );
                          if (ms) {
                            handleMilestoneClick(e, ms, proj.color);
                          }
                        }}
                      />
                    )}

                  {/* Conflict badge on bar */}
                  {!isCollapsed && proj.conflicts > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        left:
                          Math.max(
                            0,
                            (proj.startWeek -
                              scrollOffset) *
                              COL_WIDTH
                          ) - 6,
                        top: isCollapsed ? 10 : 16,
                        zIndex: 5,
                      }}
                    >
                      <ConflictBadge count={proj.conflicts} />
                    </div>
                  )}
                </div>

                {/* Expanded: phases + activities */}
                <div
                  style={{
                    maxHeight: isExpanded ? 600 : 0,
                    overflow: "hidden",
                    transition:
                      "max-height 0.45s cubic-bezier(0.4,0,0.2,1)",
                  }}
                >
                  {isExpanded && (
                    <div
                      onClick={(e) => handleGridClick(e, proj.id)}
                      style={{
                        position: "relative",
                        paddingBottom: 16,
                        cursor: editMode ? "crosshair" : "default",
                      }}
                    >
                      {/* Phase background bands */}
                      {proj.phases.map((phase) => {
                        if (
                          phase.end <= scrollOffset ||
                          phase.start >=
                            scrollOffset + VISIBLE_COLS
                        )
                          return null;
                        return (
                          <div
                            key={phase.name}
                            style={{
                              position: "absolute",
                              left: Math.max(
                                0,
                                (phase.start -
                                  scrollOffset) *
                                  COL_WIDTH
                              ),
                              width:
                                (Math.min(
                                  phase.end,
                                  scrollOffset +
                                    VISIBLE_COLS
                                ) -
                                  Math.max(
                                    phase.start,
                                    scrollOffset
                                  )) *
                                COL_WIDTH,
                              top: 0,
                              bottom: 0,
                              background: phase.color,
                              opacity: 0.12,
                              borderRadius: 4,
                            }}
                          />
                        );
                      })}

                      {/* Phase labels */}
                      <div
                        style={{
                          position: "relative",
                          height: 24,
                          marginBottom: 4,
                        }}
                      >
                        {proj.phases.map((phase) => {
                          const left = Math.max(
                            0,
                            (phase.start - scrollOffset) *
                              COL_WIDTH
                          );
                          const width =
                            (Math.min(
                              phase.end,
                              scrollOffset + VISIBLE_COLS
                            ) -
                              Math.max(
                                phase.start,
                                scrollOffset
                              )) *
                            COL_WIDTH;
                          if (width <= 0) return null;
                          return (
                            <div
                              key={phase.name}
                              style={{
                                position: "absolute",
                                left: left + 8,
                                top: 4,
                                fontSize: 9,
                                fontWeight: 700,
                                color: proj.color,
                                opacity: 0.7,
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {phase.name}
                            </div>
                          );
                        })}
                      </div>

                      {/* Activity bars */}
                      {activities.map((act, i) => {
                        // Apply drag preview for activity
                        const {
                          startWeek: aStart,
                          endWeek: aEnd,
                        } = getDraggedPosition(
                          "activity",
                          act.id,
                          act.start,
                          act.end
                        );
                        const isDraggingThisActivity =
                          drag?.entityType === "activity" &&
                          drag?.entityId === act.id &&
                          dragDelta !== 0;

                        if (
                          aEnd <= scrollOffset &&
                          !isDraggingThisActivity
                        )
                          return null;
                        if (
                          aStart >=
                            scrollOffset + VISIBLE_COLS &&
                          !isDraggingThisActivity
                        )
                          return null;

                        const left = Math.max(
                          0,
                          (aStart - scrollOffset) *
                            COL_WIDTH
                        );
                        const width =
                          (Math.min(
                            aEnd,
                            scrollOffset + VISIBLE_COLS
                          ) -
                            Math.max(
                              aStart,
                              scrollOffset
                            )) *
                          COL_WIDTH;
                        const isHovered =
                          hoveredActivity ===
                          `${proj.id}-${i}`;

                        return (
                          <div
                            key={act.id}
                            style={{
                              position: "relative",
                              height: 28,
                              marginBottom: 3,
                            }}
                          >
                            {/* Ghost bar during drag */}
                            {isDraggingThisActivity &&
                              drag.originalStartWeek <
                                scrollOffset +
                                  VISIBLE_COLS &&
                              drag.originalEndWeek >
                                scrollOffset && (
                                <div
                                  style={{
                                    position: "absolute",
                                    left: Math.max(
                                      0,
                                      (drag.originalStartWeek -
                                        scrollOffset) *
                                        COL_WIDTH
                                    ),
                                    width:
                                      (Math.min(
                                        drag.originalEndWeek,
                                        scrollOffset +
                                          VISIBLE_COLS
                                      ) -
                                        Math.max(
                                          drag.originalStartWeek,
                                          scrollOffset
                                        )) *
                                        COL_WIDTH -
                                      4,
                                    height: 22,
                                    top: 3,
                                    borderRadius: 5,
                                    background:
                                      proj.color,
                                    opacity: 0.2,
                                    border: `1px dashed ${proj.color}`,
                                    zIndex: 1,
                                  }}
                                />
                              )}

                            <div
                              data-activity-id={act.id}
                              onMouseEnter={() =>
                                setHoveredActivity(
                                  `${proj.id}-${i}`
                                )
                              }
                              onMouseLeave={() =>
                                setHoveredActivity(null)
                              }
                              onMouseDown={(e) =>
                                startDrag(
                                  e,
                                  "move",
                                  "activity",
                                  act.id,
                                  proj.id,
                                  act.start,
                                  act.end
                                )
                              }
                              onDoubleClick={(e) =>
                                handleDoubleClick(
                                  e,
                                  "activity",
                                  act.id,
                                  proj.id,
                                  act.name,
                                  aStart,
                                  aEnd
                                )
                              }
                              style={{
                                position: "absolute",
                                left,
                                width: Math.max(
                                  width - 4,
                                  16
                                ),
                                height: 22,
                                top: 3,
                                borderRadius: 5,
                                background: isHovered
                                  ? proj.color
                                  : `${proj.color}CC`,
                                display: "flex",
                                alignItems: "center",
                                paddingLeft: 8,
                                cursor: editMode
                                  ? "move"
                                  : "pointer",
                                transition:
                                  isDraggingThisActivity
                                    ? "none"
                                    : "background 0.15s, box-shadow 0.15s",
                                boxShadow: isHovered
                                  ? `0 2px 8px ${proj.color}40`
                                  : "none",
                                zIndex: 3,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 500,
                                  color: "#fff",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow:
                                    "ellipsis",
                                }}
                              >
                                {act.name}
                              </span>

                              {/* Edit drag handles */}
                              {editMode && (
                                <>
                                  <div
                                    onMouseDown={(
                                      e
                                    ) => {
                                      e.stopPropagation();
                                      startDrag(
                                        e,
                                        "resize-left",
                                        "activity",
                                        act.id,
                                        proj.id,
                                        act.start,
                                        act.end
                                      );
                                    }}
                                    style={{
                                      position:
                                        "absolute",
                                      left: 0,
                                      top: 0,
                                      bottom: 0,
                                      width: 5,
                                      borderRadius:
                                        "5px 0 0 5px",
                                      background:
                                        "rgba(255,255,255,0.4)",
                                      cursor: "ew-resize",
                                    }}
                                  />
                                  <div
                                    onMouseDown={(
                                      e
                                    ) => {
                                      e.stopPropagation();
                                      startDrag(
                                        e,
                                        "resize-right",
                                        "activity",
                                        act.id,
                                        proj.id,
                                        act.start,
                                        act.end
                                      );
                                    }}
                                    style={{
                                      position:
                                        "absolute",
                                      right: 0,
                                      top: 0,
                                      bottom: 0,
                                      width: 5,
                                      borderRadius:
                                        "0 5px 5px 0",
                                      background:
                                        "rgba(255,255,255,0.4)",
                                      cursor: "ew-resize",
                                    }}
                                  />
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Add activity row (edit mode) */}
                      {editMode && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            if (justDraggedRef.current) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            const relX = e.clientX - rect.left;
                            const weekClicked = Math.floor(relX / COL_WIDTH) + scrollOffset;
                            handleAddActivity(proj.id, weekClicked);
                          }}
                          style={{
                            position: "relative",
                            height: 28,
                            marginBottom: 3,
                            borderRadius: 5,
                            border: "1px dashed #D1D5DB",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            transition: "all 0.15s",
                            opacity: 0.5,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = "0.8";
                            e.currentTarget.style.borderColor = proj.color;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = "0.5";
                            e.currentTarget.style.borderColor = "#D1D5DB";
                          }}
                        >
                          <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>
                            + Click to add activity
                          </span>
                        </div>
                      )}

                      {/* Milestones (DeadlineMarker) */}
                      <div
                        style={{
                          position: "relative",
                          height: 32,
                          marginTop: 4,
                        }}
                        onDoubleClick={(e) => {
                          if (!editMode) return;
                          if ((e.target as HTMLElement).closest("[data-milestone-id]")) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const relX = e.clientX - rect.left;
                          const weekClicked = Math.floor(relX / COL_WIDTH) + scrollOffset;
                          handleCreateDeadline(e, proj.id, proj.color, weekClicked);
                        }}
                      >
                        {projectMilestones.map((ms) => {
                          if (
                            ms.week < scrollOffset ||
                            ms.week >= scrollOffset + VISIBLE_COLS
                          )
                            return null;
                          return (
                            <div
                              key={ms.id}
                              data-milestone-id={ms.id}
                              style={{
                                position: "absolute",
                                left: (ms.week - scrollOffset) * COL_WIDTH,
                                top: 0,
                                width: COL_WIDTH,
                                height: 32,
                                zIndex: 4,
                              }}
                            >
                              <DeadlineMarker
                                milestone={ms}
                                projectColor={proj.color}
                                onClick={(e) => handleMilestoneClick(e, ms, proj.color)}
                              />
                            </div>
                          );
                        })}

                        {/* Add deadline button (edit mode) */}
                        {editMode && (
                          <button
                            onClick={(e) => handleCreateDeadline(e, proj.id, proj.color)}
                            style={{
                              position: "absolute",
                              right: 8,
                              top: 6,
                              display: "flex",
                              alignItems: "center",
                              gap: 3,
                              fontSize: 10,
                              color: proj.color,
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontWeight: 500,
                              opacity: 0.5,
                              transition: "opacity 0.15s",
                              zIndex: 5,
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.5"; }}
                            title={t("addDeadline")}
                          >
                            + {t("deadline")}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Double-click popover ── */}
      {popover && (
        <PopoverEditor
          popover={popover}
          onApply={handlePopoverApply}
          onDelete={handlePopoverDelete}
          onClose={() => setPopover(null)}
        />
      )}

      {/* ── Deadline popover ── */}
      {deadlinePopover.open && deadlinePopover.position && (
        <DeadlinePopover
          open={deadlinePopover.open}
          position={deadlinePopover.position}
          milestone={deadlinePopover.milestone}
          projectId={deadlinePopover.projectId}
          projectColor={deadlinePopover.projectColor}
          companyPhases={companyPhases}
          existingPhaseDeadlines={
            phaseDeadlinesByProject[deadlinePopover.projectId] || []
          }
          defaultDate={deadlinePopover.defaultDate}
          onSave={(payload) => {
            handleSaveDeadline(payload);
            setDeadlinePopover((prev) => ({ ...prev, open: false }));
          }}
          onDelete={(milestoneId, projectId) => {
            handleDeleteDeadline(milestoneId, projectId);
            setDeadlinePopover((prev) => ({ ...prev, open: false }));
          }}
          onClose={() =>
            setDeadlinePopover((prev) => ({ ...prev, open: false }))
          }
        />
      )}

      {/* ── Edit mode footer ── */}
      {editMode && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            height: 52,
            background: "#FFFBEB",
            borderTop: "2px solid #FDE68A",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            zIndex: 50,
            animation: "slideUp 0.3s ease",
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: "#92400E",
              fontWeight: 500,
            }}
          >
            {"\u270E"} {changeCount} {changeCount !== 1 ? t("unsavedChanges") : t("unsavedChange")}
          </span>
          <button
            onClick={undo}
            disabled={undoState.past.length === 0}
            style={{
              ...btnStyle,
              background:
                undoState.past.length === 0
                  ? "#F3F4F6"
                  : "#fff",
              color:
                undoState.past.length === 0
                  ? "#9CA3AF"
                  : "#374151",
              border: "1px solid #E5E7EB",
              cursor:
                undoState.past.length === 0
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {t("undoAction")}
          </button>
          <button
            onClick={redo}
            disabled={undoState.future.length === 0}
            style={{
              ...btnStyle,
              background:
                undoState.future.length === 0
                  ? "#F3F4F6"
                  : "#fff",
              color:
                undoState.future.length === 0
                  ? "#9CA3AF"
                  : "#374151",
              border: "1px solid #E5E7EB",
              cursor:
                undoState.future.length === 0
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {t("redoAction")}
          </button>
          <button
            onClick={discard}
            style={{
              ...btnStyle,
              border: "1px solid #D97706",
              background: "transparent",
              color: "#92400E",
            }}
          >
            {t("discardChanges")}
          </button>
          <button
            onClick={save}
            disabled={changeCount === 0}
            style={{
              ...btnStyle,
              background:
                changeCount === 0 ? "#E5E7EB" : "#D97706",
              color: changeCount === 0 ? "#9CA3AF" : "#fff",
              cursor:
                changeCount === 0 ? "not-allowed" : "pointer",
            }}
          >
            {t("saveChanges")}
          </button>
        </div>
      )}

      {/* ── Legend (bottom-left) ── */}
      <div
        style={{
          position: "fixed",
          bottom: editMode ? 64 : 16,
          left: 20,
          display: "flex",
          gap: 16,
          fontSize: 10,
          color: "#9CA3AF",
          background: "rgba(255,255,255,0.9)",
          padding: "6px 12px",
          borderRadius: 6,
          border: "1px solid #F3F4F6",
          transition: "bottom 0.3s ease",
          zIndex: 40,
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span
            style={{
              width: 14,
              height: 0,
              borderTop: "2px dashed #6366F1",
              display: "inline-block",
            }}
          />{" "}
          {t("phaseDeadline")}
        </span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span
            style={{
              width: 14,
              height: 0,
              borderTop: "2px dotted #F59E0B",
              display: "inline-block",
            }}
          />{" "}
          {t("customDeadline")}
        </span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span
            style={{
              width: 18,
              height: 6,
              background: "#6B7280",
              borderRadius: 3,
              display: "inline-block",
              opacity: 0.5,
            }}
          />{" "}
          {t("projectBar")}
        </span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <ConflictBadge count={1} /> {t("conflict")}
        </span>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────
   POPOVER EDITOR COMPONENT
   ───────────────────────────────────────────── */

function PopoverEditor({
  popover,
  onApply,
  onDelete,
  onClose,
}: {
  popover: PopoverState;
  onApply: (newStart: number, newEnd: number, newName: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("timeline");
  const [name, setName] = useState(popover.name);
  const [startWeek, setStartWeek] = useState(popover.startWeek);
  const [endWeek, setEndWeek] = useState(popover.endWeek);

  const handleApply = () => {
    if (endWeek <= startWeek) {
      toast.error(t("endAfterStart"));
      return;
    }
    onApply(startWeek, endWeek, name);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 99,
        }}
      />
      {/* Popover */}
      <div
        style={{
          position: "fixed",
          left: Math.min(
            popover.anchorRect.left,
            typeof window !== "undefined"
              ? window.innerWidth - 296
              : popover.anchorRect.left
          ),
          top: popover.anchorRect.bottom + 8,
          width: 280,
          padding: 16,
          background: "#fff",
          borderRadius: 8,
          boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
          border: "1px solid #E5E7EB",
          zIndex: 100,
          fontFamily:
            "'DM Sans', 'Avenir Next', system-ui, sans-serif",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ marginBottom: 12 }}>
          <label
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#6B7280",
              display: "block",
              marginBottom: 4,
            }}
          >
            {t("name")}
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              width: "100%",
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid #E5E7EB",
              fontSize: 13,
              color: "#1F2937",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#6B7280",
                display: "block",
                marginBottom: 4,
              }}
            >
              {t("startWeek")}
            </label>
            <input
              type="number"
              value={startWeek}
              onChange={(e) =>
                setStartWeek(parseInt(e.target.value) || 0)
              }
              style={{
                width: "100%",
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid #E5E7EB",
                fontSize: 13,
                color: "#1F2937",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#6B7280",
                display: "block",
                marginBottom: 4,
              }}
            >
              {t("endWeek")}
            </label>
            <input
              type="number"
              value={endWeek}
              onChange={(e) =>
                setEndWeek(parseInt(e.target.value) || 0)
              }
              style={{
                width: "100%",
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid #E5E7EB",
                fontSize: 13,
                color: "#1F2937",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <button
            onClick={onDelete}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              border: "1px solid #FCA5A5",
              background: "#FEF2F2",
              color: "#DC2626",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {t("delete")}
          </button>
          <button
            onClick={handleApply}
            style={{
              padding: "6px 18px",
              borderRadius: 6,
              border: "none",
              background: "#2563EB",
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {t("apply")}
          </button>
        </div>
      </div>
    </>
  );
}
