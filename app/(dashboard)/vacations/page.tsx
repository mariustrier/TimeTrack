"use client";

import { useState, useEffect, useCallback } from "react";
import { format, differenceInBusinessDays } from "date-fns";
import { Palmtree, Plus, X, Info } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslations, useDateLocale } from "@/lib/i18n";
import { PageGuide } from "@/components/ui/page-guide";
import { VacationCalendar } from "@/components/vacations/VacationCalendar";
import { VacationPlanner } from "@/components/vacations/VacationPlanner";

const MONTHLY_ACCRUAL = 2.08;

interface VacationRequest {
  id: string;
  startDate: string;
  endDate: string;
  type: string;
  status: string;
  note: string | null;
  createdAt: string;
}

function countBusinessDays(startDate: string, endDate: string): number {
  const days = differenceInBusinessDays(new Date(endDate), new Date(startDate)) + 1;
  return Math.max(days, 1);
}

export default function VacationsPage() {
  const t = useTranslations("vacations");
  const tc = useTranslations("common");
  const dateLocale = useDateLocale();
  const formatOpts = dateLocale ? { locale: dateLocale } : undefined;

  function getStatusBadge(status: string) {
    switch (status) {
      case "approved":
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-900">{tc("approved")}</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-900">{tc("rejected")}</Badge>;
      case "cancelled":
        return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-800">{tc("cancelled")}</Badge>;
      default:
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900 dark:text-amber-300 dark:hover:bg-amber-900">{tc("pending")}</Badge>;
    }
  }

  function getTypeBadge(type: string) {
    switch (type) {
      case "sick":
        return <Badge variant="outline">{t("sick")}</Badge>;
      case "personal":
        return <Badge variant="outline">{t("personal")}</Badge>;
      default:
        return <Badge variant="outline">{t("vacationType")}</Badge>;
    }
  }

  const [requests, setRequests] = useState<VacationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [type, setType] = useState("vacation");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [bonusDays, setBonusDays] = useState(0);
  const [isHourly, setIsHourly] = useState(false);
  const [vacationTrackingUnit, setVacationTrackingUnit] = useState("days");
  const [vacationHoursPerYear, setVacationHoursPerYear] = useState<number | null>(null);
  const [userWeeklyTarget, setUserWeeklyTarget] = useState(37);
  const [userRole, setUserRole] = useState("");
  const [teamMembers, setTeamMembers] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const isAdmin = userRole === "admin" || userRole === "manager";

  const currentMonth = new Date().getMonth() + 1; // 1-indexed
  const isVacationHours = vacationTrackingUnit === "hours";
  const totalAllowance = isHourly ? 0 : Math.round((MONTHLY_ACCRUAL * currentMonth + bonusDays) * 100) / 100;
  const totalHoursAllowance = isVacationHours
    ? Math.round(((vacationHoursPerYear ?? 0) / 12 * currentMonth + bonusDays) * 100) / 100
    : 0;

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/vacations");
      if (res.ok) {
        setRequests(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch vacations:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
    fetch("/api/user/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.vacationDays != null) setBonusDays(data.vacationDays);
        if (data.isHourly != null) setIsHourly(data.isHourly);
        if (data.vacationTrackingUnit) setVacationTrackingUnit(data.vacationTrackingUnit);
        if (data.vacationHoursPerYear != null) setVacationHoursPerYear(data.vacationHoursPerYear);
        if (data.weeklyTarget != null) setUserWeeklyTarget(data.weeklyTarget);
        if (data.role) setUserRole(data.role);
        // Fetch team list for admin/manager on-behalf feature
        if (data.role === "admin" || data.role === "manager") {
          fetch("/api/team")
            .then((res) => res.json())
            .then((members) => setTeamMembers(members))
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [fetchRequests]);

  const approvedDays = requests
    .filter((r) => r.status === "approved")
    .reduce((sum, r) => sum + countBusinessDays(r.startDate, r.endDate), 0);

  const remainingDays = Math.round((totalAllowance - approvedDays) * 100) / 100;
  const dailyTarget = userWeeklyTarget / 5;
  const approvedHours = isVacationHours ? Math.round(approvedDays * dailyTarget * 100) / 100 : 0;
  const remainingHours = isVacationHours ? Math.round((totalHoursAllowance - approvedHours) * 100) / 100 : 0;

  async function handleSubmit() {
    if (!startDate || !endDate) return;
    if (isAdmin && !selectedUserId) return;
    setSaving(true);
    try {
      const payload: Record<string, string> = { startDate, endDate, type, note };
      if (isAdmin && selectedUserId) {
        payload.userId = selectedUserId;
      }
      const res = await fetch("/api/vacations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setModalOpen(false);
        setStartDate("");
        setEndDate("");
        setType("vacation");
        setNote("");
        setSelectedUserId("");
        fetchRequests();
      }
    } catch (error) {
      console.error("Failed to submit request:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(id: string) {
    try {
      const res = await fetch(`/api/vacations/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchRequests();
      }
    } catch (error) {
      console.error("Failed to cancel request:", error);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageGuide pageId="vacations" titleKey="vacationsTitle" descKey="vacationsDesc" tips={["vacationsTip1", "vacationsTip2", "vacationsTip3"]} />
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("requestVacation")}
        </Button>
      </div>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">{t("myRequests")}</TabsTrigger>
          <TabsTrigger value="planner">{t("planner")}</TabsTrigger>
          <TabsTrigger value="calendar">{t("teamCalendar")}</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-6 mt-4">

      {/* Summary Cards */}
      {isHourly ? (
        <div className="rounded-lg border border-dashed border-muted-foreground/30 p-6 text-center">
          <p className="text-sm text-muted-foreground">{t("hourlyNoAccrual")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{t("totalAllowance")}</p>
              {isVacationHours ? (
                <>
                  <p className="mt-1 text-2xl font-bold">{totalHoursAllowance.toFixed(1)} {t("hoursUnit")}</p>
                  <p className="text-xs text-muted-foreground">
                    {((vacationHoursPerYear ?? 0) / 12).toFixed(1)} &times; {currentMonth} {t("months")}{bonusDays > 0 ? ` + ${bonusDays}` : ""}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1 text-2xl font-bold">{totalAllowance.toFixed(1)} {t("days")}</p>
                  <p className="text-xs text-muted-foreground">
                    {MONTHLY_ACCRUAL} &times; {currentMonth} {t("months")}{bonusDays > 0 ? ` + ${bonusDays}` : ""}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{t("usedApproved")}</p>
              <p className="mt-1 text-2xl font-bold">
                {isVacationHours ? `${approvedHours} ${t("hoursUnit")}` : `${approvedDays} ${t("days")}`}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{t("remainingDays")}</p>
              <p className="mt-1 text-2xl font-bold">
                {isVacationHours ? `${remainingHours.toFixed(1)} ${t("hoursUnit")}` : `${remainingDays.toFixed(1)} ${t("days")}`}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Requests List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t("myRequests")}</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Palmtree className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">{t("noRequestsTitle")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("noRequestsDescription")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {getTypeBadge(req.type)}
                      {getStatusBadge(req.status)}
                      <span className="text-sm text-muted-foreground">
                        {isVacationHours
                          ? `${(countBusinessDays(req.startDate, req.endDate) * dailyTarget).toFixed(1)}${tc("hourAbbrev")}`
                          : `${countBusinessDays(req.startDate, req.endDate)} ${t("dayCount")}`}
                      </span>
                    </div>
                    <p className="text-sm font-medium">
                      {format(new Date(req.startDate), "MMM d, yyyy", formatOpts)} —{" "}
                      {format(new Date(req.endDate), "MMM d, yyyy", formatOpts)}
                    </p>
                    {req.note && (
                      <p className="text-sm text-muted-foreground">{req.note}</p>
                    )}
                  </div>
                  {(req.status === "pending" || req.status === "approved") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCancel(req.id)}
                      title={t("cancelRequest")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

        </TabsContent>

        <TabsContent value="planner" className="mt-4">
          <VacationPlanner
            requests={requests}
            bonusDays={bonusDays}
            isHourly={isHourly}
            vacationTrackingUnit={vacationTrackingUnit}
            vacationHoursPerYear={vacationHoursPerYear}
            weeklyTarget={userWeeklyTarget}
          />
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <VacationCalendar />
        </TabsContent>
      </Tabs>

      {/* Request Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("requestVacation")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {isAdmin && (
              <div className="space-y-2">
                <Label>{t("selectEmployee")}</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectEmployee")} />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.firstName} {m.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedUserId && (
                  <p className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                    <Info className="h-3 w-3" />
                    {t("autoApproved")}
                  </p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>{tc("type")}</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacation">{t("vacationType")}</SelectItem>
                  <SelectItem value="sick">{t("sickLeave")}</SelectItem>
                  <SelectItem value="personal">{t("personal")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{tc("startDate")}</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{tc("endDate")}</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            {startDate && endDate && new Date(endDate) >= new Date(startDate) && (
              <div className="text-sm text-muted-foreground">
                <p>{countBusinessDays(startDate, endDate)} {t("businessDays")}</p>
                {isVacationHours && (
                  <p className="mt-1 text-xs">
                    {t("hoursCost", {
                      hours: (countBusinessDays(startDate, endDate) * dailyTarget).toFixed(1),
                      days: countBusinessDays(startDate, endDate).toString(),
                      perDay: dailyTarget.toFixed(1),
                    })}
                  </p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>{t("noteOptional")}</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("notePlaceholder")}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || !startDate || !endDate || (isAdmin && !selectedUserId)}
            >
              {saving ? tc("saving") : t("submitRequest")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
