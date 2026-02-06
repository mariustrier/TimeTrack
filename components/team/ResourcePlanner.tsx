"use client";

import { useState, useEffect, useCallback } from "react";
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  addDays,
  format,
  eachDayOfInterval,
  isWeekend,
  isSameDay,
  differenceInCalendarDays,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
  Users,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTranslations, useDateLocale } from "@/lib/i18n";
import { ResourceGrid } from "@/components/resource-planner/ResourceGrid";
import { AllocationDialog } from "@/components/resource-planner/AllocationDialog";
import { ViewControls } from "@/components/resource-planner/ViewControls";
import { CapacitySummary } from "@/components/resource-planner/CapacitySummary";

export interface Employee {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  imageUrl: string | null;
  weeklyTarget: number;
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

export interface TimeEntryForAllocation {
  userId: string;
  projectId: string;
  date: string;
  hours: number;
}

type ViewMode = "week" | "twoWeeks" | "month";

export function ResourcePlanner() {
  const t = useTranslations("resourcePlanner");
  const dateLocale = useDateLocale();

  const [viewMode, setViewMode] = useState<ViewMode>("twoWeeks");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allocations, setAllocations] = useState<ResourceAllocation[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntryForAllocation[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState<ResourceAllocation | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Calculate date range based on view mode
  const getDateRange = useCallback(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });

    switch (viewMode) {
      case "week":
        return {
          start: weekStart,
          end: endOfWeek(currentDate, { weekStartsOn: 1 }),
        };
      case "twoWeeks":
        return {
          start: weekStart,
          end: addDays(weekStart, 13),
        };
      case "month":
        return {
          start: weekStart,
          end: addDays(weekStart, 27), // 4 weeks
        };
    }
  }, [currentDate, viewMode]);

  const dateRange = getDateRange();
  const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });

  // Convert to strings to use as stable dependencies
  const startStr = format(dateRange.start, "yyyy-MM-dd");
  const endStr = format(dateRange.end, "yyyy-MM-dd");

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const [employeesRes, projectsRes, allocationsRes, timeEntriesRes] = await Promise.all([
        fetch("/api/team"),
        fetch("/api/projects"),
        fetch(`/api/resource-allocations?startDate=${startStr}&endDate=${endStr}`),
        fetch(`/api/time-entries/for-allocations?startDate=${startStr}&endDate=${endStr}`),
      ]);

      if (!employeesRes.ok || !projectsRes.ok || !allocationsRes.ok) {
        throw new Error("Failed to fetch data");
      }

      const [employeesData, projectsData, allocationsData] = await Promise.all([
        employeesRes.json(),
        projectsRes.json(),
        allocationsRes.json(),
      ]);

      // Time entries might not exist yet, that's ok
      let timeEntriesData: TimeEntryForAllocation[] = [];
      if (timeEntriesRes.ok) {
        timeEntriesData = await timeEntriesRes.json();
      }

      setEmployees(employeesData);
      setProjects(projectsData.filter((p: Project & { archived?: boolean }) => !p.archived));
      setAllocations(allocationsData);
      setTimeEntries(timeEntriesData);
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
    switch (viewMode) {
      case "week":
        setCurrentDate((d) => subWeeks(d, 1));
        break;
      case "twoWeeks":
        setCurrentDate((d) => subWeeks(d, 2));
        break;
      case "month":
        setCurrentDate((d) => subWeeks(d, 4));
        break;
    }
  };

  const goToNext = () => {
    switch (viewMode) {
      case "week":
        setCurrentDate((d) => addWeeks(d, 1));
        break;
      case "twoWeeks":
        setCurrentDate((d) => addWeeks(d, 2));
        break;
      case "month":
        setCurrentDate((d) => addWeeks(d, 4));
        break;
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Allocation handlers
  const handleCellClick = (employee: Employee, date: Date) => {
    setSelectedAllocation(null);
    setSelectedEmployee(employee);
    setSelectedDate(date);
    setDialogOpen(true);
  };

  const handleAllocationClick = (allocation: ResourceAllocation) => {
    setSelectedAllocation(allocation);
    setSelectedEmployee(null);
    setSelectedDate(null);
    setDialogOpen(true);
  };

  const handleSaveAllocation = async (data: {
    userId: string;
    projectId: string;
    startDate: string;
    endDate: string;
    hoursPerDay: number;
    status: string;
    notes: string | null;
  }) => {
    try {
      if (selectedAllocation) {
        // Update existing
        const res = await fetch(`/api/resource-allocations/${selectedAllocation.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Failed to update allocation");
        toast.success(t("allocationUpdated") || "Allocation updated");
      } else {
        // Create new
        const res = await fetch("/api/resource-allocations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Failed to create allocation");
        toast.success(t("allocationCreated") || "Allocation created");
      }

      setDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error saving allocation:", error);
      toast.error(t("saveError") || "Failed to save allocation");
    }
  };

  const handleDeleteAllocation = async (id: string) => {
    try {
      const res = await fetch(`/api/resource-allocations/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete allocation");
      toast.success(t("allocationDeleted") || "Allocation deleted");
      setDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error deleting allocation:", error);
      toast.error(t("deleteError") || "Failed to delete allocation");
    }
  };

  // Danish work schedule: 7.5h Mon-Thu, 7h Friday = 37h/week
  const getDailyTarget = (date: Date): number => {
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return 0; // Weekend
    if (dayOfWeek === 5) return 7; // Friday
    return 7.5; // Mon-Thu
  };

  // Calculate utilization for capacity summary
  const calculateUtilization = () => {
    const utilizationMap: Record<string, { allocated: number; target: number }> = {};

    employees.forEach((emp) => {
      // Calculate target using actual daily targets for each day
      const target = days.reduce((sum, day) => sum + getDailyTarget(day), 0);
      utilizationMap[emp.id] = {
        allocated: 0,
        target,
      };
    });

    allocations.forEach((alloc) => {
      const allocStart = new Date(alloc.startDate);
      const allocEnd = new Date(alloc.endDate);

      days.forEach((day) => {
        if (isWeekend(day)) return;
        if (day >= allocStart && day <= allocEnd) {
          if (utilizationMap[alloc.userId]) {
            utilizationMap[alloc.userId].allocated += alloc.hoursPerDay;
          }
        }
      });
    });

    return utilizationMap;
  };

  const utilization = calculateUtilization();

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
        </div>

        <div className="flex items-center gap-4">
          <ViewControls
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={goToPrevious}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={goToToday}>
              {t("today") || "Today"}
            </Button>
            <Button variant="outline" size="icon" onClick={goToNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <span className="text-sm font-medium text-muted-foreground">
            {format(dateRange.start, "MMM d", { locale: dateLocale })} - {format(dateRange.end, "MMM d, yyyy", { locale: dateLocale })}
          </span>
        </div>
      </div>

      {/* Capacity Summary */}
      <CapacitySummary
        employees={employees}
        utilization={utilization}
      />

      {/* Main Grid */}
      <Card>
        <CardContent className="p-0">
          <ResourceGrid
            employees={employees}
            projects={projects}
            allocations={allocations}
            timeEntries={timeEntries}
            days={days}
            onCellClick={handleCellClick}
            onAllocationClick={handleAllocationClick}
          />
        </CardContent>
      </Card>

      {/* Allocation Dialog */}
      <AllocationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        allocation={selectedAllocation}
        employee={selectedEmployee}
        date={selectedDate}
        employees={employees}
        projects={projects}
        onSave={handleSaveAllocation}
        onDelete={handleDeleteAllocation}
      />
    </div>
  );
}
