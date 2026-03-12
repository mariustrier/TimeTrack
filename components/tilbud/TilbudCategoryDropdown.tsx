"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations } from "@/lib/i18n";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TilbudCategoryOption {
  id: string;
  name: string;
  faseNumber?: number;
  parentId?: string;
  parentName?: string;
  quotedHours?: number;
  isTimeloen: boolean;
  timeloenEstimate?: string;
  usedHours: number;
  isRecurring: boolean;
  sortOrder: number;
}

interface TilbudCategoryDropdownProps {
  projectId: string;
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  categories: TilbudCategoryOption[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RECENT_KEY = (projectId: string) =>
  `cloudtimer:tilbudRecent:${projectId}`;

const MAX_RECENT = 3;

function getRecentIds(projectId: string): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecentId(projectId: string, categoryId: string): void {
  try {
    const existing = getRecentIds(projectId);
    const updated = [categoryId, ...existing.filter((id) => id !== categoryId)].slice(
      0,
      MAX_RECENT,
    );
    localStorage.setItem(RECENT_KEY(projectId), JSON.stringify(updated));
  } catch {
    // localStorage unavailable — silently ignore
  }
}

function budgetPct(used: number, quoted: number | undefined): number {
  if (!quoted || quoted <= 0) return 0;
  return (used / quoted) * 100;
}

type BudgetSeverity = "default" | "warning" | "danger" | "exceeded";

function budgetSeverity(used: number, quoted: number | undefined): BudgetSeverity {
  const pct = budgetPct(used, quoted);
  if (pct > 100) return "exceeded";
  if (pct > 95) return "danger";
  if (pct > 80) return "warning";
  return "default";
}

// ---------------------------------------------------------------------------
// Grouped data structure
// ---------------------------------------------------------------------------

interface FaseGroup {
  parentId: string | null;
  faseNumber: number | undefined;
  parentName: string | undefined;
  subtotalHours: number;
  items: TilbudCategoryOption[];
}

function groupByFase(categories: TilbudCategoryOption[]): FaseGroup[] {
  const map = new Map<string, FaseGroup>();

  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);

  for (const cat of sorted) {
    const key = cat.parentId ?? "__root__";
    let group = map.get(key);
    if (!group) {
      group = {
        parentId: cat.parentId ?? null,
        faseNumber: cat.faseNumber,
        parentName: cat.parentName,
        subtotalHours: 0,
        items: [],
      };
      map.set(key, group);
    }
    group.subtotalHours += cat.quotedHours ?? 0;
    group.items.push(cat);
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.faseNumber != null && b.faseNumber != null) return a.faseNumber - b.faseNumber;
    if (a.faseNumber != null) return -1;
    if (b.faseNumber != null) return 1;
    return 0;
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TilbudCategoryDropdown({
  projectId,
  value,
  onChange,
  disabled = false,
  categories,
}: TilbudCategoryDropdownProps) {
  const t = useTranslations("tilbud");

  const [recentIds, setRecentIds] = useState<string[]>([]);

  // Load recent on mount / projectId change
  useEffect(() => {
    setRecentIds(getRecentIds(projectId));
  }, [projectId]);

  // Memoize grouped data
  const faseGroups = useMemo(() => groupByFase(categories), [categories]);

  const recentCategories = useMemo(() => {
    return recentIds
      .map((id) => categories.find((c) => c.id === id))
      .filter(Boolean) as TilbudCategoryOption[];
  }, [recentIds, categories]);

  const selectedCategory = useMemo(
    () => (value ? categories.find((c) => c.id === value) ?? null : null),
    [value, categories],
  );

  // Handle selection
  const handleChange = useCallback(
    (newValue: string) => {
      if (newValue === "__clear__") {
        onChange(null);
        return;
      }
      onChange(newValue);
      saveRecentId(projectId, newValue);
      setRecentIds(getRecentIds(projectId));
    },
    [onChange, projectId],
  );

  // Budget feedback for selected category
  const feedbackText = useMemo(() => {
    if (!selectedCategory) return null;
    const { usedHours, quotedHours, isTimeloen, timeloenEstimate } = selectedCategory;
    if (isTimeloen) {
      return timeloenEstimate
        ? `${t("timeloenEstimate")}: ${timeloenEstimate}`
        : t("timeloenNoEstimate");
    }
    if (!quotedHours || quotedHours <= 0) return null;
    const pct = Math.round((usedHours / quotedHours) * 100);
    return `${usedHours.toFixed(1)} ${t("of")} ${quotedHours.toFixed(1)} ${t("hoursUsed")} (${pct}%)`;
  }, [selectedCategory, t]);

  // Badge renderer
  const renderBadge = (cat: TilbudCategoryOption) => {
    if (cat.isTimeloen) {
      return (
        <span
          className="ml-auto inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium"
          style={{
            background: "#EEF2FF",
            color: "#4F46E5",
            fontStyle: "italic",
          }}
        >
          {t("timeloen")}
        </span>
      );
    }
    if (cat.quotedHours == null || cat.quotedHours <= 0) return null;

    const remaining = Math.max(cat.quotedHours - cat.usedHours, 0);
    const severity = budgetSeverity(cat.usedHours, cat.quotedHours);

    const styles: Record<BudgetSeverity, { bg: string; color: string; border: string }> = {
      default: { bg: "hsl(var(--secondary))", color: "hsl(var(--secondary-foreground))", border: "transparent" },
      warning: { bg: "#FFFBEB", color: "#92400E", border: "#FDE68A" },
      danger: { bg: "#FEF2F2", color: "#991B1B", border: "#FECACA" },
      exceeded: { bg: "#FEE2E2", color: "#991B1B", border: "#FCA5A5" },
    };
    const s = styles[severity];

    return (
      <span
        className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium"
        style={{
          background: s.bg,
          color: s.color,
          border: `1px solid ${s.border}`,
        }}
      >
        {severity === "danger" || severity === "exceeded" ? "\u26A0 " : ""}
        {remaining.toFixed(0)}/{cat.quotedHours.toFixed(0)}t
      </span>
    );
  };

  return (
    <div className="space-y-1.5">
      <Select
        value={value ?? undefined}
        onValueChange={handleChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t("selectCategory")} />
        </SelectTrigger>
        <SelectContent className="max-h-[320px]">
          {/* Clear option */}
          {value && (
            <SelectItem value="__clear__" className="text-muted-foreground text-xs">
              {t("clearSelection")}
            </SelectItem>
          )}

          {/* Recent section */}
          {recentCategories.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                {t("recent")}
              </SelectLabel>
              {recentCategories.map((cat) => (
                <SelectItem key={`recent-${cat.id}`} value={cat.id}>
                  <span className="flex w-full items-center gap-2">
                    <span
                      className="truncate"
                      style={cat.isTimeloen ? { fontStyle: "italic" } : undefined}
                    >
                      {cat.name}
                    </span>
                    {renderBadge(cat)}
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          )}

          {/* Fase groups */}
          {faseGroups.map((group, gi) => (
            <SelectGroup key={group.parentId ?? `group-${gi}`}>
              <SelectLabel className="text-xs font-semibold">
                {group.faseNumber != null
                  ? `Fase ${group.faseNumber} \u2014 ${group.parentName ?? t("unnamed")} \u00B7 ${group.subtotalHours.toFixed(0)}t`
                  : group.parentName
                    ? `${group.parentName} \u00B7 ${group.subtotalHours.toFixed(0)}t`
                    : `${t("ungrouped")} \u00B7 ${group.subtotalHours.toFixed(0)}t`}
              </SelectLabel>
              {group.items.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  <span className="flex w-full items-center gap-2">
                    <span
                      className="truncate"
                      style={cat.isTimeloen ? { fontStyle: "italic" } : undefined}
                    >
                      {cat.name}
                    </span>
                    {renderBadge(cat)}
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}

          {/* Empty state */}
          {categories.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t("noCategories")}
            </div>
          )}
        </SelectContent>
      </Select>

      {/* Budget feedback hint */}
      {feedbackText && (
        <p className="text-xs text-muted-foreground pl-1">{feedbackText}</p>
      )}
    </div>
  );
}
