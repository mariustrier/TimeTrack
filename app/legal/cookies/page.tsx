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
const CODE: React.CSSProperties = {
  fontFamily: "var(--font-jetbrains), 'JetBrains Mono', monospace",
  fontSize: 12.5, background: "#F3F4F6", color: "#374151",
  padding: "2px 8px", borderRadius: 5, border: "1px solid rgba(0,0,0,0.04)",
};
const ACCENT: React.CSSProperties = {
  width: 32, height: 3, borderRadius: 2, background: "#1E3A5F",
  opacity: 0.2, marginBottom: 20,
};

export default function CookiesPage() {
  const t = useTranslations("legal");

  return (
    <>
      <div style={ACCENT} />
      <h1 style={H1}>{t("cookieTitle")}</h1>
      <p style={DATE}>{t("cookieLastUpdated")}</p>
      <p style={INTRO}>{t("cookieIntro")}</p>

      <h2 style={H2}>{t("whatAreCookies")}</h2>
      <p style={P}>{t("whatAreCookiesDesc")}</p>

      <h2 style={H2}>{t("essentialCookies")}</h2>
      <p style={P}>{t("essentialCookiesDesc")}</p>
      <ul style={UL}>
        {["cookieClerkSession", "cookieClerkClient", "cookieConsent"].map(k => (
          <li key={k} style={LI}><span style={BULLET} /><code style={CODE}>{t(k)}</code></li>
        ))}
      </ul>

      <h2 style={H2}>{t("optionalCookies")}</h2>
      <p style={P}>{t("optionalCookiesDesc")}</p>

      <h2 style={H2}>{t("manageCookies")}</h2>
      <p style={P}>{t("manageCookiesDesc")}</p>

      <h2 style={H2}>{t("policyChanges")}</h2>
      <p style={P}>{t("policyChangesDesc")}</p>
    </>
  );
}
