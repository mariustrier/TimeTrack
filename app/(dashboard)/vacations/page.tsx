"use client";

import { useState, useEffect, useCallback } from "react";
import { format, differenceInBusinessDays } from "date-fns";
import { Palmtree, Plus, X } from "lucide-react";
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
  const [totalAllowance, setTotalAllowance] = useState(25);

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
    // Fetch user's vacation allowance
    fetch("/api/time-entries?startDate=2000-01-01&endDate=2000-01-02")
      .then(() => {
        // We'll use the default 25 days; in a real setup this would come from user profile
      })
      .catch(() => {});
  }, [fetchRequests]);

  const approvedDays = requests
    .filter((r) => r.status === "approved")
    .reduce((sum, r) => sum + countBusinessDays(r.startDate, r.endDate), 0);

  const remainingDays = totalAllowance - approvedDays;

  async function handleSubmit() {
    if (!startDate || !endDate) return;
    setSaving(true);
    try {
      const res = await fetch("/api/vacations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, type, note }),
      });
      if (res.ok) {
        setModalOpen(false);
        setStartDate("");
        setEndDate("");
        setType("vacation");
        setNote("");
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
          <TabsTrigger value="calendar">{t("teamCalendar")}</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-6 mt-4">

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("totalAllowance")}</p>
            <p className="mt-1 text-2xl font-bold">{totalAllowance} {t("days")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("usedApproved")}</p>
            <p className="mt-1 text-2xl font-bold">{approvedDays} {t("days")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("remainingDays")}</p>
            <p className="mt-1 text-2xl font-bold">{remainingDays} {t("days")}</p>
          </CardContent>
        </Card>
      </div>

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
                        {countBusinessDays(req.startDate, req.endDate)} {t("dayCount")}
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
                  {req.status === "pending" && (
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
              <p className="text-sm text-muted-foreground">
                {countBusinessDays(startDate, endDate)} {t("businessDays")}
              </p>
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
              disabled={saving || !startDate || !endDate}
            >
              {saving ? tc("saving") : t("submitRequest")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
