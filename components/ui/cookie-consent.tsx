"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "@/lib/i18n";

export function CookieConsent() {
  const t = useTranslations("legal");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function accept() {
    localStorage.setItem("cookie-consent", "accepted");
    setVisible(false);
  }

  function reject() {
    localStorage.setItem("cookie-consent", "rejected");
    setVisible(false);
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card p-4 shadow-lg">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 sm:flex-row">
        <p className="flex-1 text-sm text-muted-foreground">
          {t("cookieConsentText")}{" "}
          <Link
            href="/legal/cookies"
            className="text-brand-600 underline hover:text-brand-700"
          >
            {t("learnMore")}
          </Link>
        </p>
        <div className="flex gap-3">
          <button
            onClick={reject}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
          >
            {t("rejectCookies")}
          </button>
          <button
            onClick={accept}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
          >
            {t("acceptCookies")}
          </button>
        </div>
      </div>
    </div>
  );
}
