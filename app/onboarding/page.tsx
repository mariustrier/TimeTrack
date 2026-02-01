"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { LocaleProvider, useTranslations } from "@/lib/i18n";
import { LocaleToggle } from "@/components/ui/locale-toggle";

function OnboardingForm() {
  const router = useRouter();
  const t = useTranslations("onboarding");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: companyName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong");
      }

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="absolute top-4 right-4">
        <LocaleToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-brand-500">
            <Clock className="h-7 w-7 text-white" />
          </div>
          <h1 className="mt-6 text-2xl font-bold text-foreground">
            {t("welcome")}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {t("setupDescription")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label
              htmlFor="companyName"
              className="block text-sm font-medium text-foreground"
            >
              {t("companyName")}
            </label>
            <input
              id="companyName"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder={t("companyPlaceholder")}
              className="mt-1 block w-full rounded-lg border border-border px-4 py-3 text-foreground placeholder-muted-foreground bg-background focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !companyName.trim()}
            className="w-full rounded-lg bg-brand-500 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
          >
            {loading ? t("creating") : t("createCompany")}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <LocaleProvider>
      <OnboardingForm />
    </LocaleProvider>
  );
}
