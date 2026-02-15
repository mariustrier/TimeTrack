"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  startOfQuarter,
  endOfQuarter,
} from "date-fns";
import { getToday } from "@/lib/demo-date";
import type {
  TimelineProject,
  TimelineMilestone,
  TimelineActivity,
} from "@/components/project-timeline/types";

/* ─────────────────────────────────────────────
   TYPES
   ───────────────────────────────────────────── */

interface TimelineExportPopoverProps {
  projects: Array<{
    id: string;
    name: string;
    color: string;
    client: string | null;
    archived: boolean;
    locked: boolean;
    budgetHours: number | null;
  }>;
  rawProjects: TimelineProject[];
  milestones: TimelineMilestone[];
  companyName: string;
  userName: string;
  isDemo?: boolean;
}

/* ─────────────────────────────────────────────
   SVG ICONS
   ───────────────────────────────────────────── */

const DownloadIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M7 1.75V9.625M7 9.625L4.375 7M7 9.625L9.625 7M2.625 11.375H11.375"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SpreadsheetIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="2"
      y="2"
      width="10"
      height="10"
      rx="1.5"
      stroke="currentColor"
      strokeWidth="1.3"
    />
    <line x1="2" y1="5.5" x2="12" y2="5.5" stroke="currentColor" strokeWidth="1.3" />
    <line x1="2" y1="8.5" x2="12" y2="8.5" stroke="currentColor" strokeWidth="1.3" />
    <line x1="5.5" y1="5.5" x2="5.5" y2="12" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);

const DocumentIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M8.75 1.75H3.5C3.10218 1.75 2.72064 1.90804 2.43934 2.18934C2.15804 2.47064 2 2.85218 2 3.25V10.75C2 11.1478 2.15804 11.5294 2.43934 11.8107C2.72064 12.092 3.10218 12.25 3.5 12.25H10.5C10.8978 12.25 11.2794 12.092 11.5607 11.8107C11.842 11.5294 12 11.1478 12 10.75V5L8.75 1.75Z"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8.75 1.75V5H12"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line x1="4.5" y1="7.5" x2="9.5" y2="7.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    <line x1="4.5" y1="9.5" x2="8" y2="9.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
  </svg>
);

const CheckIcon = ({ size = 10 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 10 10"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M2 5.2L4.2 7.4L8.2 2.6"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SpinnerKeyframes = `
@keyframes timeline-export-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`;

const SpinnerIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ animation: "timeline-export-spin 0.8s linear infinite" }}
  >
    <circle cx="7" cy="7" r="5.5" stroke="#D1D5DB" strokeWidth="1.5" />
    <path
      d="M12.5 7C12.5 3.96243 10.0376 1.5 7 1.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

/* ─────────────────────────────────────────────
   COMPONENT
   ───────────────────────────────────────────── */

export const TimelineExportPopover = ({
  projects,
  rawProjects,
  milestones,
  companyName,
  userName,
  isDemo,
}: TimelineExportPopoverProps) => {
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(projects.map((p) => p.id))
  );
  const [dateStart, setDateStart] = useState<string>("");
  const [dateEnd, setDateEnd] = useState<string>("");
  const [includeActivities, setIncludeActivities] = useState(true);
  const [includeMilestones, setIncludeMilestones] = useState(true);
  const [includeBudget, setIncludeBudget] = useState(true);
  const [loading, setLoading] = useState<"excel" | "pdf" | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [btnHover, setBtnHover] = useState(false);

  /* ── Reset selectedIds when projects change ── */
  useEffect(() => {
    setSelectedIds(new Set(projects.map((p) => p.id)));
  }, [projects]);

  /* ── Close on outside click ── */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  /* ── Close on Escape ── */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  /* ── Ctrl/Cmd+E keyboard shortcut ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "e") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  /* ── Computed values ── */
  const selectedCount = selectedIds.size;
  const totalCount = projects.length;
  const hasSelection = selectedCount > 0;

  const computedDateRange = useCallback(() => {
    const selected = rawProjects.filter((p) => selectedIds.has(p.id));
    let earliest = "";
    let latest = "";
    Array.from(selected).forEach((p) => {
      if (p.startDate) {
        const s = p.startDate.slice(0, 10);
        if (!earliest || s < earliest) earliest = s;
      }
      if (p.endDate) {
        const e = p.endDate.slice(0, 10);
        if (!latest || e > latest) latest = e;
      }
    });
    return { earliest, latest };
  }, [rawProjects, selectedIds]);

  const dateRangeLabel = (() => {
    const ds = dateStart || computedDateRange().earliest;
    const de = dateEnd || computedDateRange().latest;
    if (ds && de) {
      try {
        const s = format(new Date(ds), "dd/MM/yy");
        const e = format(new Date(de), "dd/MM/yy");
        return `${s} – ${e}`;
      } catch {
        return "Alt";
      }
    }
    return "Alt";
  })();

  /* ── Project quick-select helpers ── */
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(projects.map((p) => p.id)));
  }, [projects]);

  const selectActive = useCallback(() => {
    setSelectedIds(
      new Set(
        projects.filter((p) => !p.archived && !p.locked).map((p) => p.id)
      )
    );
  }, [projects]);

  const selectBillable = useCallback(() => {
    setSelectedIds(
      new Set(
        projects
          .filter((p) => p.budgetHours !== null && p.budgetHours > 0)
          .map((p) => p.id)
      )
    );
  }, [projects]);

  const toggleProject = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  /* ── Date quick-select helpers ── */
  const clearDates = useCallback(() => {
    setDateStart("");
    setDateEnd("");
  }, []);

  const setThisMonth = useCallback(() => {
    const today = getToday(isDemo);
    setDateStart(format(startOfMonth(today), "yyyy-MM-dd"));
    setDateEnd(format(endOfMonth(today), "yyyy-MM-dd"));
  }, [isDemo]);

  const setThisQuarter = useCallback(() => {
    const today = getToday(isDemo);
    setDateStart(format(startOfQuarter(today), "yyyy-MM-dd"));
    setDateEnd(format(endOfQuarter(today), "yyyy-MM-dd"));
  }, [isDemo]);

  const setThisYear = useCallback(() => {
    const today = getToday(isDemo);
    setDateStart(format(startOfYear(today), "yyyy-MM-dd"));
    setDateEnd(format(endOfYear(today), "yyyy-MM-dd"));
  }, [isDemo]);

  /* ── Activity fetching ── */
  const fetchActivitiesForSelected = async (): Promise<
    Record<string, TimelineActivity[]>
  > => {
    const ids = Array.from(selectedIds);
    const results = await Promise.all(
      ids.map(async (id) => {
        const res = await fetch(`/api/projects/${id}/activities`);
        if (!res.ok) return { id, activities: [] as TimelineActivity[] };
        const data = await res.json();
        return { id, activities: data as TimelineActivity[] };
      })
    );
    const record: Record<string, TimelineActivity[]> = {};
    results.forEach(({ id, activities }) => {
      record[id] = activities;
    });
    return record;
  };

  /* ── Filter application ── */
  const applyFilters = (
    allActivities: Record<string, TimelineActivity[]>
  ) => {
    const filteredProjects = rawProjects.filter((p) => selectedIds.has(p.id));

    const filteredActivities: Record<string, TimelineActivity[]> = {};
    if (includeActivities) {
      filteredProjects.forEach((p) => {
        let acts = allActivities[p.id] || [];
        if (dateStart && dateEnd) {
          acts = acts.filter(
            (a) => a.endDate >= dateStart && a.startDate <= dateEnd
          );
        }
        filteredActivities[p.id] = acts;
      });
    }

    let filteredMilestones = includeMilestones
      ? milestones.filter((m) => selectedIds.has(m.projectId))
      : [];
    if (dateStart && dateEnd && filteredMilestones.length > 0) {
      filteredMilestones = filteredMilestones.filter(
        (m) => m.dueDate >= dateStart && m.dueDate <= dateEnd
      );
    }

    return {
      projects: filteredProjects,
      activities: filteredActivities,
      milestones: filteredMilestones,
    };
  };

  /* ── Export handlers ── */
  const handleExcelExport = async () => {
    setLoading("excel");
    try {
      const activities = await fetchActivitiesForSelected();
      const filtered = applyFilters(activities);
      const { exportTimelineToExcel } = await import(
        "@/lib/timeline-excel-export"
      );
      await exportTimelineToExcel({
        projects: filtered.projects,
        activities: filtered.activities,
        milestones: filtered.milestones,
        companyName,
        generatedBy: userName,
        includeBudget,
        includeMilestones,
        includeActivities,
        isDemo,
      });
      setOpen(false);
    } catch (err) {
      console.error("Excel export failed:", err);
    } finally {
      setLoading(null);
    }
  };

  const handlePdfExport = async () => {
    setLoading("pdf");
    try {
      const activities = await fetchActivitiesForSelected();
      const filtered = applyFilters(activities);
      const { pdf } = await import("@react-pdf/renderer");
      const { TimelinePdfDocument } = await import("./TimelinePdfDocument");
      const { saveAs } = await import("file-saver");
      const React = await import("react");

      const doc = React.createElement(TimelinePdfDocument, {
        projects: filtered.projects,
        activities: filtered.activities,
        milestones: filtered.milestones,
        companyName,
        generatedBy: userName,
        includeBudget,
        includeMilestones,
        includeActivities,
        isDemo,
        dateRange:
          dateStart && dateEnd
            ? { start: new Date(dateStart), end: new Date(dateEnd) }
            : undefined,
      });

      const blob = await pdf(doc).toBlob();
      const today = getToday(isDemo);
      const dateStr = format(today, "dd-MM-yyyy");
      const filename = `Projekttidslinje — ${companyName} — ${dateStr}.pdf`;
      saveAs(blob, filename);
      setOpen(false);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setLoading(null);
    }
  };

  /* ── Quick-select pill active state helpers ── */
  const allSelected = selectedCount === totalCount;
  const activeSelected =
    selectedCount ===
      projects.filter((p) => !p.archived && !p.locked).length &&
    selectedCount > 0 &&
    projects
      .filter((p) => !p.archived && !p.locked)
      .every((p) => selectedIds.has(p.id));
  const billableSelected =
    selectedCount ===
      projects.filter((p) => p.budgetHours !== null && p.budgetHours > 0)
        .length &&
    selectedCount > 0 &&
    projects
      .filter((p) => p.budgetHours !== null && p.budgetHours > 0)
      .every((p) => selectedIds.has(p.id));

  const isDateAll = !dateStart && !dateEnd;
  const isDateThisMonth = (() => {
    const today = getToday(isDemo);
    return (
      dateStart === format(startOfMonth(today), "yyyy-MM-dd") &&
      dateEnd === format(endOfMonth(today), "yyyy-MM-dd")
    );
  })();
  const isDateThisQuarter = (() => {
    const today = getToday(isDemo);
    return (
      dateStart === format(startOfQuarter(today), "yyyy-MM-dd") &&
      dateEnd === format(endOfQuarter(today), "yyyy-MM-dd")
    );
  })();
  const isDateThisYear = (() => {
    const today = getToday(isDemo);
    return (
      dateStart === format(startOfYear(today), "yyyy-MM-dd") &&
      dateEnd === format(endOfYear(today), "yyyy-MM-dd")
    );
  })();

  /* ── Shared styles ── */
  const FONT = "'DM Sans', 'Avenir Next', system-ui, sans-serif";
  const MONO = "'JetBrains Mono', monospace";
  const BRAND = "#1E3A5F";

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 500,
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily: FONT,
    margin: 0,
  };

  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: "4px 10px",
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 500,
    fontFamily: FONT,
    background: active ? BRAND : "#F3F4F6",
    color: active ? "#fff" : "#6B7280",
    border: "none",
    cursor: "pointer",
    transition: "background 0.12s, color 0.12s",
  });

  const checkboxStyle = (checked: boolean): React.CSSProperties => ({
    width: 14,
    height: 14,
    borderRadius: 3,
    border: checked ? `1.5px solid ${BRAND}` : "1.5px solid #D1D5DB",
    background: checked ? BRAND : "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    cursor: "pointer",
    transition: "background 0.12s, border-color 0.12s",
  });

  const exportBtnStyle = (disabled: boolean): React.CSSProperties => ({
    height: 40,
    borderRadius: 8,
    border: `1.5px solid ${BRAND}`,
    background: "#fff",
    color: BRAND,
    fontSize: 12,
    fontWeight: 500,
    fontFamily: FONT,
    cursor: disabled ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flex: 1,
    opacity: disabled ? 0.4 : 1,
    transition: "background 0.12s",
  });

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SpinnerKeyframes }} />
      <div
        ref={popoverRef}
        style={{ position: "relative", display: "inline-block" }}
      >
        {/* ── Trigger button ── */}
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          onMouseEnter={() => setBtnHover(true)}
          onMouseLeave={() => setBtnHover(false)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 16px",
            border: "1px solid #E5E7EB",
            borderRadius: 6,
            background: btnHover ? "#F9FAFB" : "#fff",
            color: "#374151",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: FONT,
            transition: "background 0.12s",
          }}
        >
          <DownloadIcon />
          Eksportér
        </button>

        {/* ── Popover ── */}
        {open && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              right: 0,
              marginTop: 8,
              width: 340,
              background: "#fff",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow:
                "0 20px 60px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.08)",
              padding: 20,
              zIndex: 100,
              opacity: open ? 1 : 0,
              transform: open ? "translateY(0)" : "translateY(-4px)",
              transition: "opacity 0.15s, transform 0.15s",
            }}
          >
            {/* ── Title ── */}
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#1F2937",
                fontFamily: FONT,
                margin: 0,
              }}
            >
              Eksportér tidslinje
            </div>

            {/* ── Project selection ── */}
            <div style={{ marginTop: 16 }}>
              <div style={sectionLabelStyle}>PROJEKTER</div>

              {/* Quick-select pills */}
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginTop: 8,
                }}
              >
                <button
                  type="button"
                  onClick={selectAll}
                  onMouseEnter={(e) => {
                    if (!allSelected)
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "#E5E7EB";
                  }}
                  onMouseLeave={(e) => {
                    if (!allSelected)
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "#F3F4F6";
                  }}
                  style={pillStyle(allSelected)}
                >
                  Alle
                </button>
                <button
                  type="button"
                  onClick={selectActive}
                  onMouseEnter={(e) => {
                    if (!activeSelected)
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "#E5E7EB";
                  }}
                  onMouseLeave={(e) => {
                    if (!activeSelected)
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "#F3F4F6";
                  }}
                  style={pillStyle(activeSelected)}
                >
                  Aktive
                </button>
                <button
                  type="button"
                  onClick={selectBillable}
                  onMouseEnter={(e) => {
                    if (!billableSelected)
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "#E5E7EB";
                  }}
                  onMouseLeave={(e) => {
                    if (!billableSelected)
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "#F3F4F6";
                  }}
                  style={pillStyle(billableSelected)}
                >
                  Fakturerbare
                </button>
              </div>

              {/* Project checklist */}
              <div
                style={{
                  marginTop: 8,
                  maxHeight: 180,
                  overflowY: "auto",
                }}
              >
                {projects.map((p) => {
                  const checked = selectedIds.has(p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => toggleProject(p.id)}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLDivElement).style.background =
                          "#F9FAFB";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLDivElement).style.background =
                          "transparent";
                      }}
                      style={{
                        height: 28,
                        display: "flex",
                        alignItems: "center",
                        padding: "0 8px",
                        borderRadius: 4,
                        cursor: "pointer",
                        gap: 8,
                        transition: "background 0.1s",
                      }}
                    >
                      <div style={checkboxStyle(checked)}>
                        {checked && <CheckIcon />}
                      </div>
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: p.color,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 12,
                          color: "#374151",
                          fontFamily: FONT,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {p.name}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Count text */}
              {selectedCount < totalCount && (
                <div
                  style={{
                    fontSize: 11,
                    color: "#9CA3AF",
                    fontFamily: FONT,
                    marginTop: 4,
                  }}
                >
                  {selectedCount} af {totalCount} valgt
                </div>
              )}
            </div>

            {/* ── Date range ── */}
            <div style={{ marginTop: 16 }}>
              <div style={sectionLabelStyle}>TIDSPERIODE</div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 8,
                }}
              >
                <input
                  type="date"
                  value={dateStart}
                  placeholder={computedDateRange().earliest || "Start"}
                  onChange={(e) => setDateStart(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 10px",
                    border: "1px solid #E5E7EB",
                    borderRadius: 6,
                    fontSize: 12,
                    fontFamily: MONO,
                    height: 32,
                    color: "#374151",
                    background: "#fff",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <input
                  type="date"
                  value={dateEnd}
                  placeholder={computedDateRange().latest || "Slut"}
                  onChange={(e) => setDateEnd(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 10px",
                    border: "1px solid #E5E7EB",
                    borderRadius: 6,
                    fontSize: 12,
                    fontFamily: MONO,
                    height: 32,
                    color: "#374151",
                    background: "#fff",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Date quick-select pills */}
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginTop: 6,
                  flexWrap: "wrap",
                }}
              >
                {(
                  [
                    { label: "Alt", active: isDateAll, action: clearDates },
                    {
                      label: "Denne måned",
                      active: isDateThisMonth,
                      action: setThisMonth,
                    },
                    {
                      label: "Dette kvartal",
                      active: isDateThisQuarter,
                      action: setThisQuarter,
                    },
                    {
                      label: "I år",
                      active: isDateThisYear,
                      action: setThisYear,
                    },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.action}
                    onMouseEnter={(e) => {
                      if (!item.active)
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.background = "#E5E7EB";
                    }}
                    onMouseLeave={(e) => {
                      if (!item.active)
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.background = "#F3F4F6";
                    }}
                    style={pillStyle(item.active)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Include options ── */}
            <div style={{ marginTop: 16 }}>
              <div style={sectionLabelStyle}>INKLUDÉR</div>

              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                {(
                  [
                    {
                      label: "Aktiviteter",
                      checked: includeActivities,
                      toggle: () => setIncludeActivities((v) => !v),
                    },
                    {
                      label: "Milepæle",
                      checked: includeMilestones,
                      toggle: () => setIncludeMilestones((v) => !v),
                    },
                    {
                      label: "Budget & økonomi",
                      checked: includeBudget,
                      toggle: () => setIncludeBudget((v) => !v),
                    },
                  ] as const
                ).map((opt) => (
                  <div
                    key={opt.label}
                    onClick={opt.toggle}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background =
                        "#F9FAFB";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background =
                        "transparent";
                    }}
                    style={{
                      height: 28,
                      display: "flex",
                      alignItems: "center",
                      padding: "0 8px",
                      borderRadius: 4,
                      cursor: "pointer",
                      gap: 8,
                      transition: "background 0.1s",
                    }}
                  >
                    <div style={checkboxStyle(opt.checked)}>
                      {opt.checked && <CheckIcon />}
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        color: "#374151",
                        fontFamily: FONT,
                      }}
                    >
                      {opt.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Export buttons ── */}
            <div
              style={{
                marginTop: 16,
                display: "flex",
                gap: 8,
              }}
            >
              <button
                type="button"
                disabled={!hasSelection || loading !== null}
                onClick={handleExcelExport}
                onMouseEnter={(e) => {
                  if (hasSelection && !loading)
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "#F0F4F8";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "#fff";
                }}
                style={exportBtnStyle(!hasSelection || loading !== null)}
              >
                {loading === "excel" ? <SpinnerIcon /> : <SpreadsheetIcon />}
                {loading === "excel" ? "Genererer..." : "Excel"}
              </button>
              <button
                type="button"
                disabled={!hasSelection || loading !== null}
                onClick={handlePdfExport}
                onMouseEnter={(e) => {
                  if (hasSelection && !loading)
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "#F0F4F8";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "#fff";
                }}
                style={exportBtnStyle(!hasSelection || loading !== null)}
              >
                {loading === "pdf" ? <SpinnerIcon /> : <DocumentIcon />}
                {loading === "pdf" ? "Genererer..." : "PDF"}
              </button>
            </div>

            {/* ── Footer note ── */}
            <div
              style={{
                marginTop: 12,
                fontSize: 11,
                fontFamily: FONT,
                color: hasSelection ? "#9CA3AF" : "#DC2626",
              }}
            >
              {hasSelection
                ? `Eksporterer ${selectedCount} projekter · ${dateRangeLabel}`
                : "Vælg mindst ét projekt"}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default TimelineExportPopover;
