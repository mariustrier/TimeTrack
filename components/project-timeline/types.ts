export type TimelineViewMode = "day" | "week" | "month";

export interface TimelineProject {
  id: string;
  name: string;
  color: string;
  client: string | null;
  startDate: string | null;
  endDate: string | null;
  budgetHours: number | null;
  hoursUsed: number;
  archived: boolean;
  locked: boolean;
  currentPhase: { id: string; name: string; color: string } | null;
  projectPhases?: TimelineProjectPhase[];
  allocations?: TimelineAllocation[];
  burndown?: BurndownPoint[];
  activityCount?: number;
  activityCompletedCount?: number;
}

export interface TimelineProjectPhase {
  id: string;
  phaseId: string;
  phaseName: string;
  phaseColor: string;
  startDate: string;
  endDate: string;
  status: string;
}

export interface TimelineAllocation {
  id: string;
  userId: string;
  userName: string;
  userImageUrl: string | null;
  startDate: string;
  endDate: string;
  hoursPerDay: number;
  status: string;
}

export type DeadlineIcon = "flag" | "handshake" | "rocket" | "eye" | "calendar";
export const DEADLINE_ICONS: DeadlineIcon[] = ["flag", "handshake", "rocket", "eye", "calendar"];

export interface TimelineMilestone {
  id: string;
  projectId: string;
  title: string;
  dueDate: string;
  completed: boolean;
  completedAt: string | null;
  sortOrder: number;
  type: "phase" | "custom";
  phaseId: string | null;
  phaseName: string | null;
  phaseColor: string | null;
  description: string | null;
  icon: DeadlineIcon | null;
  color: string | null;
}

export interface TimelineColumn {
  key: string;
  label: string;
  start: Date;
  end: Date;
  containsToday: boolean;
  month: Date;
}

export interface BurndownPoint {
  weekStart: string;
  plannedCumulative: number;
  actualCumulative: number;
}

export interface TimelineConflict {
  userId: string;
  userName: string;
  date: string;
  totalHours: number;
  dailyCapacity: number;
  projects: Array<{
    projectId: string;
    projectName: string;
    projectColor: string;
    hours: number;
  }>;
}

export interface VisibilityToggles {
  phases: boolean;
  team: boolean;
  burndown: boolean;
  conflicts: boolean;
}

export type ActivityStatus = "not_started" | "in_progress" | "needs_review" | "complete";

export interface TimelineActivity {
  id: string;
  projectId: string;
  name: string;
  sortOrder: number;
  phaseId: string | null;
  phaseName: string | null;
  phaseColor: string | null;
  categoryName: string | null;
  assignedUserId: string | null;
  assignedUserName: string | null;
  assignedUserImageUrl: string | null;
  startDate: string;
  endDate: string;
  status: ActivityStatus;
  color: string | null;
  note: string | null;
}

export interface DragState {
  type: "move" | "resize-start" | "resize-end" | "milestone" | "activity-move" | "activity-resize-start" | "activity-resize-end";
  entityId: string;
  projectId: string;
  startX: number;
  originalStart: Date;
  originalEnd: Date;
}

export interface DragResult {
  type: DragState["type"];
  entityId: string;
  projectId: string;
  newStart?: Date;
  newEnd?: Date;
  newDate?: Date; // for milestones
}

export interface CompanyPhase {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
}
