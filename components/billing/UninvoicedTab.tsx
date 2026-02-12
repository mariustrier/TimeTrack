"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Clock, DollarSign, Users, Receipt } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { InvoiceCreateDialog } from "./InvoiceCreateDialog";

interface UninvoicedProject {
  projectId: string;
  projectName: string;
  client: string;
  color: string;
  uninvoicedHours: number;
  uninvoicedAmount: number;
  uninvoicedExpenses: number;
  oldestEntry: string | null;
  employeeCount: number;
  entryCount: number;
  expenseCount: number;
}

export function UninvoicedTab() {
  const t = useTranslations("billing");
  const [projects, setProjects] = useState<UninvoicedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [createProjectId, setCreateProjectId] = useState<string | null>(null);
  const [createProjectName, setCreateProjectName] = useState("");
  const [createClient, setCreateClient] = useState("");

  const fetchUninvoiced = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/invoices/uninvoiced");
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error("Failed to fetch uninvoiced:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUninvoiced();
  }, [fetchUninvoiced]);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48" />)}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileText className="h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-semibold text-foreground">{t("noUninvoiced")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t("noUninvoicedDesc")}</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <Card key={p.projectId} className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
                  <h3 className="font-semibold text-foreground">{p.projectName}</h3>
                </div>
              </div>
              {p.client && (
                <p className="mt-1 text-sm text-muted-foreground">{p.client}</p>
              )}

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-lg font-bold text-foreground">{p.uninvoicedHours}h</p>
                    <p className="text-[10px] text-muted-foreground">{t("hours")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-lg font-bold text-foreground">{p.uninvoicedAmount.toLocaleString("da-DK")}</p>
                    <p className="text-[10px] text-muted-foreground">{t("amount")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.employeeCount}</p>
                    <p className="text-[10px] text-muted-foreground">{t("employees")}</p>
                  </div>
                </div>
                {p.uninvoicedExpenses > 0 && (
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{p.uninvoicedExpenses.toLocaleString("da-DK")}</p>
                      <p className="text-[10px] text-muted-foreground">{t("expensesLabel")}</p>
                    </div>
                  </div>
                )}
              </div>

              <Button
                className="mt-4 w-full"
                onClick={() => {
                  setCreateProjectId(p.projectId);
                  setCreateProjectName(p.projectName);
                  setCreateClient(p.client);
                }}
              >
                <FileText className="mr-2 h-4 w-4" />
                {t("createInvoice")}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {createProjectId && (
        <InvoiceCreateDialog
          projectId={createProjectId}
          projectName={createProjectName}
          clientName={createClient}
          open={!!createProjectId}
          onOpenChange={(open) => {
            if (!open) {
              setCreateProjectId(null);
              fetchUninvoiced();
            }
          }}
        />
      )}
    </>
  );
}
