"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  startOfWeek,
  endOfWeek,
  format,
  subWeeks,
  addWeeks,
} from "date-fns";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Receipt,
  ChevronLeft,
  ChevronRight,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCurrency, formatHours, formatPercentage } from "@/lib/calculations";

interface EmployeeStat {
  id: string;
  name: string;
  email: string;
  hours: number;
  billableHours: number;
  revenue: number;
  cost: number;
  profit: number;
  hourlyRate: number;
  costRate: number;
  weeklyTarget: number;
  utilization: number;
}

interface Stats {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  totalHours: number;
  billableHours: number;
  utilization: number;
  employeeStats: EmployeeStat[];
}

export default function AdminPage() {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const weekStart = useMemo(() => startOfWeek(currentWeek, { weekStartsOn: 1 }), [currentWeek]);
  const weekEnd = useMemo(() => endOfWeek(currentWeek, { weekStartsOn: 1 }), [currentWeek]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const start = format(weekStart, "yyyy-MM-dd");
      const end = format(weekEnd, "yyyy-MM-dd");
      const res = await fetch(`/api/admin/stats?startDate=${start}&endDate=${end}`);
      if (res.ok) {
        setStats(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  }, [weekStart, weekEnd]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <BarChart3 className="h-12 w-12 text-slate-300" />
        <h3 className="mt-4 text-lg font-semibold text-slate-900">No Data</h3>
        <p className="mt-1 text-sm text-slate-500">Could not load admin statistics.</p>
      </div>
    );
  }

  const monthlyProjection = {
    revenue: stats.totalRevenue * 4,
    cost: stats.totalCost * 4,
    profit: stats.totalProfit * 4,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setCurrentWeek(new Date())}>
            This Week
          </Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-sm text-slate-600">
            {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
          </span>
        </div>
      </div>

      {/* Company Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Revenue</p>
                <p className="text-xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
                <Receipt className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cost</p>
                <p className="text-xl font-bold">{formatCurrency(stats.totalCost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                stats.totalProfit >= 0 ? "bg-emerald-50" : "bg-red-50"
              )}>
                {stats.totalProfit >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-600" />
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Profit</p>
                <p className="text-xl font-bold">{formatCurrency(stats.totalProfit)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Utilization</p>
                <p className="text-xl font-bold">{formatPercentage(stats.utilization)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Team Hours</p>
                <p className="text-xl font-bold">{formatHours(stats.totalHours)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Projection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Monthly Projection (4x weekly)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground">Revenue</p>
              <p className="text-lg font-bold text-emerald-600">{formatCurrency(monthlyProjection.revenue)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cost</p>
              <p className="text-lg font-bold text-red-600">{formatCurrency(monthlyProjection.cost)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Profit</p>
              <p className={cn("text-lg font-bold", monthlyProjection.profit >= 0 ? "text-emerald-600" : "text-red-600")}>
                {formatCurrency(monthlyProjection.profit)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employee Profitability */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Employee Profitability</h2>
        {stats.employeeStats.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-semibold text-slate-900">No Team Members</h3>
              <p className="mt-1 text-sm text-slate-500">Add team members to see profitability data.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stats.employeeStats.map((emp) => (
              <Card key={emp.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{emp.name}</CardTitle>
                    <Badge variant={emp.profit >= 0 ? "default" : "destructive"}>
                      {emp.profit >= 0 ? "Profitable" : "Loss"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{emp.email}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Hours Progress */}
                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-muted-foreground">Hours</span>
                      <span className="font-medium">
                        {formatHours(emp.hours)} / {formatHours(emp.weeklyTarget)}
                      </span>
                    </div>
                    <Progress
                      value={Math.min(emp.utilization, 100)}
                      className="h-2"
                    />
                  </div>

                  {/* Rates */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Bill Rate</p>
                      <p className="font-medium">{formatCurrency(emp.hourlyRate)}/h</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Cost Rate</p>
                      <p className="font-medium">{formatCurrency(emp.costRate)}/h</p>
                    </div>
                  </div>

                  {/* Weekly P&L */}
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Revenue</span>
                        <span className="text-emerald-600">{formatCurrency(emp.revenue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cost</span>
                        <span className="text-red-600">-{formatCurrency(emp.cost)}</span>
                      </div>
                      <div className="border-t pt-1 flex justify-between font-semibold">
                        <span>Profit</span>
                        <span className={emp.profit >= 0 ? "text-emerald-600" : "text-red-600"}>
                          {formatCurrency(emp.profit)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
