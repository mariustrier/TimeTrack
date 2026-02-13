"use client";

import { Fragment, useState, useEffect, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";
import { toast } from "sonner";
import { ActivityCategoryHeader } from "./ActivityCategoryHeader";
import { ActivityRow } from "./ActivityRow";
import { ActivityProgressBar } from "./ActivityProgressBar";
import { ActivityPopover } from "./ActivityPopover";
import type {
  TimelineProject,
  TimelineActivity,
  TimelineColumn,
  CompanyPhase,
  DragState,
} from "./types";

interface ActivityGanttSectionProps {
  project: TimelineProject;
  columns: TimelineColumn[];
  companyPhases: CompanyPhase[];
  teamMembers: { id: string; name: string; imageUrl: string | null }[];
  startDrag: (
    type: DragState["type"],
    entityId: string,
    projectId: string,
    mouseX: number,
    originalStart: Date,
    originalEnd: Date
  ) => void;
  dragState: DragState | null;
}

export function ActivityGanttSection({
  project,
  columns,
  companyPhases,
  teamMembers,
  startDrag,
  dragState,
}: ActivityGanttSectionProps) {
  const t = useTranslations("timeline");

  const [activities, setActivities] = useState<TimelineActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [popover, setPopover] = useState<{
    open: boolean;
    position: { top: number; left: number } | null;
    activity: TimelineActivity | null;
    defaultDate?: string;
  }>({ open: false, position: null, activity: null });

  // Fetch activities on mount / project change
  useEffect(() => {
    const fetchActivities = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/projects/${project.id}/activities`);
        if (!res.ok) {
          setActivities([]);
          return;
        }
        const data = await res.json();
        const mapped: TimelineActivity[] = (data || []).map((item: Record<string, unknown>) => ({
          id: item.id as string,
          projectId: project.id,
          name: (item.name as string) || "",
          sortOrder: (item.sortOrder as number) || 0,
          phaseId: (item.phaseId as string) || null,
          phaseName: item.phase
            ? ((item.phase as Record<string, unknown>).name as string) || null
            : null,
          phaseColor: item.phase
            ? ((item.phase as Record<string, unknown>).color as string) || null
            : null,
          categoryName: (item.categoryName as string) || null,
          assignedUserId: (item.assignedUserId as string) || null,
          assignedUserName: item.assignedUser
            ? [
                (item.assignedUser as Record<string, unknown>).firstName,
                (item.assignedUser as Record<string, unknown>).lastName,
              ]
                .filter(Boolean)
                .join(" ") || null
            : null,
          assignedUserImageUrl: item.assignedUser
            ? ((item.assignedUser as Record<string, unknown>).imageUrl as string) || null
            : null,
          startDate: (item.startDate as string)?.split("T")[0] || format(new Date(), "yyyy-MM-dd"),
          endDate: (item.endDate as string)?.split("T")[0] || format(new Date(), "yyyy-MM-dd"),
          status: (item.status as TimelineActivity["status"]) || "not_started",
          color: (item.color as string) || null,
          note: (item.note as string) || null,
        }));
        setActivities(mapped);
      } catch {
        setActivities([]);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [project.id]);

  // Group activities by category / phase
  const grouped = useMemo(() => {
    const categories: Record<
      string,
      { name: string; color: string | null; phaseId: string | null; activities: TimelineActivity[] }
    > = {};
    const uncategorized: TimelineActivity[] = [];

    for (const a of activities) {
      const key = a.phaseId || a.categoryName || "";
      if (!key) {
        uncategorized.push(a);
        continue;
      }
      if (!categories[key]) {
        categories[key] = {
          name: a.phaseName || a.categoryName || "",
          color: a.phaseColor,
          phaseId: a.phaseId,
          activities: [],
        };
      }
      categories[key].activities.push(a);
    }
    return { categories: Object.values(categories), uncategorized };
  }, [activities]);

  // Handlers
  const handleUpdate = useCallback(
    async (activityId: string, data: Record<string, unknown>) => {
      // Optimistic update
      setActivities((prev) =>
        prev.map((a) => (a.id === activityId ? { ...a, ...data } as TimelineActivity : a))
      );

      try {
        const res = await fetch(`/api/projects/${project.id}/activities`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activityId, ...data }),
        });
        if (!res.ok) {
          toast.error(t("updateError") || "Failed to update activity");
        }
      } catch {
        toast.error(t("updateError") || "Failed to update activity");
      }
    },
    [project.id, t]
  );

  const handleDelete = useCallback(
    async (activityId: string) => {
      if (!window.confirm(t("confirmDeleteActivity") || "Are you sure you want to delete this activity?")) {
        return;
      }

      // Optimistic remove
      setActivities((prev) => prev.filter((a) => a.id !== activityId));

      try {
        const res = await fetch(`/api/projects/${project.id}/activities?activityId=${activityId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          toast.error(t("deleteError") || "Failed to delete activity");
        }
      } catch {
        toast.error(t("deleteError") || "Failed to delete activity");
      }
    },
    [project.id, t]
  );

  const handleCreate = useCallback(
    async (data: Record<string, unknown>) => {
      try {
        const res = await fetch(`/api/projects/${project.id}/activities`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          toast.error(t("saveError") || "Failed to create activity");
          return;
        }
        const created = await res.json();
        const newActivity: TimelineActivity = {
          id: created.id,
          projectId: project.id,
          name: created.name || (data.name as string) || "",
          sortOrder: created.sortOrder || 0,
          phaseId: created.phaseId || (data.phaseId as string) || null,
          phaseName: created.phase?.name || null,
          phaseColor: created.phase?.color || null,
          categoryName: created.categoryName || (data.categoryName as string) || null,
          assignedUserId: created.assignedUserId || (data.assignedUserId as string) || null,
          assignedUserName: created.assignedUser
            ? [created.assignedUser.firstName, created.assignedUser.lastName].filter(Boolean).join(" ")
            : null,
          assignedUserImageUrl: created.assignedUser?.imageUrl || null,
          startDate: (created.startDate as string)?.split("T")[0] || (data.startDate as string) || "",
          endDate: (created.endDate as string)?.split("T")[0] || (data.endDate as string) || "",
          status: created.status || "not_started",
          color: created.color || null,
          note: created.note || null,
        };
        setActivities((prev) => [...prev, newActivity]);
        toast.success(t("activityCreated") || "Activity created");
      } catch {
        toast.error(t("saveError") || "Failed to create activity");
      }
    },
    [project.id, t]
  );

  const handleActivityClick = useCallback(
    (activity: TimelineActivity, e: React.MouseEvent) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setPopover({
        open: true,
        position: { top: rect.bottom + 4, left: rect.left - 100 },
        activity,
      });
    },
    []
  );

  const openCreatePopover = useCallback(
    (e: React.MouseEvent) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setPopover({
        open: true,
        position: { top: rect.bottom + 4, left: rect.left - 100 },
        activity: null,
        defaultDate: project.startDate
          ? format(new Date(project.startDate + "T00:00:00"), "yyyy-MM-dd")
          : undefined,
      });
    },
    [project.startDate]
  );

  const phasesEnabled = companyPhases.length > 0;

  return (
    <>
      {/* Gantt header */}
      <tr className="bg-muted/30">
        <td className="sticky left-0 z-10 bg-muted/30 border-b border-r border-border p-1.5 min-w-[220px]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("activities") || "Activities"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-[10px] px-1.5"
              onClick={openCreatePopover}
            >
              <Plus className="h-3 w-3 mr-0.5" />
              {t("addActivity") || "Add"}
            </Button>
          </div>
        </td>
        <td colSpan={columns.length} className="border-b border-border" />
        <td className="border-b border-l border-border" />
      </tr>

      {/* Category groups */}
      {grouped.categories.map((cat) => (
        <Fragment key={cat.phaseId || cat.name}>
          <ActivityCategoryHeader
            name={cat.name}
            color={cat.color}
            columnCount={columns.length}
          />
          {cat.activities.map((activity) => (
            <ActivityRow
              key={activity.id}
              activity={activity}
              projectColor={project.color}
              columns={columns}
              teamMembers={teamMembers}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onClick={handleActivityClick}
              startDrag={startDrag}
              dragState={dragState}
            />
          ))}
        </Fragment>
      ))}

      {/* Uncategorized */}
      {grouped.uncategorized.length > 0 && (
        <>
          <ActivityCategoryHeader
            name={t("uncategorized") || "Other"}
            color={null}
            columnCount={columns.length}
          />
          {grouped.uncategorized.map((activity) => (
            <ActivityRow
              key={activity.id}
              activity={activity}
              projectColor={project.color}
              columns={columns}
              teamMembers={teamMembers}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onClick={handleActivityClick}
              startDrag={startDrag}
              dragState={dragState}
            />
          ))}
        </>
      )}

      {/* Empty state */}
      {activities.length === 0 && !loading && (
        <tr>
          <td className="sticky left-0 z-10 bg-card border-b border-r border-border p-2 min-w-[220px]" />
          <td colSpan={columns.length} className="border-b border-border p-4 text-center">
            <p className="text-xs text-muted-foreground">
              {t("noActivities") || "No activities yet. Click + to add one."}
            </p>
          </td>
          <td className="border-b border-l border-border" />
        </tr>
      )}

      {/* Progress bar */}
      {activities.length > 0 && (
        <ActivityProgressBar
          activities={activities}
          projectColor={project.color}
          columnCount={columns.length}
        />
      )}

      {/* Popover */}
      <ActivityPopover
        open={popover.open}
        position={popover.position}
        activity={popover.activity}
        projectId={project.id}
        projectColor={project.color}
        companyPhases={companyPhases}
        phasesEnabled={phasesEnabled}
        teamMembers={teamMembers}
        defaultDate={popover.defaultDate}
        onSave={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onClose={() => setPopover((p) => ({ ...p, open: false }))}
      />
    </>
  );
}
