"use client";

import { useEffect, useRef, useState } from "react";
import { Flag, Plus, Pencil, Copy, Trash2 } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

interface ContextMenuState {
  x: number;
  y: number;
  type: "project" | "activity" | "milestone" | "empty";
  entityId?: string;
  projectId?: string;
  date?: Date;
}

interface TimelineContextMenuProps {
  menu: ContextMenuState;
  onClose: () => void;
  onAddMilestone: (projectId: string, date: Date) => void;
  onAddActivity: (projectId: string, date?: Date) => void;
  onEditActivity: (activityId: string, projectId: string) => void;
  onDuplicateActivity: (activityId: string, projectId: string) => void;
  onDeleteActivity: (activityId: string, projectId: string) => void;
  onEditMilestone: (milestoneId: string) => void;
  onDeleteMilestone: (milestoneId: string, projectId: string) => void;
}

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}

function MenuItem({ icon, label, onClick, destructive }: MenuItemProps) {
  return (
    <button
      type="button"
      className={`w-full px-3 py-2 text-sm flex items-center gap-2 cursor-pointer transition-colors ${
        destructive
          ? "text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
      }`}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

function Separator() {
  return <div className="border-t border-gray-200 dark:border-gray-700 my-1" />;
}

export function TimelineContextMenu({
  menu,
  onClose,
  onAddMilestone,
  onAddActivity,
  onEditActivity,
  onDuplicateActivity,
  onDeleteActivity,
  onEditMilestone,
  onDeleteMilestone,
}: TimelineContextMenuProps) {
  const t = useTranslations("timeline");
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  // Animate in on mount
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid the triggering right-click from immediately closing
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [onClose]);

  // Close on scroll
  useEffect(() => {
    const handleScroll = () => onClose();
    document.addEventListener("scroll", handleScroll, true);
    return () => document.removeEventListener("scroll", handleScroll, true);
  }, [onClose]);

  // Clamp position to viewport
  const menuWidth = 180;
  const menuHeight = menu.type === "activity" ? 200 : 120;
  const left = Math.min(menu.x, window.innerWidth - menuWidth - 8);
  const top = Math.min(menu.y, window.innerHeight - menuHeight - 8);

  const iconClass = "h-4 w-4 shrink-0";

  return (
    <div
      ref={ref}
      className={`fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[180px] transition-all duration-100 origin-top-left ${
        visible
          ? "scale-100 opacity-100"
          : "scale-95 opacity-0"
      }`}
      style={{ left, top }}
    >
      {menu.type === "project" && (
        <>
          <MenuItem
            icon={<Flag className={iconClass} />}
            label={t("addMilestoneHere") || "Add milestone here"}
            onClick={() => {
              if (menu.projectId && menu.date) {
                onAddMilestone(menu.projectId, menu.date);
              }
              onClose();
            }}
          />
          <MenuItem
            icon={<Plus className={iconClass} />}
            label={t("addActivity") || "Add activity"}
            onClick={() => {
              if (menu.projectId) {
                onAddActivity(menu.projectId, menu.date);
              }
              onClose();
            }}
          />
        </>
      )}

      {menu.type === "activity" && (
        <>
          <MenuItem
            icon={<Pencil className={iconClass} />}
            label={t("edit") || "Edit"}
            onClick={() => {
              if (menu.entityId && menu.projectId) {
                onEditActivity(menu.entityId, menu.projectId);
              }
              onClose();
            }}
          />
          <MenuItem
            icon={<Copy className={iconClass} />}
            label={t("duplicate") || "Duplicate"}
            onClick={() => {
              if (menu.entityId && menu.projectId) {
                onDuplicateActivity(menu.entityId, menu.projectId);
              }
              onClose();
            }}
          />
          <Separator />
          <MenuItem
            icon={<Trash2 className={iconClass} />}
            label={t("delete") || "Delete"}
            destructive
            onClick={() => {
              if (menu.entityId && menu.projectId) {
                onDeleteActivity(menu.entityId, menu.projectId);
              }
              onClose();
            }}
          />
        </>
      )}

      {menu.type === "milestone" && (
        <>
          <MenuItem
            icon={<Pencil className={iconClass} />}
            label={t("edit") || "Edit"}
            onClick={() => {
              if (menu.entityId) {
                onEditMilestone(menu.entityId);
              }
              onClose();
            }}
          />
          <Separator />
          <MenuItem
            icon={<Trash2 className={iconClass} />}
            label={t("delete") || "Delete"}
            destructive
            onClick={() => {
              if (menu.entityId && menu.projectId) {
                onDeleteMilestone(menu.entityId, menu.projectId);
              }
              onClose();
            }}
          />
        </>
      )}

      {menu.type === "empty" && (
        <>
          <MenuItem
            icon={<Flag className={iconClass} />}
            label={t("addMilestoneHere") || "Add milestone here"}
            onClick={() => {
              if (menu.projectId && menu.date) {
                onAddMilestone(menu.projectId, menu.date);
              }
              onClose();
            }}
          />
          <MenuItem
            icon={<Plus className={iconClass} />}
            label={t("addActivityHere") || "Add activity here"}
            onClick={() => {
              if (menu.projectId) {
                onAddActivity(menu.projectId, menu.date);
              }
              onClose();
            }}
          />
        </>
      )}
    </div>
  );
}
