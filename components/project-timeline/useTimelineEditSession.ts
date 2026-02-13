import { useState, useCallback, useRef, useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import { format } from "date-fns";
import type { TimelineProject, TimelineMilestone } from "./types";

export interface EditChange {
  id: string;
  type:
    | "move_project"
    | "resize_project"
    | "move_activity"
    | "resize_activity"
    | "move_milestone"
    | "update_milestone"
    | "create_milestone"
    | "delete_milestone";
  entityId: string;
  projectId?: string;
  label: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  /** API call to execute on save */
  apiCall: () => Promise<void>;
}

interface EditSessionState {
  active: boolean;
  changes: EditChange[];
  undoneChanges: EditChange[];
  originalProjects: TimelineProject[];
  originalMilestones: TimelineMilestone[];
}

export function useTimelineEditSession(
  projects: TimelineProject[],
  milestones: TimelineMilestone[],
  setProjects: Dispatch<SetStateAction<TimelineProject[]>>,
  setMilestones: Dispatch<SetStateAction<TimelineMilestone[]>>,
  fetchData: () => Promise<void>,
) {
  const [state, setState] = useState<EditSessionState>({
    active: false,
    changes: [],
    undoneChanges: [],
    originalProjects: [],
    originalMilestones: [],
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const enterEditMode = useCallback(() => {
    setState({
      active: true,
      changes: [],
      undoneChanges: [],
      originalProjects: JSON.parse(JSON.stringify(projects)),
      originalMilestones: JSON.parse(JSON.stringify(milestones)),
    });
  }, [projects, milestones]);

  const addChange = useCallback((change: EditChange) => {
    setState((s) => ({
      ...s,
      changes: [...s.changes, change],
      undoneChanges: [], // clear redo stack on new change
    }));
  }, []);

  const undo = useCallback(() => {
    setState((prev) => {
      if (prev.changes.length === 0) return prev;
      const last = prev.changes[prev.changes.length - 1];
      const remaining = prev.changes.slice(0, -1);

      // Revert local state using before data
      if (last.type === "move_project" || last.type === "resize_project") {
        setProjects(
          stateRef.current.originalProjects.length > 0
            ? applyChanges(stateRef.current.originalProjects, remaining)
            : projects
        );
      } else if (last.type === "move_milestone" || last.type === "update_milestone") {
        // Rebuild milestones from original + remaining changes
        const rebuilt = applyMilestoneChanges(
          stateRef.current.originalMilestones,
          remaining,
        );
        setMilestones(rebuilt);
      } else if (last.type === "delete_milestone") {
        // Re-add the deleted milestone
        const before = last.before as { milestone: TimelineMilestone };
        setMilestones((ms) => [...ms, before.milestone]);
      } else if (last.type === "create_milestone") {
        // Remove the created milestone
        setMilestones((ms) => ms.filter((m) => m.id !== last.entityId));
      }

      return {
        ...prev,
        changes: remaining,
        undoneChanges: [...prev.undoneChanges, last],
      };
    });
  }, [projects, setProjects, setMilestones]);

  const redo = useCallback(() => {
    setState((prev) => {
      if (prev.undoneChanges.length === 0) return prev;
      const last = prev.undoneChanges[prev.undoneChanges.length - 1];
      const remaining = prev.undoneChanges.slice(0, -1);

      // Re-apply the change
      if (last.type === "move_project" || last.type === "resize_project") {
        const after = last.after as { startDate?: string; endDate?: string };
        setProjects((ps) =>
          ps.map((p) =>
            p.id === last.entityId
              ? {
                  ...p,
                  ...(after.startDate !== undefined && { startDate: after.startDate }),
                  ...(after.endDate !== undefined && { endDate: after.endDate }),
                }
              : p
          )
        );
      } else if (last.type === "move_milestone" || last.type === "update_milestone") {
        const after = last.after as { dueDate?: string; title?: string; completed?: boolean };
        setMilestones((ms) =>
          ms.map((m) =>
            m.id === last.entityId
              ? { ...m, ...after }
              : m
          )
        );
      } else if (last.type === "delete_milestone") {
        setMilestones((ms) => ms.filter((m) => m.id !== last.entityId));
      } else if (last.type === "create_milestone") {
        const after = last.after as { milestone: TimelineMilestone };
        setMilestones((ms) => [...ms, after.milestone]);
      }

      return {
        ...prev,
        changes: [...prev.changes, last],
        undoneChanges: remaining,
      };
    });
  }, [setProjects, setMilestones]);

  const save = useCallback(async () => {
    const { changes } = stateRef.current;
    for (const change of changes) {
      await change.apiCall();
    }
    setState((s) => ({
      ...s,
      active: false,
      changes: [],
      undoneChanges: [],
      originalProjects: [],
      originalMilestones: [],
    }));
    await fetchData();
  }, [fetchData]);

  const discard = useCallback(() => {
    const { originalProjects, originalMilestones } = stateRef.current;
    setProjects(originalProjects);
    setMilestones(originalMilestones);
    setState({
      active: false,
      changes: [],
      undoneChanges: [],
      originalProjects: [],
      originalMilestones: [],
    });
  }, [setProjects, setMilestones]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!state.active) return;

    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state.active, undo, redo]);

  return {
    editMode: state.active,
    changes: state.changes,
    canUndo: state.changes.length > 0,
    canRedo: state.undoneChanges.length > 0,
    enterEditMode,
    addChange,
    undo,
    redo,
    save,
    discard,
  };
}

/** Helper: generate a unique change ID */
export function changeId(): string {
  return `chg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Helper: format a date for display in change labels */
export function formatChangeDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "d MMM");
}

/** Apply project-related changes to get current state */
function applyChanges(
  original: TimelineProject[],
  changes: EditChange[],
): TimelineProject[] {
  let result = JSON.parse(JSON.stringify(original)) as TimelineProject[];
  for (const change of changes) {
    if (change.type === "move_project" || change.type === "resize_project") {
      const after = change.after as { startDate?: string; endDate?: string };
      result = result.map((p) =>
        p.id === change.entityId
          ? {
              ...p,
              ...(after.startDate !== undefined && { startDate: after.startDate }),
              ...(after.endDate !== undefined && { endDate: after.endDate }),
            }
          : p
      );
    }
  }
  return result;
}

/** Apply milestone-related changes to get current state */
function applyMilestoneChanges(
  original: TimelineMilestone[],
  changes: EditChange[],
): TimelineMilestone[] {
  let result = JSON.parse(JSON.stringify(original)) as TimelineMilestone[];
  for (const change of changes) {
    if (change.type === "move_milestone" || change.type === "update_milestone") {
      const after = change.after as Record<string, unknown>;
      result = result.map((m) =>
        m.id === change.entityId ? { ...m, ...after } : m
      );
    } else if (change.type === "delete_milestone") {
      result = result.filter((m) => m.id !== change.entityId);
    } else if (change.type === "create_milestone") {
      const after = change.after as { milestone: TimelineMilestone };
      result = [...result, after.milestone];
    }
  }
  return result;
}
