"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { GripVertical, Plus, Pencil, Trash2, Check, X, Users } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Role {
  id: string;
  name: string;
  sortOrder: number;
  defaultRate: number | null;
  color: string | null;
  isDefault: boolean;
  _count: { users: number };
}

// ─── Sortable Role Row ───

function SortableRoleRow({
  role,
  editingId,
  editName,
  editRate,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onSetEditName,
  onSetEditRate,
  onDelete,
  deleting,
}: {
  role: Role;
  editingId: string | null;
  editName: string;
  editRate: string;
  onStartEdit: (role: Role) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onSetEditName: (v: string) => void;
  onSetEditRate: (v: string) => void;
  onDelete: (role: Role) => void;
  deleting: string | null;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: role.id });

  const isEditing = editingId === role.id;
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && nameRef.current) {
      nameRef.current.focus();
      nameRef.current.select();
    }
  }, [isEditing]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.9 : 1,
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onSaveEdit();
    if (e.key === "Escape") onCancelEdit();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-shadow ${
        isDragging ? "shadow-lg border-brand-500/50" : "border-border"
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent active:cursor-grabbing"
        tabIndex={-1}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Name */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            ref={nameRef}
            value={editName}
            onChange={(e) => onSetEditName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
        ) : (
          <span className="text-sm font-medium text-foreground truncate block">
            {role.name}
          </span>
        )}
      </div>

      {/* Rate */}
      <div className="w-36 shrink-0">
        {isEditing ? (
          <div className="flex items-center gap-1">
            <input
              value={editRate}
              onChange={(e) => onSetEditRate(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="—"
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-right text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">kr./t</span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground text-right block">
            {role.defaultRate != null
              ? `${Number(role.defaultRate).toLocaleString("da-DK")} kr./t`
              : "—"}
          </span>
        )}
      </div>

      {/* Member count */}
      <div className="w-20 shrink-0 text-right">
        {role._count.users > 0 ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            {role._count.users}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 w-20 justify-end">
        {isEditing ? (
          <>
            <button
              onClick={onSaveEdit}
              className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
              title="Gem"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={onCancelEdit}
              className="rounded p-1.5 text-muted-foreground hover:bg-accent transition-colors"
              title="Annullér"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onStartEdit(role)}
              className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Redigér"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDelete(role)}
              disabled={deleting === role.id}
              className="rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
              title="Slet"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───

export function AdminCategories() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRate, setEditRate] = useState("");

  // Add state
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRate, setNewRate] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleting, setDeleting] = useState<string | null>(null);

  const newNameRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ─── Fetch ───

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch("/api/roles");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRoles(data);
    } catch {
      toast.error("Kunne ikke hente kategorier");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  // ─── Reorder ───

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = roles.findIndex((r) => r.id === active.id);
    const newIndex = roles.findIndex((r) => r.id === over.id);
    const reordered = arrayMove(roles, oldIndex, newIndex);
    setRoles(reordered);

    try {
      const res = await fetch("/api/roles/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: reordered.map((r) => r.id) }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRoles(data);
    } catch {
      toast.error("Kunne ikke ændre rækkefølge");
      fetchRoles();
    }
  };

  // ─── Inline Edit ───

  const startEdit = (role: Role) => {
    setEditingId(role.id);
    setEditName(role.name);
    setEditRate(role.defaultRate != null ? String(role.defaultRate) : "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditRate("");
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;

    const rate = editRate.trim() ? parseFloat(editRate.replace(",", ".")) : null;
    if (editRate.trim() && (isNaN(rate!) || rate! < 0)) {
      toast.error("Ugyldig timepris");
      return;
    }

    try {
      const res = await fetch(`/api/roles/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          defaultRate: rate,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Fejl");
      }
      const updated = await res.json();
      setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      cancelEdit();
      toast.success("Kategori opdateret");
    } catch (err: any) {
      toast.error(err.message || "Kunne ikke opdatere");
    }
  };

  // ─── Add ───

  const startAdd = () => {
    setAdding(true);
    setNewName("");
    setNewRate("");
    setTimeout(() => newNameRef.current?.focus(), 50);
  };

  const cancelAdd = () => {
    setAdding(false);
    setNewName("");
    setNewRate("");
  };

  const saveAdd = async () => {
    if (!newName.trim()) return;

    const rate = newRate.trim() ? parseFloat(newRate.replace(",", ".")) : null;
    if (newRate.trim() && (isNaN(rate!) || rate! < 0)) {
      toast.error("Ugyldig timepris");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          defaultRate: rate,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Fejl");
      }
      const created = await res.json();
      setRoles((prev) => [...prev, created]);
      cancelAdd();
      toast.success("Kategori oprettet");
    } catch (err: any) {
      toast.error(err.message || "Kunne ikke oprette");
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete ───

  const handleDelete = async (role: Role) => {
    if (role._count.users > 0) {
      toast.error(
        `Kan ikke slette — ${role._count.users} medarbejder${role._count.users === 1 ? "" : "e"} er tilknyttet. Flyt dem til en anden kategori først.`
      );
      return;
    }

    setDeleting(role.id);
    try {
      const res = await fetch(`/api/roles/${role.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Fejl");
      }
      setRoles((prev) => prev.filter((r) => r.id !== role.id));
      toast.success("Kategori slettet");
    } catch (err: any) {
      toast.error(err.message || "Kunne ikke slette");
    } finally {
      setDeleting(null);
    }
  };

  // ─── Render ───

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <div className="h-8 w-64 rounded-md bg-muted animate-pulse" />
        <div className="h-4 w-96 rounded-md bg-muted animate-pulse" />
        <div className="space-y-2 mt-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">Roller</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Opret og tilpas roller for jeres team. Træk for at ændre rækkefølgen.
        </p>
      </div>

      {/* Table header */}
      <div className="flex items-center gap-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <div className="w-6" /> {/* grip spacer */}
        <div className="flex-1">Navn</div>
        <div className="w-36 shrink-0 text-right">Standard-timepris</div>
        <div className="w-20 shrink-0 text-right">Brugere</div>
        <div className="w-20 shrink-0" /> {/* actions spacer */}
      </div>

      {/* Role list */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={roles.map((r) => r.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1.5">
            {roles.map((role) => (
              <SortableRoleRow
                key={role.id}
                role={role}
                editingId={editingId}
                editName={editName}
                editRate={editRate}
                onStartEdit={startEdit}
                onSaveEdit={saveEdit}
                onCancelEdit={cancelEdit}
                onSetEditName={setEditName}
                onSetEditRate={setEditRate}
                onDelete={handleDelete}
                deleting={deleting}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add new category row */}
      {adding ? (
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-brand-500/50 bg-brand-500/5 px-4 py-3">
          <div className="w-6" />
          <div className="flex-1 min-w-0">
            <input
              ref={newNameRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveAdd();
                if (e.key === "Escape") cancelAdd();
              }}
              placeholder="Kategorinavn"
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            />
          </div>
          <div className="w-36 shrink-0">
            <div className="flex items-center gap-1">
              <input
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveAdd();
                  if (e.key === "Escape") cancelAdd();
                }}
                placeholder="—"
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-right text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">kr./t</span>
            </div>
          </div>
          <div className="w-20 shrink-0" />
          <div className="flex items-center gap-1 shrink-0 w-20 justify-end">
            <button
              onClick={saveAdd}
              disabled={saving || !newName.trim()}
              className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors disabled:opacity-50"
              title="Gem"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={cancelAdd}
              className="rounded p-1.5 text-muted-foreground hover:bg-accent transition-colors"
              title="Annullér"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={startAdd}
          className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-brand-500/50 hover:bg-brand-500/5 transition-colors w-full"
        >
          <Plus className="h-4 w-4" />
          Tilføj kategori
        </button>
      )}

      {/* Footer hint */}
      {roles.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Kategorier bruges til at gruppere medarbejdere og kan tildeles standard-timepriser. Rækkefølgen afspejler anciennitet (1 = højest).
        </p>
      )}
    </div>
  );
}
