"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, Shield, Receipt, Calendar } from "lucide-react";
import { LocaleProvider, useTranslations } from "@/lib/i18n";

function ConsentContent() {
  const t = useTranslations("legal");
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/accept-terms", { method: "POST" });
      if (res.ok) {
        window.location.href = "/";
      }
    } finally {
      setLoading(false);
    }
  };

  const dataItems = [
    { icon: Shield, text: t("consentData1") },
    { icon: Clock, text: t("consentData2") },
    { icon: Receipt, text: t("consentData3") },
    { icon: Calendar, text: t("consentData4") },
  ];

  const footerText = t("consentFooter")
    .replace("{privacy}", "|||PRIVACY|||")
    .replace("{terms}", "|||TERMS|||");
  const footerParts = footerText.split("|||");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-8 shadow-lg">
        <div className="flex items-center gap-3">
          <Clock className="h-8 w-8 text-brand-500" />
          <h1 className="text-2xl font-bold text-foreground">{t("consentTitle")}</h1>
        </div>
        <p className="mt-4 text-muted-foreground">{t("consentDesc")}</p>

        <div className="mt-6 space-y-3">
          {dataItems.map((item, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3">
              <item.icon className="h-5 w-5 text-brand-500 shrink-0" />
              <span className="text-sm text-foreground">{item.text}</span>
            </div>
          ))}
        </div>

        <button
          onClick={handleAccept}
          disabled={loading}
          className="mt-8 w-full rounded-lg bg-brand-500 py-3 text-sm font-semibold text-white hover:bg-brand-600 transition-colors disabled:opacity-50"
        >
          {loading ? "..." : t("consentAccept")}
        </button>

        <p className="mt-4 text-xs text-muted-foreground">
          {footerParts.map((part, i) => {
            if (part === "PRIVACY") return <Link key={i} href="/legal/privacy" className="underline hover:text-foreground">{t("privacyPolicy")}</Link>;
            if (part === "TERMS") return <Link key={i} href="/legal/terms" className="underline hover:text-foreground">{t("termsOfService")}</Link>;
            return <span key={i}>{part}</span>;
          })}
        </p>
      </div>
    </div>
  );
}

export default function ConsentPage() {
  return (
    <LocaleProvider>
      <ConsentContent />
    </LocaleProvider>
  );
}
