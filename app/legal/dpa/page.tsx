"use client";

import { useTranslations } from "@/lib/i18n";

export default function DpaPage() {
  const t = useTranslations("legal");

  const subProcessors = [
    { name: "Vercel Inc.", service: "Hosting & file storage", location: "USA", safeguard: "EU-US DPF" },
    { name: "Neon Inc.", service: "PostgreSQL database", location: "USA", safeguard: "EU-US DPF" },
    { name: "Clerk Inc.", service: "Authentication", location: "USA", safeguard: "EU-US DPF" },
    { name: "Anthropic PBC", service: "AI analysis (optional)", location: "USA", safeguard: "EU-US DPF" },
  ];

  return (
    <>
      <h1 className="text-3xl font-bold text-foreground">{t("dpaTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("dpaLastUpdated")}</p>
      <p className="mt-6 text-muted-foreground">{t("dpaIntro")}</p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">{t("dpaRolesTitle")}</h2>
      <p className="mt-2 text-muted-foreground">{t("dpaRolesDesc")}</p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">{t("dpaDataTypesTitle")}</h2>
      <p className="mt-2 text-muted-foreground">{t("dpaDataTypesDesc")}</p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">{t("dpaPurposeTitle")}</h2>
      <p className="mt-2 text-muted-foreground">{t("dpaPurposeDesc")}</p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">{t("dpaSecurityTitle")}</h2>
      <p className="mt-2 text-muted-foreground">{t("dpaSecurityDesc")}</p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">{t("dpaBreachTitle")}</h2>
      <p className="mt-2 text-muted-foreground">{t("dpaBreachDesc")}</p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">{t("dpaDeletionTitle")}</h2>
      <p className="mt-2 text-muted-foreground">{t("dpaDeletionDesc")}</p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">{t("dpaAuditTitle")}</h2>
      <p className="mt-2 text-muted-foreground">{t("dpaAuditDesc")}</p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">{t("dpaTransferTitle")}</h2>
      <p className="mt-2 text-muted-foreground">{t("dpaTransferDesc")}</p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">{t("dpaSubProcessorTable")}</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="pb-2 text-left font-semibold text-foreground">{t("dpaSubName")}</th>
              <th className="pb-2 text-left font-semibold text-foreground">{t("dpaSubService")}</th>
              <th className="pb-2 text-left font-semibold text-foreground">{t("dpaSubLocation")}</th>
              <th className="pb-2 text-left font-semibold text-foreground">{t("dpaSubSafeguard")}</th>
            </tr>
          </thead>
          <tbody>
            {subProcessors.map((sp) => (
              <tr key={sp.name} className="border-b border-border/50">
                <td className="py-2 text-muted-foreground">{sp.name}</td>
                <td className="py-2 text-muted-foreground">{sp.service}</td>
                <td className="py-2 text-muted-foreground">{sp.location}</td>
                <td className="py-2 text-muted-foreground">{sp.safeguard}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-xl font-semibold text-foreground">{t("governingLaw")}</h2>
      <p className="mt-2 text-muted-foreground">{t("governingLawDesc")}</p>
    </>
  );
}
