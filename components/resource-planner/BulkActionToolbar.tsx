"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Trash2, ArrowRightLeft, X, CheckSquare } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

interface BulkActionToolbarProps {
  selectedCount: number;
  totalCount: number;
  onDelete: () => void;
  onStatusChange: (status: "tentative" | "confirmed" | "completed") => void;
  onMove: (offsetDays: number) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
}

export function BulkActionToolbar({
  selectedCount,
  totalCount,
  onDelete,
  onStatusChange,
  onMove,
  onSelectAll,
  onClearSelection,
}: BulkActionToolbarProps) {
  const t = useTranslations("resourcePlanner");
  const [moveOffset, setMoveOffset] = useState("0");
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card border shadow-2xl rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap max-w-[90vw]">
      {/* Selected count */}
      <span className="text-sm font-medium whitespace-nowrap">
        {(t("selectedCount") || "{count} selected").replace("{count}", String(selectedCount))}
      </span>

      <div className="h-6 w-px bg-border" />

      {/* Select All / Clear */}
      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onSelectAll}>
        <CheckSquare className="h-3.5 w-3.5 mr-1" />
        {t("selectAll") || "Select all"} ({totalCount})
      </Button>
      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClearSelection}>
        <X className="h-3.5 w-3.5 mr-1" />
        {t("clearSelection") || "Clear"}
      </Button>

      <div className="h-6 w-px bg-border" />

      {/* Status change */}
      <Select onValueChange={(v) => onStatusChange(v as "tentative" | "confirmed" | "completed")}>
        <SelectTrigger className="h-7 w-[140px] text-xs">
          <SelectValue placeholder={t("changeStatus") || "Change status"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="tentative">{t("tentative") || "Tentative"}</SelectItem>
          <SelectItem value="confirmed">{t("confirmed") || "Confirmed"}</SelectItem>
          <SelectItem value="completed">{t("completed") || "Completed"}</SelectItem>
        </SelectContent>
      </Select>

      {/* Move by days */}
      <div className="flex items-center gap-1">
        <Input
          type="number"
          value={moveOffset}
          onChange={(e) => setMoveOffset(e.target.value)}
          className="h-7 w-16 text-xs text-center"
          placeholder="0"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => {
            const days = parseInt(moveOffset, 10);
            if (days !== 0 && !isNaN(days)) onMove(days);
          }}
          disabled={!moveOffset || parseInt(moveOffset) === 0 || isNaN(parseInt(moveOffset))}
        >
          <ArrowRightLeft className="h-3 w-3 mr-1" />
          {t("moveDays") || "Move"}
        </Button>
      </div>

      <div className="h-6 w-px bg-border" />

      {/* Delete */}
      {!confirmDelete ? (
        <Button
          variant="destructive"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          {t("delete") || "Delete"}
        </Button>
      ) : (
        <div className="flex items-center gap-1">
          <span className="text-xs text-destructive font-medium">
            {t("confirmBulkDelete") || "Delete all selected?"}
          </span>
          <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => { onDelete(); setConfirmDelete(false); }}>
            {t("yes") || "Yes"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setConfirmDelete(false)}
          >
            {t("no") || "No"}
          </Button>
        </div>
      )}
    </div>
  );
}
