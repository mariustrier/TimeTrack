"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  addDays,
  addWeeks,
  addMonths,
  startOfWeek,
  startOfMonth,
  differenceInDays,
} from "date-fns";
import type { TimelineColumn, TimelineViewMode, DragState, DragResult } from "./types";

interface UseTimelineDragOptions {
  columns: TimelineColumn[];
  viewMode: TimelineViewMode;
  onDragEnd: (result: DragResult) => void;
}

export function useTimelineDrag({
  columns,
  viewMode,
  onDragEnd,
}: UseTimelineDragOptions) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [ghostOffset, setGhostOffset] = useState(0);
  const columnWidthRef = useRef(0);

  // Calculate average column width from DOM
  const updateColumnWidth = useCallback(() => {
    const cells = document.querySelectorAll("[data-timeline-col]");
    if (cells.length > 0) {
      const first = cells[0].getBoundingClientRect();
      columnWidthRef.current = first.width;
    }
  }, []);

  // Convert pixel offset to date offset
  const pixelToDateOffset = useCallback(
    (pixelDelta: number): { start: Date; end: Date } | null => {
      if (!dragState || columnWidthRef.current === 0) return null;

      const colWidth = columnWidthRef.current;
      const unitOffset = Math.round(pixelDelta / colWidth);

      const addUnit = (date: Date, units: number): Date => {
        switch (viewMode) {
          case "day":
            return addDays(date, units);
          case "week":
            return addWeeks(date, units);
          case "month":
            return addMonths(date, units);
          case "year":
            return addMonths(date, units);
        }
      };

      const snapDate = (date: Date): Date => {
        switch (viewMode) {
          case "day":
            return date; // days are already snapped
          case "week":
            return startOfWeek(date, { weekStartsOn: 1 });
          case "month":
            return startOfMonth(date);
          case "year":
            return startOfMonth(date);
        }
      };

      // Normalize activity-* types to base types for shared math
      const normalizedType = dragState.type.replace("activity-", "") as string;

      if (normalizedType === "move") {
        const newStart = snapDate(addUnit(dragState.originalStart, unitOffset));
        const duration = differenceInDays(dragState.originalEnd, dragState.originalStart);
        const newEnd = addDays(newStart, duration);
        return { start: newStart, end: newEnd };
      } else if (normalizedType === "resize-start") {
        const newStart = snapDate(addUnit(dragState.originalStart, unitOffset));
        // Don't allow start to go past end
        if (newStart >= dragState.originalEnd) return null;
        return { start: newStart, end: dragState.originalEnd };
      } else if (normalizedType === "resize-end") {
        const newEnd = snapDate(addUnit(dragState.originalEnd, unitOffset));
        // Don't allow end to go before start
        if (newEnd <= dragState.originalStart) return null;
        return { start: dragState.originalStart, end: newEnd };
      } else if (normalizedType === "milestone") {
        const newDate = snapDate(addUnit(dragState.originalStart, unitOffset));
        return { start: newDate, end: newDate };
      }

      return null;
    },
    [dragState, viewMode]
  );

  const startDrag = useCallback(
    (
      type: DragState["type"],
      entityId: string,
      projectId: string,
      mouseX: number,
      originalStart: Date,
      originalEnd: Date
    ) => {
      updateColumnWidth();
      setDragState({
        type,
        entityId,
        projectId,
        startX: mouseX,
        originalStart,
        originalEnd,
      });
      const isMove = type === "move" || type === "activity-move" || type === "milestone";
      document.body.style.cursor = isMove ? "grabbing" : "col-resize";
      document.body.style.userSelect = "none";
    },
    [updateColumnWidth]
  );

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragState.startX;
      setGhostOffset(dx);
    };

    const handleMouseUp = (e: MouseEvent) => {
      const dx = e.clientX - dragState.startX;
      const dates = pixelToDateOffset(dx);

      if (dates && Math.abs(dx) > 5) {
        // Only trigger if moved more than 5px (avoid accidental drags)
        if (dragState.type === "milestone") {
          onDragEnd({
            type: dragState.type,
            entityId: dragState.entityId,
            projectId: dragState.projectId,
            newDate: dates.start,
          });
        } else {
          onDragEnd({
            type: dragState.type,
            entityId: dragState.entityId,
            projectId: dragState.projectId,
            newStart: dates.start,
            newEnd: dates.end,
          });
        }
      }

      setDragState(null);
      setGhostOffset(0);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState, pixelToDateOffset, onDragEnd]);

  // Compute preview dates from current ghost offset
  const previewDates = dragState ? pixelToDateOffset(ghostOffset) : null;

  return {
    dragState,
    ghostOffset,
    previewDates,
    startDrag,
    isDragging: !!dragState,
  };
}
