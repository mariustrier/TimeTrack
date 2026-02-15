"use client";

import { useTranslations } from "@/lib/i18n";

const H1: React.CSSProperties = {
  fontFamily: "var(--font-newsreader), 'Newsreader', serif",
  fontSize: 32, fontWeight: 500, letterSpacing: "-0.5px",
  color: "#1F2937", lineHeight: 1.2, marginBottom: 6,
};
const DATE: React.CSSProperties = {
  fontFamily: "var(--font-jetbrains), 'JetBrains Mono', monospace",
  fontSize: 12, color: "#9CA3AF", marginBottom: 24,
};
const INTRO: React.CSSProperties = {
  fontSize: 14.5, lineHeight: 1.75, color: "#6B7280", marginBottom: 8,
};
const H2: React.CSSProperties = {
  fontFamily: "var(--font-newsreader), 'Newsreader', serif",
  fontSize: 20, fontWeight: 500, color: "#1F2937",
  marginTop: 40, marginBottom: 10, letterSpacing: "-0.3px",
};
const P: React.CSSProperties = {
  fontSize: 14.5, lineHeight: 1.75, color: "#6B7280", marginTop: 6,
};
const ACCENT: React.CSSProperties = {
  width: 32, height: 3, borderRadius: 2, background: "#1E3A5F",
  opacity: 0.2, marginBottom: 20,
};

export default function TermsPage() {
  const t = useTranslations("legal");

  return (
    <>
      <div style={ACCENT} />
      <h1 style={H1}>{t("termsTitle")}</h1>
      <p style={DATE}>{t("termsLastUpdated")}</p>
      <p style={INTRO}>{t("termsIntro")}</p>

      <h2 style={H2}>{t("termsServiceDescTitle")}</h2>
      <p style={P}>{t("termsServiceDesc")}</p>

      <h2 style={H2}>{t("termsAccountTitle")}</h2>
      <p style={P}>{t("termsAccountDesc")}</p>

      <h2 style={H2}>{t("termsAcceptableUseTitle")}</h2>
      <p style={P}>{t("termsAcceptableUseDesc")}</p>

      <h2 style={H2}>{t("termsDataOwnershipTitle")}</h2>
      <p style={P}>{t("termsDataOwnershipDesc")}</p>

      <h2 style={H2}>{t("termsServiceLevelTitle")}</h2>
      <p style={P}>{t("termsServiceLevelDesc")}</p>

      <h2 style={H2}>{t("termsLiabilityTitle")}</h2>
      <p style={P}>{t("termsLiabilityDesc")}</p>

      <h2 style={H2}>{t("termsTerminationTitle")}</h2>
      <p style={P}>{t("termsTerminationDesc")}</p>

      <h2 style={H2}>{t("termsDisputeTitle")}</h2>
      <p style={P}>{t("termsDisputeDesc")}</p>

      <h2 style={H2}>{t("governingLaw")}</h2>
      <p style={P}>{t("governingLawDesc")}</p>
    </>
  );
}
