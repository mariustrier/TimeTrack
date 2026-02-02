"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  RefreshCw,
  X,
  Lightbulb,
  BarChart3,
  Target,
  Hand,
  PartyPopper,
  Info,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
interface Insight {
  id: string;
  category: "OPPORTUNITY" | "INSIGHT" | "SUGGESTION" | "HEADS_UP" | "CELEBRATION";
  title: string;
  description: string;
  suggestion?: string;
  relatedHours?: number;
  relatedAmount?: number;
  createdAt: string;
}

type Category = Insight["category"];

const categoryConfig = {
  OPPORTUNITY: {
    icon: Lightbulb,
    color: "text-green-600",
    bg: "bg-green-50 dark:bg-green-950",
    border: "border-l-green-500",
    badge: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  },
  INSIGHT: {
    icon: BarChart3,
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950",
    border: "border-l-blue-500",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  },
  SUGGESTION: {
    icon: Target,
    color: "text-purple-600",
    bg: "bg-purple-50 dark:bg-purple-950",
    border: "border-l-purple-500",
    badge: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  },
  HEADS_UP: {
    icon: Hand,
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-950",
    border: "border-l-amber-500",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  },
  CELEBRATION: {
    icon: PartyPopper,
    color: "text-green-600",
    bg: "bg-green-50 dark:bg-green-950",
    border: "border-l-green-500",
    badge: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  },
};

const ALL_CATEGORIES: Category[] = [
  "OPPORTUNITY",
  "INSIGHT",
  "SUGGESTION",
  "HEADS_UP",
  "CELEBRATION",
];

export default function AIAssistantPage() {
  const t = useTranslations("ai");

  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<Category | "ALL">("ALL");

  const fetchInsights = useCallback(async () => {
    try {
      const res = await fetch("/api/insights");
      if (res.ok) {
        setInsights(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch insights:", error);
    }
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await fetchInsights();
      setLoading(false);
    }
    init();
  }, [fetchInsights]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await fetch("/api/insights/refresh", { method: "POST" });
      await fetchInsights();
    } catch (error) {
      console.error("Failed to refresh insights:", error);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleDismiss(id: string) {
    try {
      const res = await fetch(`/api/insights/${id}/dismiss`, { method: "POST" });
      if (res.ok) {
        setInsights((prev) => prev.filter((i) => i.id !== id));
      }
    } catch (error) {
      console.error("Failed to dismiss insight:", error);
    }
  }

  async function handleDismissAll() {
    try {
      const res = await fetch("/api/insights/dismiss-all", { method: "POST" });
      if (res.ok) {
        setInsights([]);
      }
    } catch (error) {
      console.error("Failed to dismiss all insights:", error);
    }
  }

  const filteredInsights =
    activeFilter === "ALL"
      ? insights
      : insights.filter((i) => i.category === activeFilter);

  function getCategoryLabel(category: Category): string {
    switch (category) {
      case "OPPORTUNITY":
        return t("opportunity");
      case "INSIGHT":
        return t("insight");
      case "SUGGESTION":
        return t("suggestion");
      case "HEADS_UP":
        return t("headsUp");
      case "CELEBRATION":
        return t("celebration");
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 w-24 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {insights.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleDismissAll}>
              {t("dismissAll")}
            </Button>
          )}
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            size="sm"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            {refreshing ? t("refreshing") : t("refresh")}
          </Button>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeFilter === "ALL" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveFilter("ALL")}
        >
          All
        </Button>
        {ALL_CATEGORIES.map((cat) => {
          const config = categoryConfig[cat];
          const Icon = config.icon;
          return (
            <Button
              key={cat}
              variant={activeFilter === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveFilter(cat)}
            >
              <Icon className="mr-1.5 h-3.5 w-3.5" />
              {getCategoryLabel(cat)}
            </Button>
          );
        })}
      </div>

      {/* Insights List */}
      {filteredInsights.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Sparkles className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold text-foreground">
            {t("noInsights")}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("noInsightsDescription")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredInsights.map((insight) => {
            const config = categoryConfig[insight.category];
            const Icon = config.icon;

            return (
              <Card
                key={insight.id}
                className={`border-l-4 ${config.border}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      {/* Category badge and icon */}
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${config.color}`} />
                        <Badge
                          className={`${config.badge} border-0 hover:${config.badge.split(" ")[0]}`}
                        >
                          {getCategoryLabel(insight.category)}
                        </Badge>
                      </div>

                      {/* Title and description */}
                      <div>
                        <h3 className="font-semibold text-foreground">
                          {insight.title}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {insight.description}
                        </p>
                      </div>

                      {/* Suggestion box */}
                      {insight.suggestion && (
                        <div className={`rounded-md p-3 ${config.bg}`}>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {t("suggestionLabel")}
                          </p>
                          <p className="mt-1 text-sm text-foreground">
                            {insight.suggestion}
                          </p>
                        </div>
                      )}

                      {/* Related hours/amount */}
                      {(insight.relatedHours != null ||
                        insight.relatedAmount != null) && (
                        <div className="flex flex-wrap gap-3">
                          {insight.relatedHours != null && (
                            <span className="text-sm text-muted-foreground">
                              {insight.relatedHours}h
                            </span>
                          )}
                          {insight.relatedAmount != null && (
                            <span className="text-sm text-muted-foreground">
                              ${insight.relatedAmount.toLocaleString()}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Dismiss button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => handleDismiss(insight.id)}
                      title={t("dismiss")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* How I Work Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Info className="h-4 w-4 text-muted-foreground" />
            {t("howItWorks")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t("howItWorksDescription")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
