"use client";

import { useTranslations } from "@/lib/i18n";

export default function TermsPage() {
  const t = useTranslations("legal");

  return (
    <>
      <h1 className="text-3xl font-bold text-foreground">{t("termsTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("termsLastUpdated")}</p>
      <p className="mt-6 text-muted-foreground">{t("termsIntro")}</p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">{t("termsServiceDescTitle")}</h2>
      <p className="mt-2 text-muted-foreground">{t("termsServiceDesc")}</p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">{t("termsAccountTitle")}</h2>
      <p className="mt-2 text-muted-foreground">{t("termsAccountDesc")}</p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">{t("termsAcceptableUseTitle")}</h2>
      <p className="mt-2 text-muted-foreground">{t("termsAcceptableUseDesc")}</p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">{t("termsDataOwnershipTitle")}</h2>
      <p className="mt-2 text-muted-foreground">{t("termsDataOwnershipDesc")}</p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">{t("termsServiceLevelTitle")}</h2>
      <p className="mt-2 text-muted-foreground">{t("termsServiceLevelDesc")}</p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">{t("termsLiabilityTitle")}</h2>
      <p className="mt-2 text-muted-foreground">{t("termsLiabilityDesc")}</p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">{t("termsTerminationTitle")}</h2>
      <p className="mt-2 text-muted-foreground">{t("termsTerminationDesc")}</p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">{t("termsDisputeTitle")}</h2>
      <p className="mt-2 text-muted-foreground">{t("termsDisputeDesc")}</p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">{t("governingLaw")}</h2>
      <p className="mt-2 text-muted-foreground">{t("governingLawDesc")}</p>
    </>
  );
}
