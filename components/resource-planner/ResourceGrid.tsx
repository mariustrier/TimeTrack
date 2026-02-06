"use client";

import { useMemo } from "react";
import { format, isWeekend, isSameDay, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { useDateLocale } from "@/lib/i18n";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Employee {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  imageUrl: string | null;
  weeklyTarget: number;
}

interface Project {
  id: string;
  name: string;
  color: string;
  client: string | null;
}

interface ResourceAllocation {
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

interface TimeEntryForAllocation {
  userId: string;
  projectId: string;
  date: string;
  hours: number;
}

interface ResourceGridProps {
  employees: Employee[];
  projects: Project[];
  allocations: ResourceAllocation[];
  timeEntries: TimeEntryForAllocation[];
  days: Date[];
  onCellClick: (employee: Employee, date: Date) => void;
  onAllocationClick: (allocation: ResourceAllocation) => void;
}

export function ResourceGrid({
  employees,
  projects,
  allocations,
  timeEntries,
  days,
  onCellClick,
  onAllocationClick,
}: ResourceGridProps) {
  const dateLocale = useDateLocale();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Danish work schedule: 7.5h Mon-Thu, 7h Friday = 37h/week
  const getDailyTarget = (date: Date): number => {
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return 0; // Weekend
    if (dayOfWeek === 5) return 7; // Friday
    return 7.5; // Mon-Thu
  };

  // Group allocations by user
  const allocationsByUser = useMemo(() => {
    const map: Record<string, ResourceAllocation[]> = {};
    allocations.forEach((alloc) => {
      if (!map[alloc.userId]) map[alloc.userId] = [];
      map[alloc.userId].push(alloc);
    });
    return map;
  }, [allocations]);

  // Calculate rollover for allocations with totalHours
  // Returns adjusted hoursPerDay based on logged hours and remaining days
  const allocationRollover = useMemo(() => {
    const rolloverMap: Record<string, {
      logged: number;
      remaining: number;
      adjustedPerDay: number;
      remainingDays: number;
    }> = {};

    allocations.forEach((alloc) => {
      if (!alloc.totalHours) return; // Skip if not in totalHours mode

      const allocStart = new Date(alloc.startDate);
      const allocEnd = new Date(alloc.endDate);

      // Sum logged hours for this allocation
      let logged = 0;
      timeEntries.forEach((entry) => {
        if (entry.userId === alloc.userId && entry.projectId === alloc.projectId) {
          const entryDate = new Date(entry.date);
          if (entryDate >= allocStart && entryDate <= allocEnd) {
            logged += entry.hours;
          }
        }
      });

      // Count remaining working days (from today onwards)
      let remainingDays = 0;
      const checkDate = new Date(Math.max(today.getTime(), allocStart.getTime()));
      while (checkDate <= allocEnd) {
        const dayOfWeek = checkDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          remainingDays++;
        }
        checkDate.setDate(checkDate.getDate() + 1);
      }

      const remaining = Math.max(0, alloc.totalHours - logged);
      const adjustedPerDay = remainingDays > 0 ? remaining / remainingDays : 0;

      rolloverMap[alloc.id] = {
        logged,
        remaining,
        adjustedPerDay,
        remainingDays,
      };
    });

    return rolloverMap;
  }, [allocations, timeEntries, today]);

  // Calculate daily utilization per employee
  const dailyUtilization = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};

    employees.forEach((emp) => {
      map[emp.id] = {};
      days.forEach((day) => {
        map[emp.id][format(day, "yyyy-MM-dd")] = 0;
      });
    });

    allocations.forEach((alloc) => {
      const start = new Date(alloc.startDate);
      const end = new Date(alloc.endDate);

      days.forEach((day) => {
        if (day >= start && day <= end && !isWeekend(day)) {
          const dateKey = format(day, "yyyy-MM-dd");
          if (map[alloc.userId]?.[dateKey] !== undefined) {
            map[alloc.userId][dateKey] += alloc.hoursPerDay;
          }
        }
      });
    });

    return map;
  }, [employees, allocations, days]);

  // Get initials for avatar
  const getInitials = (employee: Employee) => {
    if (employee.firstName && employee.lastName) {
      return `${employee.firstName[0]}${employee.lastName[0]}`.toUpperCase();
    }
    return employee.email.substring(0, 2).toUpperCase();
  };

  // Get display name
  const getDisplayName = (employee: Employee) => {
    if (employee.firstName && employee.lastName) {
      return `${employee.firstName} ${employee.lastName}`;
    }
    return employee.email.split("@")[0];
  };

  // Find allocation for a specific cell
  const getFirstAllocationForCell = (employeeId: string, date: Date) => {
    const userAllocations = allocationsByUser[employeeId] || [];
    return userAllocations.find((alloc) => {
      const start = new Date(alloc.startDate);
      const end = new Date(alloc.endDate);
      return date >= start && date <= end;
    });
  };

  // Check if this is the start of an allocation
  const isAllocationStart = (allocation: ResourceAllocation, date: Date) => {
    return isSameDay(new Date(allocation.startDate), date);
  };

  // Calculate allocation span (number of visible days)
  const getAllocationSpan = (allocation: ResourceAllocation, fromDate: Date) => {
    const end = new Date(allocation.endDate);
    let span = 0;
    let current = fromDate;

    while (current <= end) {
      const idx = days.findIndex((d) => isSameDay(d, current));
      if (idx === -1) break;
      span++;
      current = new Date(current);
      current.setDate(current.getDate() + 1);
    }

    return span;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse min-w-[800px]">
        {/* Header */}
        <thead>
          <tr>
            <th className="sticky left-0 z-20 bg-card border-b border-r border-border p-3 text-left min-w-[200px]">
              <span className="text-sm font-medium text-muted-foreground">Team Member</span>
            </th>
            {days.map((day) => {
              const dailyTarget = getDailyTarget(day);
              return (
                <th
                  key={day.toISOString()}
                  className={cn(
                    "border-b border-r border-border p-2 text-center min-w-[80px]",
                    isWeekend(day) && "bg-muted/50",
                    isToday(day) && "bg-brand-50 dark:bg-brand-950"
                  )}
                >
                  <div className="text-xs font-medium text-muted-foreground">
                    {format(day, "EEE", { locale: dateLocale })}
                  </div>
                  <div className={cn(
                    "text-sm font-semibold",
                    isToday(day) && "text-brand-600 dark:text-brand-400"
                  )}>
                    {format(day, "d", { locale: dateLocale })}
                  </div>
                  {!isWeekend(day) && (
                    <div className="text-[10px] text-muted-foreground">
                      {dailyTarget}h
                    </div>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.id} className="group">
              {/* Employee Info */}
              <td className="sticky left-0 z-10 bg-card border-b border-r border-border p-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={employee.imageUrl || undefined} />
                    <AvatarFallback className="text-xs">
                      {getInitials(employee)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{getDisplayName(employee)}</p>
                    <p className="text-xs text-muted-foreground">{employee.weeklyTarget}h/week</p>
                  </div>
                </div>
              </td>

              {/* Day Cells */}
              {days.map((day, dayIndex) => {
                const dateKey = format(day, "yyyy-MM-dd");
                const hoursAllocated = dailyUtilization[employee.id]?.[dateKey] || 0;
                const targetForDay = getDailyTarget(day);
                const isOverbooked = !isWeekend(day) && hoursAllocated > targetForDay;
                const allocation = getFirstAllocationForCell(employee.id, day);
                const showAllocation = allocation && isAllocationStart(allocation, day);
                const span = showAllocation ? getAllocationSpan(allocation, day) : 0;
                const isPartOfAllocation = allocation && !showAllocation;

                return (
                  <td
                    key={day.toISOString()}
                    className={cn(
                      "border-b border-r border-border p-1 relative h-[60px] transition-colors",
                      isWeekend(day) && "bg-muted/30",
                      isToday(day) && "bg-brand-50/50 dark:bg-brand-950/50",
                      !isWeekend(day) && !isPartOfAllocation && "hover:bg-accent cursor-pointer",
                      isOverbooked && "bg-red-50 dark:bg-red-950/30"
                    )}
                    onClick={() => {
                      if (!isWeekend(day) && allocation) {
                        onAllocationClick(allocation);
                      } else if (!isWeekend(day)) {
                        onCellClick(employee, day);
                      }
                    }}
                  >
                    {/* Allocation Bar */}
                    {showAllocation && (
                      <div
                        className={cn(
                          "absolute top-1 left-1 right-1 h-[calc(100%-8px)] rounded-md px-2 py-1 cursor-pointer z-10",
                          "flex items-center overflow-hidden",
                          allocation.status === "tentative" && "opacity-70",
                          allocation.status === "tentative" && "bg-stripes"
                        )}
                        style={{
                          backgroundColor: allocation.project.color + (allocation.status === "tentative" ? "99" : ""),
                          width: `calc(${span * 100}% + ${(span - 1) * 8}px)`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAllocationClick(allocation);
                        }}
                      >
                        <span className="text-xs font-medium text-white truncate drop-shadow-sm">
                          {allocation.project.name}
                        </span>
                        {allocation.totalHours ? (
                          // Show rollover info for totalHours mode
                          <span className="text-xs text-white/80 ml-1 shrink-0" title={`${allocationRollover[allocation.id]?.logged.toFixed(1) || 0}h logged, ${allocationRollover[allocation.id]?.remaining.toFixed(1) || 0}h remaining`}>
                            {allocationRollover[allocation.id]?.adjustedPerDay.toFixed(1) || allocation.hoursPerDay}h/d
                          </span>
                        ) : (
                          <span className="text-xs text-white/80 ml-1 shrink-0">
                            {allocation.hoursPerDay}h
                          </span>
                        )}
                      </div>
                    )}

                    {/* Hours indicator for non-weekend non-allocation days */}
                    {!isWeekend(day) && !allocation && hoursAllocated > 0 && (
                      <div className="absolute bottom-1 right-1 text-xs text-muted-foreground">
                        {hoursAllocated}h
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legend */}
      <div className="flex items-center gap-6 p-4 border-t border-border text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-brand-500" />
          <span className="text-muted-foreground">Confirmed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-brand-500/70 bg-stripes" />
          <span className="text-muted-foreground">Tentative</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-100 dark:bg-red-900/30" />
          <span className="text-muted-foreground">Overbooked</span>
        </div>
      </div>
    </div>
  );
}
