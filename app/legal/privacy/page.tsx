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
const UL: React.CSSProperties = {
  listStyle: "none", padding: 0, margin: "12px 0 0",
  display: "flex", flexDirection: "column", gap: 8,
};
const LI: React.CSSProperties = {
  fontSize: 14, lineHeight: 1.65, color: "#6B7280",
  paddingLeft: 20, position: "relative",
};
const BULLET: React.CSSProperties = {
  position: "absolute", left: 0, top: 8,
  width: 6, height: 6, borderRadius: "50%",
  background: "#1E3A5F", opacity: 0.35,
};
const ACCENT: React.CSSProperties = {
  width: 32, height: 3, borderRadius: 2, background: "#1E3A5F",
  opacity: 0.2, marginBottom: 20,
};

export default function PrivacyPage() {
  const t = useTranslations("legal");

  return (
    <>
      <div style={ACCENT} />
      <h1 style={H1}>{t("privacyTitle")}</h1>
      <p style={DATE}>{t("privacyLastUpdated")}</p>
      <p style={INTRO}>{t("privacyIntro")}</p>

      <h2 style={H2}>{t("whatWeCollect")}</h2>
      <p style={P}>{t("whatWeCollectDesc")}</p>

      <h2 style={H2}>{t("howWeUse")}</h2>
      <p style={P}>{t("howWeUseDesc")}</p>

      <h2 style={H2}>{t("thirdParties")}</h2>
      <p style={P}>{t("thirdPartiesDesc")}</p>
      <ul style={UL}>
        {["thirdPartyClerk", "thirdPartyVercel", "thirdPartyNeon", "thirdPartyStripe", "thirdPartyAnthropic"].map(k => (
          <li key={k} style={LI}><span style={BULLET} />{t(k)}</li>
        ))}
      </ul>

      <h2 style={H2}>{t("subProcessors")}</h2>
      <p style={P}>{t("subProcessorsDesc")}</p>
      <ul style={UL}>
        {["subVercel", "subNeon", "subClerk", "subAnthropic"].map(k => (
          <li key={k} style={LI}><span style={BULLET} />{t(k)}</li>
        ))}
      </ul>

      <h2 style={H2}>{t("dataRetention")}</h2>
      <p style={P}>{t("dataRetentionDesc")}</p>
      <p style={{ ...P, fontWeight: 600, color: "#374151" }}>{t("retentionNotice")}</p>

      <h2 style={H2}>{t("gdprRights")}</h2>
      <p style={P}>{t("gdprRightsDesc")}</p>
      <ul style={UL}>
        {["gdprAccess", "gdprRectify", "gdprErase", "gdprPortability", "gdprObject", "gdprWithdraw"].map(k => (
          <li key={k} style={LI}><span style={BULLET} />{t(k)}</li>
        ))}
      </ul>
      <p style={{ ...P, marginTop: 14 }}>{t("datatilsynet")}</p>

      <h2 style={H2}>{t("contact")}</h2>
      <p style={P}>{t("contactDesc")}</p>
      <p style={{
        ...P, marginTop: 8,
        fontFamily: "var(--font-jetbrains), 'JetBrains Mono', monospace",
        fontSize: 13, color: "#1E3A5F",
      }}>
        admin@cloudtimer.dk
      </p>

      <h2 style={H2}>{t("governingLaw")}</h2>
      <p style={P}>{t("governingLawDesc")}</p>

      <h2 style={H2}>{t("policyChanges")}</h2>
      <p style={P}>{t("policyChangesDesc")}</p>
    </>
  );
}
