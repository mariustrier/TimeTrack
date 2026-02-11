export type ProjectStatus = "active" | "paused" | "inactive";

export function getProjectStatus(project: { locked: boolean; archived: boolean }): ProjectStatus {
  if (project.archived) return "inactive";
  if (project.locked) return "paused";
  return "active";
}

export const PROJECT_STATUS_CONFIG: Record<ProjectStatus, { colorClass: string }> = {
  active: {
    colorClass: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800",
  },
  paused: {
    colorClass: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  },
  inactive: {
    colorClass: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700",
  },
};
