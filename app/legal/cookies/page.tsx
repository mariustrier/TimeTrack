"use client";

import { useTranslations } from "@/lib/i18n";

export default function CookiesPage() {
  const t = useTranslations("legal");

  return (
    <>
      <h1 className="text-3xl font-bold text-foreground">{t("cookieTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("cookieLastUpdated")}</p>
      <p className="mt-6 text-muted-foreground">{t("cookieIntro")}</p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">{t("whatAreCookies")}</h2>
      <p className="mt-2 text-muted-foreground">{t("whatAreCookiesDesc")}</p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">{t("essentialCookies")}</h2>
      <p className="mt-2 text-muted-foreground">{t("essentialCookiesDesc")}</p>
      <ul className="mt-3 list-disc space-y-1 pl-6 text-muted-foreground">
        <li><code className="rounded bg-muted px-1.5 py-0.5 text-xs">{t("cookieClerkSession")}</code></li>
        <li><code className="rounded bg-muted px-1.5 py-0.5 text-xs">{t("cookieClerkClient")}</code></li>
        <li><code className="rounded bg-muted px-1.5 py-0.5 text-xs">{t("cookieConsent")}</code></li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold text-foreground">{t("optionalCookies")}</h2>
      <p className="mt-2 text-muted-foreground">{t("optionalCookiesDesc")}</p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">{t("manageCookies")}</h2>
      <p className="mt-2 text-muted-foreground">{t("manageCookiesDesc")}</p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">{t("policyChanges")}</h2>
      <p className="mt-2 text-muted-foreground">{t("policyChangesDesc")}</p>
    </>
  );
}
