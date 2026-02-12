"use client";

import { Palmtree } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

interface VacationBlockProps {
  type: string;
}

export function VacationBlock({ type }: VacationBlockProps) {
  const t = useTranslations("resourcePlanner");

  const label =
    type === "sick"
      ? t("sick") || "Sick"
      : type === "personal"
        ? t("personal") || "Personal"
        : t("vacation") || "Vacation";

  return (
    <div
      className="flex items-center gap-1 rounded px-1.5 py-0.5 bg-teal-500/80 dark:bg-teal-600/70"
      title={label}
    >
      <Palmtree className="h-3 w-3 text-white shrink-0" />
      <span className="text-[11px] font-medium text-white truncate drop-shadow-sm">
        {label}
      </span>
    </div>
  );
}
