"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface SelectOption {
  value: string;
  label: string;
  color?: string;
}

interface InlineEditCellProps {
  value: string;
  onSave: (newValue: string) => void;
  type?: "text" | "date" | "select";
  options?: SelectOption[];
  placeholder?: string;
  className?: string;
  displayClassName?: string;
  renderDisplay?: (value: string) => React.ReactNode;
  readOnly?: boolean;
}

export function InlineEditCell({
  value,
  onSave,
  type = "text",
  options = [],
  placeholder,
  className,
  displayClassName,
  renderDisplay,
  readOnly = false,
}: InlineEditCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  const handleSave = (newValue: string) => {
    setEditing(false);
    if (newValue !== value) {
      onSave(newValue);
    }
  };

  const handleCancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (!editing) {
    return (
      <span
        className={cn(
          "rounded px-1 inline-block",
          !readOnly && "cursor-pointer hover:bg-muted/50",
          displayClassName,
          className
        )}
        onClick={() => { if (!readOnly) setEditing(true); }}
      >
        {renderDisplay ? (
          renderDisplay(value)
        ) : value ? (
          value
        ) : (
          <span className="text-muted-foreground">{placeholder || "..."}</span>
        )}
      </span>
    );
  }

  if (type === "select") {
    return (
      <Select
        value={draft}
        onValueChange={(newValue) => {
          setDraft(newValue);
          handleSave(newValue);
        }}
        open
        onOpenChange={(open) => {
          if (!open) setEditing(false);
        }}
      >
        <SelectTrigger className={cn("h-6 text-xs min-w-[80px]", className)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              <div className="flex items-center gap-1.5">
                {opt.color && (
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: opt.color }}
                  />
                )}
                <span>{opt.label}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (type === "date") {
    return (
      <Input
        ref={inputRef}
        type="date"
        value={draft}
        onChange={(e) => {
          const newValue = e.target.value;
          setDraft(newValue);
          handleSave(newValue);
        }}
        className={cn("h-6 text-xs w-[130px]", className)}
        autoFocus
      />
    );
  }

  // Text mode
  return (
    <Input
      ref={inputRef}
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          handleSave(draft);
        } else if (e.key === "Escape") {
          handleCancel();
        }
      }}
      onBlur={() => handleSave(draft)}
      placeholder={placeholder}
      className={cn("h-6 text-xs", className)}
      autoFocus
    />
  );
}
