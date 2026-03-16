"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Users, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface AbsenceReason {
  id: string;
  name: string;
  code: string | null;
  isDefault: boolean;
  active: boolean;
  users?: { id: string; firstName: string | null; lastName: string | null; email: string }[];
}

interface TeamMember {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

export function AbsenceCategorySettings() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");

  const [loading, setLoading] = useState(true);
  const [reasons, setReasons] = useState<AbsenceReason[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Create/edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReason, setEditingReason] = useState<AbsenceReason | null>(null);
  const [reasonName, setReasonName] = useState("");
  const [reasonCode, setReasonCode] = useState("");
  const [saving, setSaving] = useState(false);

  // Assign dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assigningReason, setAssigningReason] = useState<AbsenceReason | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [assignSaving, setAssignSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [reasonRes, teamRes] = await Promise.all([
          fetch("/api/admin/absence-reasons"),
          fetch("/api/team"),
        ]);
        if (reasonRes.ok) {
          const data = await reasonRes.json();
          setReasons(data.reasons || data || []);
        }
        if (teamRes.ok) {
          const data = await teamRes.json();
          setTeamMembers(
            (Array.isArray(data) ? data : data.members || []).map(
              (m: { id: string; firstName: string | null; lastName: string | null; email: string }) => ({
                id: m.id,
                firstName: m.firstName,
                lastName: m.lastName,
                email: m.email,
              })
            )
          );
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  const reloadReasons = async () => {
    const res = await fetch("/api/admin/absence-reasons");
    if (res.ok) {
      const data = await res.json();
      setReasons(data.reasons || data || []);
    }
  };

  const handleSave = async () => {
    if (!reasonName.trim()) return;
    setSaving(true);
    try {
      if (editingReason) {
        const res = await fetch(`/api/admin/absence-reasons/${editingReason.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: reasonName.trim(), code: reasonCode || null }),
        });
        if (res.ok) {
          toast.success(tc("saved"));
          setDialogOpen(false);
          await reloadReasons();
        } else {
          const data = await res.json();
          toast.error(data.error || tc("failedToUpdate"));
        }
      } else {
        const res = await fetch("/api/admin/absence-reasons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: reasonName.trim(), code: reasonCode || null }),
        });
        if (res.ok) {
          toast.success(tc("saved"));
          setDialogOpen(false);
          await reloadReasons();
        } else {
          const data = await res.json();
          toast.error(data.error || tc("failedToSave"));
        }
      }
    } catch {
      toast.error(tc("failedToSave"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (reason: AbsenceReason) => {
    if (!confirm(`Delete "${reason.name}"?`)) return;
    const res = await fetch(`/api/admin/absence-reasons/${reason.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false }),
    });
    if (res.ok) {
      toast.success(tc("saved"));
      await reloadReasons();
    }
  };

  const handleSaveAssignments = async () => {
    if (!assigningReason) return;
    setAssignSaving(true);
    try {
      const res = await fetch(`/api/admin/absence-reasons/${assigningReason.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: selectedUserIds }),
      });
      if (res.ok) {
        toast.success(tc("saved"));
        setAssignDialogOpen(false);
        await reloadReasons();
      }
    } catch {
      toast.error(tc("failedToSave"));
    } finally {
      setAssignSaving(false);
    }
  };

  if (loading) return <Skeleton className="h-40" />;

  return (
    <>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <h3 className="text-base font-semibold text-foreground">{t("absenceReasons")}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t("absenceReasonsDesc")}</p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setEditingReason(null);
                setReasonName("");
                setReasonCode("");
                setDialogOpen(true);
              }}
            >
              <Plus className="mr-1 h-3 w-3" />
              {t("addReason")}
            </Button>
          </div>

          <div className="mt-4 space-y-2">
            {reasons.map((reason) => (
              <div
                key={reason.id}
                className={cn(
                  "flex items-center justify-between rounded-lg border p-3",
                  !reason.active && "opacity-50"
                )}
              >
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{reason.name}</span>
                      {reason.code && (
                        <span className="text-xs text-muted-foreground">({reason.code})</span>
                      )}
                      {reason.isDefault && (
                        <Badge variant="secondary" className="text-xs">{t("defaultBadge")}</Badge>
                      )}
                      {!reason.active && (
                        <Badge variant="outline" className="text-xs">{tc("inactive")}</Badge>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      <Users className="inline-block h-3 w-3 mr-1" />
                      {reason.users?.length || 0} {t("employeesAssigned")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAssigningReason(reason);
                      setSelectedUserIds(reason.users?.map((u) => u.id) || []);
                      setAssignDialogOpen(true);
                    }}
                    title={t("manageEmployees")}
                  >
                    <Users className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingReason(reason);
                      setReasonName(reason.name);
                      setReasonCode(reason.code || "");
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {!reason.isDefault && (
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(reason)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {reasons.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {t("absenceReasonsDesc")}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingReason ? t("editReason") : t("addReason")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("reasonName")}</Label>
              <Input
                value={reasonName}
                onChange={(e) => setReasonName(e.target.value)}
                placeholder="e.g. Sygdom"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("reasonCode")}</Label>
              <Input
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value)}
                placeholder="e.g. SICK"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{tc("cancel")}</Button>
            <Button onClick={handleSave} disabled={saving || !reasonName.trim()}>
              {saving ? tc("saving") : tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Employee Assignment Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("manageEmployees")}: {assigningReason?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">{t("selectEmployeesForReason")}</p>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {teamMembers.map((member) => {
                const isSelected = selectedUserIds.includes(member.id);
                const displayName =
                  member.firstName && member.lastName
                    ? `${member.firstName} ${member.lastName}`
                    : member.email;
                return (
                  <label
                    key={member.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                      isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUserIds([...selectedUserIds, member.id]);
                        } else {
                          setSelectedUserIds(selectedUserIds.filter((id) => id !== member.id));
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <div>
                      <div className="font-medium text-sm">{displayName}</div>
                      {member.firstName && (
                        <div className="text-xs text-muted-foreground">{member.email}</div>
                      )}
                    </div>
                  </label>
                );
              })}
              {teamMembers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">{t("noTeamMembers")}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>{tc("cancel")}</Button>
            <Button onClick={handleSaveAssignments} disabled={assignSaving}>
              {assignSaving ? tc("saving") : tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
