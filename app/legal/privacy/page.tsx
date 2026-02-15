"use client";

import { useTranslations } from "@/lib/i18n";

export default function PrivacyPage() {
  const t = useTranslations("legal");

  return (
    <>
      <h1 className="text-3xl font-bold text-foreground">{t("privacyTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("privacyLastUpdated")}</p>
      <p className="mt-6 text-muted-foreground">{t("privacyIntro")}</p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">{t("whatWeCollect")}</h2>
      <p className="mt-2 text-muted-foreground">{t("whatWeCollectDesc")}</p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">{t("howWeUse")}</h2>
      <p className="mt-2 text-muted-foreground">{t("howWeUseDesc")}</p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">{t("thirdParties")}</h2>
      <p className="mt-2 text-muted-foreground">{t("thirdPartiesDesc")}</p>
      <ul className="mt-3 list-disc space-y-1 pl-6 text-muted-foreground">
        <li>{t("thirdPartyClerk")}</li>
        <li>{t("thirdPartyVercel")}</li>
        <li>{t("thirdPartyNeon")}</li>
        <li>{t("thirdPartyStripe")}</li>
        <li>{t("thirdPartyAnthropic")}</li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold text-foreground">{t("subProcessors")}</h2>
      <p className="mt-2 text-muted-foreground">{t("subProcessorsDesc")}</p>
      <ul className="mt-3 list-disc space-y-1 pl-6 text-muted-foreground">
        <li>{t("subVercel")}</li>
        <li>{t("subNeon")}</li>
        <li>{t("subClerk")}</li>
        <li>{t("subAnthropic")}</li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold text-foreground">{t("dataRetention")}</h2>
      <p className="mt-2 text-muted-foreground">{t("dataRetentionDesc")}</p>
      <p className="mt-2 text-muted-foreground font-medium">{t("retentionNotice")}</p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">{t("gdprRights")}</h2>
      <p className="mt-2 text-muted-foreground">{t("gdprRightsDesc")}</p>
      <ul className="mt-3 list-disc space-y-1 pl-6 text-muted-foreground">
        <li>{t("gdprAccess")}</li>
        <li>{t("gdprRectify")}</li>
        <li>{t("gdprErase")}</li>
        <li>{t("gdprPortability")}</li>
        <li>{t("gdprObject")}</li>
        <li>{t("gdprWithdraw")}</li>
      </ul>
      <p className="mt-4 text-muted-foreground">{t("datatilsynet")}</p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">{t("contact")}</h2>
      <p className="mt-2 text-muted-foreground">{t("contactDesc")}</p>
      <p className="mt-1 text-muted-foreground">admin@cloudtimer.dk</p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">{t("governingLaw")}</h2>
      <p className="mt-2 text-muted-foreground">{t("governingLawDesc")}</p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">{t("policyChanges")}</h2>
      <p className="mt-2 text-muted-foreground">{t("policyChangesDesc")}</p>
    </>
  );
}
