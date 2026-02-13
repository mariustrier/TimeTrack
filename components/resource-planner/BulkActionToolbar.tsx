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
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-2xl px-5 py-3.5 flex items-center gap-3 flex-wrap max-w-[90vw]"
      style={{
        background: "#1E3A5F",
        boxShadow: "0 20px 60px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.08) inset",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Selected count */}
      <span className="text-sm font-semibold text-white whitespace-nowrap">
        {(t("selectedCount") || "{count} selected").replace("{count}", String(selectedCount))}
      </span>

      <div className="h-6 w-px bg-white/20" />

      {/* Select All / Clear */}
      <Button variant="ghost" size="sm" className="h-7 text-xs text-white/80 hover:text-white hover:bg-white/10" onClick={onSelectAll}>
        <CheckSquare className="h-3.5 w-3.5 mr-1" />
        {t("selectAll") || "Select all"} ({totalCount})
      </Button>
      <Button variant="ghost" size="sm" className="h-7 text-xs text-white/80 hover:text-white hover:bg-white/10" onClick={onClearSelection}>
        <X className="h-3.5 w-3.5 mr-1" />
        {t("clearSelection") || "Clear"}
      </Button>

      <div className="h-6 w-px bg-white/20" />

      {/* Status change */}
      <Select onValueChange={(v) => onStatusChange(v as "tentative" | "confirmed" | "completed")}>
        <SelectTrigger className="h-7 w-[140px] text-xs bg-white/10 border-white/20 text-white hover:bg-white/15">
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
          className="h-7 w-16 text-xs text-center bg-white/10 border-white/20 text-white placeholder:text-white/40"
          placeholder="0"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs border-white/20 text-white hover:bg-white/10 hover:text-white"
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

      <div className="h-6 w-px bg-white/20" />

      {/* Delete */}
      {!confirmDelete ? (
        <Button
          size="sm"
          className="h-7 text-xs bg-red-500/80 hover:bg-red-500 text-white border-0"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          {t("delete") || "Delete"}
        </Button>
      ) : (
        <div className="flex items-center gap-1">
          <span className="text-xs text-red-300 font-medium">
            {t("confirmBulkDelete") || "Delete all selected?"}
          </span>
          <Button size="sm" className="h-7 text-xs bg-red-500 hover:bg-red-600 text-white border-0" onClick={() => { onDelete(); setConfirmDelete(false); }}>
            {t("yes") || "Yes"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs border-white/20 text-white hover:bg-white/10"
            onClick={() => setConfirmDelete(false)}
          >
            {t("no") || "No"}
          </Button>
        </div>
      )}
    </div>
  );
}
