"use client";

import { useState, useEffect, useCallback } from "react";
import { format, differenceInBusinessDays } from "date-fns";
import { Palmtree, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface VacationRequest {
  id: string;
  startDate: string;
  endDate: string;
  type: string;
  status: string;
  note: string | null;
  createdAt: string;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
}

function getStatusBadge(status: string) {
  switch (status) {
    case "approved":
      return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Approved</Badge>;
    case "rejected":
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Rejected</Badge>;
    default:
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pending</Badge>;
  }
}

function getTypeBadge(type: string) {
  switch (type) {
    case "sick":
      return <Badge variant="outline">Sick</Badge>;
    case "personal":
      return <Badge variant="outline">Personal</Badge>;
    default:
      return <Badge variant="outline">Vacation</Badge>;
  }
}

function countBusinessDays(startDate: string, endDate: string): number {
  const days = differenceInBusinessDays(new Date(endDate), new Date(startDate)) + 1;
  return Math.max(days, 1);
}

export default function AdminVacationsPage() {
  const [requests, setRequests] = useState<VacationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [updating, setUpdating] = useState<string | null>(null);

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
  }, [fetchRequests]);

  async function handleAction(id: string, status: "approved" | "rejected") {
    setUpdating(id);
    try {
      const res = await fetch(`/api/vacations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        fetchRequests();
      }
    } catch (error) {
      console.error("Failed to update request:", error);
    } finally {
      setUpdating(null);
    }
  }

  const filteredRequests = statusFilter === "all"
    ? requests
    : requests.filter((r) => r.status === statusFilter);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Vacation Requests</h1>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Requests Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            {statusFilter === "all" ? "All Requests" : `${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Requests`}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({filteredRequests.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Palmtree className="h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-semibold text-slate-900">No Requests</h3>
              <p className="mt-1 text-sm text-slate-500">
                No {statusFilter !== "all" ? statusFilter : ""} vacation requests found.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Employee</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Type</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Period</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Days</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Note</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((req) => (
                    <tr key={req.id} className="border-b hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-900">
                            {req.user.firstName} {req.user.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">{req.user.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">{getTypeBadge(req.type)}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {format(new Date(req.startDate), "MMM d")} —{" "}
                        {format(new Date(req.endDate), "MMM d, yyyy")}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {countBusinessDays(req.startDate, req.endDate)}
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(req.status)}</td>
                      <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">
                        {req.note || "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {req.status === "pending" && (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              onClick={() => handleAction(req.id, "approved")}
                              disabled={updating === req.id}
                            >
                              <Check className="mr-1 h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleAction(req.id, "rejected")}
                              disabled={updating === req.id}
                            >
                              <X className="mr-1 h-4 w-4" />
                              Reject
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
