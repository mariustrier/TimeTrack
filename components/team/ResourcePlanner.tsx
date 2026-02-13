"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  format,
  eachDayOfInterval,
} from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useTranslations } from "@/lib/i18n";
import { PlannerGrid } from "@/components/resource-planner/PlannerGrid";
import { PlannerControls } from "@/components/resource-planner/PlannerControls";
import { PlannerSummary } from "@/components/resource-planner/PlannerSummary";
import { AllocationPopover } from "@/components/resource-planner/AllocationPopover";
import { BulkActionToolbar } from "@/components/resource-planner/BulkActionToolbar";
import { getDailyTarget, getEffectiveWeeklyCapacity } from "@/lib/calculations";
import { isCompanyHoliday, type CustomHoliday } from "@/lib/holidays";
import { isWeekend } from "date-fns";

export interface Employee {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  imageUrl: string | null;
  weeklyTarget: number;
  isHourly?: boolean;
  employmentType?: string;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  client: string | null;
}

export interface ResourceAllocation {
  id: string;
  userId: string;
  projectId: string;
  startDate: string;
  endDate: string;
  hoursPerDay: number;
  totalHours: number | null;
  status: "tentative" | "confirmed" | "completed";
  notes: string | null;
  user: Employee;
  project: Project;
}

export interface VacationPeriod {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  type: string;
  user: { firstName: string | null; lastName: string | null };
}

type ViewMode = "week" | "twoWeeks" | "month";

interface PopoverState {
  open: boolean;
  position: { top: number; left: number } | null;
  mode: "create" | "edit";
  employeeId: string;
  date: string;
  allocation: {
    id: string;
    projectId: string;
    hoursPerDay: number;
    status: "tentative" | "confirmed" | "completed";
    notes: string | null;
    isMultiDay: boolean;
  } | null;
}

const INITIAL_POPOVER: PopoverState = {
  open: false,
  position: null,
  mode: "create",
  employeeId: "",
  date: "",
  allocation: null,
};

export function ResourcePlanner() {
  const t = useTranslations("resourcePlanner");

  const [viewMode, setViewMode] = useState<ViewMode>("twoWeeks");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [spans, setSpans] = useState<Record<ViewMode, number>>({
    week: 1,
    twoWeeks: 2,
    month: 3,
  });

  const spanConfig: Record<
    ViewMode,
    { min: number; max: number; step: number; unit: "weeks" | "months" }
  > = {
    week: { min: 1, max: 4, step: 1, unit: "weeks" },
    twoWeeks: { min: 1, max: 4, step: 1, unit: "weeks" },
    month: { min: 2, max: 6, step: 1, unit: "months" },
  };

  const currentSpan = spans[viewMode];

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allocations, setAllocations] = useState<ResourceAllocation[]>([]);
  const [vacations, setVacations] = useState<VacationPeriod[]>([]);
  const [disabledHolidayCodes, setDisabledHolidayCodes] = useState<string[]>([]);
  const [customHolidays, setCustomHolidays] = useState<CustomHoliday[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState("");

  // Popover state
  const [popover, setPopover] = useState<PopoverState>(INITIAL_POPOVER);

  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Undo delete state
  const undoRef = useRef<{ timeout: ReturnType<typeof setTimeout>; allocationId: string } | null>(
    null
  );

  // Calculate date range
  const getDateRange = useCallback(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    switch (viewMode) {
      case "week":
        return {
          start: weekStart,
          end: endOfWeek(addWeeks(weekStart, currentSpan - 1), { weekStartsOn: 1 }),
        };
      case "twoWeeks":
        return {
          start: weekStart,
          end: endOfWeek(addWeeks(weekStart, currentSpan - 1), { weekStartsOn: 1 }),
        };
      case "month": {
        const half = Math.floor(currentSpan / 2);
        const remainder = currentSpan - half;
        return {
          start: startOfWeek(subMonths(currentDate, half), { weekStartsOn: 1 }),
          end: endOfWeek(addMonths(currentDate, remainder), { weekStartsOn: 1 }),
        };
      }
    }
  }, [currentDate, viewMode, currentSpan]);

  const dateRange = getDateRange();
  const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });

  const startStr = format(dateRange.start, "yyyy-MM-dd");
  const endStr = format(dateRange.end, "yyyy-MM-dd");

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const [employeesRes, projectsRes, allocationsRes, vacationsRes, holidaysRes] =
        await Promise.all([
          fetch("/api/team"),
          fetch("/api/projects"),
          fetch(`/api/resource-allocations?startDate=${startStr}&endDate=${endStr}`),
          fetch(`/api/vacations?status=approved&startDate=${startStr}&endDate=${endStr}`),
          fetch("/api/admin/holidays"),
        ]);

      if (!employeesRes.ok || !projectsRes.ok || !allocationsRes.ok) {
        throw new Error("Failed to fetch data");
      }

      const [employeesData, projectsData, allocationsData] = await Promise.all([
        employeesRes.json(),
        projectsRes.json(),
        allocationsRes.json(),
      ]);

      if (vacationsRes.ok) {
        setVacations(await vacationsRes.json());
      }

      if (holidaysRes.ok) {
        const hData = await holidaysRes.json();
        setDisabledHolidayCodes(hData.disabledHolidays ?? []);
        setCustomHolidays(
          (hData.customHolidays ?? []).map(
            (ch: { name: string; month: number; day: number; year?: number | null }) => ({
              name: ch.name,
              month: ch.month,
              day: ch.day,
              year: ch.year,
            })
          )
        );
      }

      setEmployees(employeesData);
      setProjects(projectsData.filter((p: Project & { archived?: boolean }) => !p.archived));
      setAllocations(allocationsData);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error(t("fetchError") || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [startStr, endStr, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Navigation
  const goToPrevious = () => {
    if (viewMode === "month") {
      setCurrentDate((d) => subMonths(d, Math.max(1, Math.ceil(currentSpan / 2))));
    } else {
      setCurrentDate((d) => subWeeks(d, currentSpan));
    }
  };

  const goToNext = () => {
    if (viewMode === "month") {
      setCurrentDate((d) => addMonths(d, Math.max(1, Math.ceil(currentSpan / 2))));
    } else {
      setCurrentDate((d) => addWeeks(d, currentSpan));
    }
  };

  const goToToday = () => setCurrentDate(new Date());

  // ── Popover handlers ──

  const handleEmptyCellClick = (employeeId: string, date: Date, rect: DOMRect) => {
    const emp = employees.find((e) => e.id === employeeId);
    const effectiveCap = emp ? getEffectiveWeeklyCapacity(emp) : 37;
    const dailyTarget = getDailyTarget(date, effectiveCap);

    setPopover({
      open: true,
      position: { top: rect.bottom + 4, left: rect.left },
      mode: "create",
      employeeId,
      date: format(date, "yyyy-MM-dd"),
      allocation: null,
    });
  };

  const handleAllocationClick = (
    allocation: ResourceAllocation,
    date: Date,
    rect: DOMRect
  ) => {
    const isMultiDay =
      allocation.startDate.split("T")[0] !== allocation.endDate.split("T")[0];

    setPopover({
      open: true,
      position: { top: rect.bottom + 4, left: rect.left },
      mode: "edit",
      employeeId: allocation.userId,
      date: format(date, "yyyy-MM-dd"),
      allocation: {
        id: allocation.id,
        projectId: allocation.projectId,
        hoursPerDay: allocation.hoursPerDay,
        status: allocation.status,
        notes: allocation.notes,
        isMultiDay,
      },
    });
  };

  const handlePopoverSave = async (data: {
    projectId: string;
    hoursPerDay: number;
    status: string;
    notes: string | null;
    startDate?: string;
    endDate?: string;
    editDate?: string;
  }) => {
    try {
      if (popover.mode === "edit" && popover.allocation) {
        // Update existing
        const body: Record<string, unknown> = {
          hoursPerDay: data.hoursPerDay,
          status: data.status,
          notes: data.notes,
        };
        if (data.editDate) {
          body.editDate = data.editDate;
        }

        const res = await fetch(`/api/resource-allocations/${popover.allocation.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("Failed to update allocation");
        toast.success(t("allocationUpdated") || "Allocation updated");
      } else {
        // Create new allocation with date range from popover
        const res = await fetch("/api/resource-allocations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: popover.employeeId,
            projectId: data.projectId,
            startDate: data.startDate || popover.date,
            endDate: data.endDate || popover.date,
            hoursPerDay: data.hoursPerDay,
            status: data.status,
            notes: data.notes,
          }),
        });
        if (!res.ok) throw new Error("Failed to create allocation");
        toast.success(t("allocationCreated") || "Allocation created");
      }

      setPopover(INITIAL_POPOVER);
      fetchData();
    } catch (error) {
      console.error("Error saving allocation:", error);
      toast.error(t("saveError") || "Failed to save allocation");
    }
  };

  const handleAllocationDelete = async (allocationId: string, date?: string, redistribute?: boolean) => {
    // Optimistic: remove from state
    const deletedAlloc = allocations.find((a) => a.id === allocationId);
    setAllocations((prev) => prev.filter((a) => a.id !== allocationId));
    setPopover(INITIAL_POPOVER);

    const toastId = toast(t("allocationDeleted") || "Allocation deleted", {
      action: {
        label: "Undo",
        onClick: () => {
          // Cancel the actual delete
          if (undoRef.current?.allocationId === allocationId) {
            clearTimeout(undoRef.current.timeout);
            undoRef.current = null;
          }
          // Restore optimistically
          if (deletedAlloc) {
            setAllocations((prev) => [...prev, deletedAlloc]);
          }
        },
      },
      duration: 3000,
    });

    // Schedule actual delete after 3s
    const timeout = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (date) params.set("date", date);
        if (redistribute) params.set("redistribute", "true");
        const qs = params.toString();
        const url = `/api/resource-allocations/${allocationId}${qs ? `?${qs}` : ""}`;
        const res = await fetch(url, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete");
        fetchData(); // Refresh to get accurate state
      } catch (error) {
        console.error("Error deleting allocation:", error);
        toast.error(t("deleteError") || "Failed to delete allocation");
        // Restore on error
        if (deletedAlloc) {
          setAllocations((prev) => [...prev, deletedAlloc]);
        }
      }
      undoRef.current = null;
    }, 3200);

    undoRef.current = { timeout, allocationId };
  };

  // ── Drag-and-drop: move allocation to a different day ──
  const handleAllocationDrop = async (
    employeeId: string,
    data: { allocationId: string; sourceDate: string; isMultiDay: boolean; shiftKey: boolean },
    targetDate: string
  ) => {
    const alloc = allocations.find((a) => a.id === data.allocationId);
    if (!alloc) return;

    try {
      if (data.shiftKey && data.isMultiDay) {
        // Shift+drag: move entire allocation by offset
        const sourceMs = new Date(data.sourceDate).getTime();
        const targetMs = new Date(targetDate).getTime();
        const offsetDays = Math.round((targetMs - sourceMs) / (1000 * 60 * 60 * 24));
        if (offsetDays === 0) return;

        const newStart = new Date(alloc.startDate);
        newStart.setDate(newStart.getDate() + offsetDays);
        const newEnd = new Date(alloc.endDate);
        newEnd.setDate(newEnd.getDate() + offsetDays);

        const res = await fetch(`/api/resource-allocations/${alloc.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startDate: format(newStart, "yyyy-MM-dd"),
            endDate: format(newEnd, "yyyy-MM-dd"),
          }),
        });
        if (!res.ok) throw new Error("Failed to move allocation");
        toast.success(t("allocationMoved") || "Allocation moved");
      } else {
        // Normal drag: move single day to target
        // 1. Delete the source day from original allocation
        const deleteParams = new URLSearchParams({ date: data.sourceDate });
        const delRes = await fetch(`/api/resource-allocations/${alloc.id}?${deleteParams}`, {
          method: "DELETE",
        });
        if (!delRes.ok) throw new Error("Failed to remove source day");

        // 2. Create new single-day allocation on target date
        const createRes = await fetch("/api/resource-allocations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: alloc.userId,
            projectId: alloc.projectId,
            startDate: targetDate,
            endDate: targetDate,
            hoursPerDay: alloc.hoursPerDay,
            status: alloc.status,
            notes: alloc.notes,
          }),
        });
        if (!createRes.ok) throw new Error("Failed to create allocation");
        toast.success(t("allocationMoved") || "Allocation moved");
      }
      fetchData();
    } catch (error) {
      console.error("Error moving allocation:", error);
      toast.error(t("moveError") || "Failed to move allocation");
      fetchData();
    }
  };

  // Filter allocations by project (moved up for selection handlers)
  const filteredAllocations = projectFilter
    ? allocations.filter((a) => a.projectId === projectFilter)
    : allocations;

  // ── Selection mode handlers ──

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      if (prev) setSelectedIds(new Set());
      return !prev;
    });
  }, []);

  const toggleSelection = useCallback((allocationId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(allocationId)) {
        next.delete(allocationId);
      } else {
        next.add(allocationId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredAllocations.map((a) => a.id)));
  }, [filteredAllocations]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const addToSelection = useCallback((allocationIds: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      allocationIds.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  // Escape key to exit selection mode
  useEffect(() => {
    if (!selectionMode) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectionMode(false);
        setSelectedIds(new Set());
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [selectionMode]);

  // ── Bulk action handlers ──

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    // Optimistic: remove from local state
    const removed = allocations.filter((a) => selectedIds.has(a.id));
    setAllocations((prev) => prev.filter((a) => !selectedIds.has(a.id)));
    setSelectedIds(new Set());

    try {
      const res = await fetch("/api/resource-allocations/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", ids }),
      });
      if (!res.ok) throw new Error("Bulk delete failed");
      toast.success(t("bulkDeleteSuccess") || "Allocations deleted");
      fetchData();
    } catch (error) {
      console.error("Bulk delete error:", error);
      toast.error(t("bulkDeleteError") || "Failed to delete allocations");
      setAllocations((prev) => [...prev, ...removed]);
    }
  }, [selectedIds, allocations, fetchData, t]);

  const handleBulkStatusChange = useCallback(
    async (status: "tentative" | "confirmed" | "completed") => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;

      // Optimistic update
      setAllocations((prev) =>
        prev.map((a) => (selectedIds.has(a.id) ? { ...a, status } : a))
      );
      setSelectedIds(new Set());

      try {
        const res = await fetch("/api/resource-allocations/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "updateStatus", ids, status }),
        });
        if (!res.ok) throw new Error("Bulk status change failed");
        toast.success(t("bulkStatusSuccess") || "Status updated");
        fetchData();
      } catch (error) {
        console.error("Bulk status error:", error);
        toast.error(t("bulkStatusError") || "Failed to update status");
        fetchData();
      }
    },
    [selectedIds, fetchData, t]
  );

  const handleBulkMove = useCallback(
    async (offsetDays: number) => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0 || offsetDays === 0) return;

      setSelectedIds(new Set());

      try {
        const res = await fetch("/api/resource-allocations/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "move", ids, offsetDays }),
        });
        if (!res.ok) throw new Error("Bulk move failed");
        toast.success(t("bulkMoveSuccess") || "Allocations moved");
        fetchData();
      } catch (error) {
        console.error("Bulk move error:", error);
        toast.error(t("bulkMoveError") || "Failed to move allocations");
        fetchData();
      }
    },
    [selectedIds, fetchData, t]
  );

  // ── Filter employees ──
  const filteredEmployees = employees.filter((emp) => {
    // Name search
    if (employeeSearch) {
      const name = `${emp.firstName || ""} ${emp.lastName || ""} ${emp.email}`.toLowerCase();
      if (!name.includes(employeeSearch.toLowerCase())) return false;
    }
    // Project filter: only show employees that have allocations for the selected project
    if (projectFilter) {
      const hasAlloc = allocations.some(
        (a) => a.userId === emp.id && a.projectId === projectFilter
      );
      if (!hasAlloc) return false;
    }
    return true;
  });

  // ── Calculate summary stats ──
  let summaryAllocated = 0;
  let summaryCapacity = 0;
  let overbookedCount = 0;
  let availableCount = 0;

  filteredEmployees.forEach((emp) => {
    const effectiveCap = getEffectiveWeeklyCapacity(emp);
    let empAllocated = 0;
    let empCapacity = 0;

    days.forEach((day) => {
      if (isWeekend(day)) return;
      if (isCompanyHoliday(day, disabledHolidayCodes, customHolidays)) return;
      const target = getDailyTarget(day, effectiveCap, disabledHolidayCodes, customHolidays);
      empCapacity += target;

      const dateStr = format(day, "yyyy-MM-dd");
      filteredAllocations.forEach((a) => {
        if (a.userId !== emp.id) return;
        const start = a.startDate.split("T")[0];
        const end = a.endDate.split("T")[0];
        if (dateStr >= start && dateStr <= end) {
          empAllocated += a.hoursPerDay;
        }
      });
    });

    summaryAllocated += empAllocated;
    summaryCapacity += empCapacity;

    if (empCapacity > 0) {
      const util = (empAllocated / empCapacity) * 100;
      if (util > 100) overbookedCount++;
      else if (util < 50) availableCount++;
    }
  });

  const teamUtilization = summaryCapacity > 0 ? (summaryAllocated / summaryCapacity) * 100 : 0;

  // Get default hours for popover
  const getDefaultHours = () => {
    if (!popover.employeeId) return 7.5;
    const emp = employees.find((e) => e.id === popover.employeeId);
    if (!emp) return 7.5;
    const effectiveCap = getEffectiveWeeklyCapacity(emp);
    if (popover.date) {
      const date = new Date(popover.date);
      return getDailyTarget(date, effectiveCap, disabledHolidayCodes, customHolidays) || 7.5;
    }
    return effectiveCap / 5;
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      {/* Controls */}
      <PlannerControls
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        currentSpan={currentSpan}
        onSpanChange={(v) => setSpans((s) => ({ ...s, [viewMode]: v }))}
        spanConfig={spanConfig[viewMode]}
        dateRange={dateRange}
        onPrevious={goToPrevious}
        onNext={goToNext}
        onToday={goToToday}
        projects={projects}
        projectFilter={projectFilter}
        onProjectFilterChange={setProjectFilter}
        employeeSearch={employeeSearch}
        onEmployeeSearchChange={setEmployeeSearch}
        selectionMode={selectionMode}
        onSelectionModeToggle={toggleSelectionMode}
      />

      {/* Summary */}
      <PlannerSummary
        utilizationPercent={teamUtilization}
        overbookedCount={overbookedCount}
        availableCount={availableCount}
      />

      {/* Grid */}
      <Card>
        <CardContent className="p-0">
          <PlannerGrid
            employees={filteredEmployees}
            allocations={filteredAllocations}
            vacations={vacations}
            days={days}
            viewMode={viewMode}
            disabledHolidayCodes={disabledHolidayCodes}
            customHolidays={customHolidays}
            onEmptyCellClick={handleEmptyCellClick}
            onAllocationClick={handleAllocationClick}
            onAllocationDelete={handleAllocationDelete}
            onAllocationDrop={handleAllocationDrop}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onToggleSelection={toggleSelection}
            onAddToSelection={addToSelection}
          />
        </CardContent>
      </Card>

      {/* Inline Popover */}
      <AllocationPopover
        open={popover.open}
        position={popover.position}
        mode={popover.mode}
        employeeId={popover.employeeId}
        date={popover.date}
        allocation={popover.allocation}
        projects={projects}
        defaultHoursPerDay={getDefaultHours()}
        onSave={handlePopoverSave}
        onDelete={handleAllocationDelete}
        onClose={() => setPopover(INITIAL_POPOVER)}
      />

      {/* Bulk Action Toolbar */}
      {selectionMode && selectedIds.size > 0 && (
        <BulkActionToolbar
          selectedCount={selectedIds.size}
          totalCount={filteredAllocations.length}
          onDelete={handleBulkDelete}
          onStatusChange={handleBulkStatusChange}
          onMove={handleBulkMove}
          onSelectAll={selectAll}
          onClearSelection={clearSelection}
        />
      )}

      {/* Mobile notice */}
      <p className="text-xs text-muted-foreground text-center md:hidden">
        {t("desktopRecommended") || "Desktop recommended for the best experience"}
      </p>
    </div>
  );
}
