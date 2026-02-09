"use client";

import { useState, useEffect } from "react";
import { Users, Plus, Pencil, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { convertAndFormat, SUPPORTED_CURRENCIES } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslations } from "@/lib/i18n";
import { InfoTooltip } from "@/components/ui/info-tooltip";

interface TeamMember {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  employmentType: string;
  hourlyRate: number;
  costRate: number;
  weeklyTarget: number;
  vacationDays: number;
}

export function TeamList() {
  const t = useTranslations("team");
  const tc = useTranslations("common");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [deletingMember, setDeletingMember] = useState<TeamMember | null>(null);
  const [saving, setSaving] = useState(false);
  const [masterCurrency, setMasterCurrency] = useState("USD");
  const [displayCurrency, setDisplayCurrency] = useState("USD");

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState("employee");
  const [employmentType, setEmploymentType] = useState("employee");
  const [hourlyRate, setHourlyRate] = useState("");
  const [costRate, setCostRate] = useState("");
  const [weeklyTarget, setWeeklyTarget] = useState("37");
  const [vacationDays, setVacationDays] = useState("0");

  async function fetchTeam() {
    setLoading(true);
    try {
      const res = await fetch("/api/team");
      if (res.ok) setMembers(await res.json());
    } catch (error) {
      console.error("Failed to fetch team:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTeam();
    fetch("/api/admin/economic")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.currency) {
          setMasterCurrency(data.currency || "USD");
          setDisplayCurrency(data.currency || "USD");
        }
      })
      .catch(() => {});
  }, []);

  function openInviteModal() {
    setEditingMember(null);
    setEmail("");
    setFirstName("");
    setLastName("");
    setRole("employee");
    setEmploymentType("employee");
    setHourlyRate("");
    setCostRate("");
    setWeeklyTarget("37");
    setVacationDays("0");
    setModalOpen(true);
  }

  function openEditModal(member: TeamMember) {
    setEditingMember(member);
    setEmail(member.email);
    setFirstName(member.firstName || "");
    setLastName(member.lastName || "");
    setRole(member.role);
    setEmploymentType(member.employmentType || "employee");
    setHourlyRate(member.hourlyRate.toString());
    setCostRate(member.costRate.toString());
    setWeeklyTarget(member.weeklyTarget.toString());
    setVacationDays(member.vacationDays.toString());
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body = {
        email,
        firstName,
        lastName,
        role,
        employmentType,
        hourlyRate,
        costRate,
        weeklyTarget,
        vacationDays,
      };

      if (editingMember) {
        const res = await fetch(`/api/team/${editingMember.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json();
          toast.error(data.error || "Failed to update member");
          return;
        }
      } else {
        const res = await fetch("/api/team", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json();
          toast.error(data.error || "Failed to invite member");
          return;
        }
        const data = await res.json();
        if (data.emailSent) {
          toast.success(t("invitationSent", { email }));
        } else {
          toast.warning(t("invitationFailed"));
        }
      }
      setModalOpen(false);
      fetchTeam();
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingMember) return;
    setSaving(true);
    try {
      await fetch(`/api/team/${deletingMember.id}`, { method: "DELETE" });
      setDeleteModalOpen(false);
      setDeletingMember(null);
      fetchTeam();
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-10 w-36" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select value={displayCurrency} onValueChange={setDisplayCurrency}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openInviteModal} data-tour="team-invite-btn">
            <UserPlus className="mr-2 h-4 w-4" />
            {t("inviteMember")}
          </Button>
        </div>
      </div>

      <Card data-tour="team-table">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t("teamMembers", { count: members.length.toString() })}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Users className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">{t("noMembersTitle")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("noMembersDescription")}</p>
              <Button className="mt-4" onClick={openInviteModal}>
                <Plus className="mr-2 h-4 w-4" />
                {t("inviteMember")}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tc("name")}</TableHead>
                  <TableHead>{tc("email")}</TableHead>
                  <TableHead>{t("role")}</TableHead>
                  <TableHead><span className="flex items-center gap-1">{t("billRate")} <InfoTooltip textKey="billRate" size={13} /></span></TableHead>
                  <TableHead><span className="flex items-center gap-1">{t("costRate")} <InfoTooltip textKey="costRate" size={13} /></span></TableHead>
                  <TableHead>{t("weeklyTarget")}</TableHead>
                  <TableHead className="w-20">{tc("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.firstName || member.lastName
                        ? `${member.firstName || ""} ${member.lastName || ""}`.trim()
                        : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.email}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1.5">
                        <Badge variant={member.role === "admin" ? "default" : member.role === "manager" ? "outline" : "secondary"}>
                          {member.role === "admin" ? t("adminRole") : member.role === "manager" ? t("managerRole") : t("employee")}
                        </Badge>
                        {member.employmentType === "freelancer" && (
                          <Badge variant="outline" className="border-amber-500 text-amber-600">
                            {t("freelancer")}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{convertAndFormat(member.hourlyRate, masterCurrency, displayCurrency)}/h</TableCell>
                    <TableCell>{convertAndFormat(member.costRate, masterCurrency, displayCurrency)}/h</TableCell>
                    <TableCell>{member.weeklyTarget}h</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal(member)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDeletingMember(member);
                            setDeleteModalOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invite/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingMember ? t("editMember") : t("inviteMemberTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("firstName")}</Label>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("lastName")}</Label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{tc("email")}</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@company.com"
                disabled={!!editingMember}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("role")}</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">{t("employee")}</SelectItem>
                    <SelectItem value="manager">{t("managerRole")}</SelectItem>
                    <SelectItem value="admin">{t("adminRole")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">{t("employmentType")} <InfoTooltip textKey="employmentType" size={13} /></Label>
                <Select value={employmentType} onValueChange={setEmploymentType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">{t("employeeType")}</SelectItem>
                    <SelectItem value="freelancer">{t("freelancerType")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("billRateLabel", { currency: masterCurrency })}</Label>
                <Input
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("costRateLabel", { currency: masterCurrency })}</Label>
                <Input
                  type="number"
                  value={costRate}
                  onChange={(e) => setCostRate(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("weeklyTargetLabel")}</Label>
                <Input
                  type="number"
                  value={weeklyTarget}
                  onChange={(e) => setWeeklyTarget(e.target.value)}
                  placeholder="40"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("vacationDays")}</Label>
                <Input
                  type="number"
                  value={vacationDays}
                  onChange={(e) => setVacationDays(e.target.value)}
                  placeholder="25"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving || (!editingMember && !email.trim())}>
              {saving ? tc("saving") : editingMember ? tc("update") : t("invite")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("removeMember")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("removeMemberConfirm", { name: deletingMember?.firstName || deletingMember?.email || "" })}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? tc("removing") : tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
