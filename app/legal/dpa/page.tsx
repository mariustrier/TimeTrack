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
const TH: React.CSSProperties = {
  padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600,
  color: "#1F2937", borderBottom: "1px solid rgba(0,0,0,0.08)",
  fontFamily: "var(--font-jetbrains), 'JetBrains Mono', monospace",
  textTransform: "uppercase", letterSpacing: "0.5px",
};
const TD: React.CSSProperties = {
  padding: "10px 16px", fontSize: 13.5, color: "#6B7280",
  borderBottom: "1px solid rgba(0,0,0,0.04)",
};

const SUB_PROCESSORS = [
  { name: "Vercel Inc.", service: "Hosting & file storage", location: "USA", safeguard: "EU-US DPF" },
  { name: "Neon Inc.", service: "PostgreSQL database", location: "USA", safeguard: "EU-US DPF" },
  { name: "Clerk Inc.", service: "Authentication", location: "USA", safeguard: "EU-US DPF" },
  { name: "Anthropic PBC", service: "AI analysis (optional)", location: "USA", safeguard: "EU-US DPF" },
];

export default function DpaPage() {
  const t = useTranslations("legal");

  return (
    <>
      <div style={ACCENT} />
      <h1 style={H1}>{t("dpaTitle")}</h1>
      <p style={DATE}>{t("dpaLastUpdated")}</p>
      <p style={INTRO}>{t("dpaIntro")}</p>

      <h2 style={H2}>{t("dpaRolesTitle")}</h2>
      <p style={P}>{t("dpaRolesDesc")}</p>

      <h2 style={H2}>{t("dpaDataTypesTitle")}</h2>
      <p style={P}>{t("dpaDataTypesDesc")}</p>

      <h2 style={H2}>{t("dpaPurposeTitle")}</h2>
      <p style={P}>{t("dpaPurposeDesc")}</p>

      <h2 style={H2}>{t("dpaSecurityTitle")}</h2>
      <p style={P}>{t("dpaSecurityDesc")}</p>

      <h2 style={H2}>{t("dpaBreachTitle")}</h2>
      <p style={P}>{t("dpaBreachDesc")}</p>

      <h2 style={H2}>{t("dpaDeletionTitle")}</h2>
      <p style={P}>{t("dpaDeletionDesc")}</p>

      <h2 style={H2}>{t("dpaAuditTitle")}</h2>
      <p style={P}>{t("dpaAuditDesc")}</p>

      <h2 style={H2}>{t("dpaTransferTitle")}</h2>
      <p style={P}>{t("dpaTransferDesc")}</p>

      <h2 style={H2}>{t("dpaSubProcessorTable")}</h2>
      <div style={{ marginTop: 16, overflowX: "auto" }}>
        <table style={{
          width: "100%", borderCollapse: "collapse",
          background: "#FAFAF9", borderRadius: 10, overflow: "hidden",
          border: "1px solid rgba(0,0,0,0.06)",
        }}>
          <thead>
            <tr>
              <th style={TH}>{t("dpaSubName")}</th>
              <th style={TH}>{t("dpaSubService")}</th>
              <th style={TH}>{t("dpaSubLocation")}</th>
              <th style={TH}>{t("dpaSubSafeguard")}</th>
            </tr>
          </thead>
          <tbody>
            {SUB_PROCESSORS.map(sp => (
              <tr key={sp.name}>
                <td style={{ ...TD, fontWeight: 500, color: "#374151" }}>{sp.name}</td>
                <td style={TD}>{sp.service}</td>
                <td style={TD}>{sp.location}</td>
                <td style={TD}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "3px 8px",
                    borderRadius: 6, background: "rgba(5,150,105,0.08)", color: "#059669",
                  }}>
                    {sp.safeguard}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={H2}>{t("governingLaw")}</h2>
      <p style={P}>{t("governingLawDesc")}</p>
    </>
  );
}
