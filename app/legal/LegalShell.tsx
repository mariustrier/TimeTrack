"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LocaleProvider, useTranslations } from "@/lib/i18n";
import { LocaleToggle } from "@/components/ui/locale-toggle";
import { CookieConsent } from "@/components/ui/cookie-consent";

const NAV_LINKS = [
  { href: "/legal/privacy", key: "privacyPolicy" },
  { href: "/legal/terms", key: "termsOfService" },
  { href: "/legal/dpa", key: "dpa" },
  { href: "/legal/cookies", key: "cookiePolicy" },
] as const;

function Shell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("legal");
  const tl = useTranslations("landing");
  const pathname = usePathname();

  return (
    <>
      {/* ── Nav (matches landing page) ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        height: 56, padding: "0 40px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(250,249,247,.92)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
      }}>
        <Link href="/" style={{
          display: "flex", alignItems: "center", gap: 8,
          textDecoration: "none", fontWeight: 700, fontSize: 15,
          color: "#1F2937", letterSpacing: "-0.02em",
        }}>
          <div style={{
            width: 26, height: 26, background: "#1E3A5F", borderRadius: 7,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="220 180 200 220" fill="none" width="18" height="18">
              <polyline points="355.65 355.28 328.35 286.55 367.03 271.19" fill="none" stroke="white" strokeMiterlimit={10} strokeWidth="18"/>
              <path d="M327.22,381.56c-52.03,0-94.21-42.18-94.21-94.21s42.18-94.21,94.21-94.21" fill="none" stroke="white" strokeMiterlimit={10} strokeWidth="18"/>
            </svg>
          </div>
          Cloud Timer
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <LocaleToggle className="h-9 w-9 text-xs font-bold text-gray-500 border border-gray-200 rounded-lg bg-transparent hover:bg-gray-100" />
          <Link href="/sign-in" style={{
            display: "inline-flex", alignItems: "center",
            fontWeight: 600, borderRadius: 8, fontSize: 13, padding: "8px 18px",
            textDecoration: "none", color: "#1F2937",
            border: "1px solid rgba(0,0,0,0.10)", background: "transparent",
            transition: "all .3s cubic-bezier(.16,1,.3,1)",
          }}>
            {tl("signIn")}
          </Link>
          <Link href="/sign-up" style={{
            display: "inline-flex", alignItems: "center",
            fontWeight: 600, borderRadius: 8, fontSize: 13, padding: "8px 18px",
            textDecoration: "none", color: "white", background: "#1E3A5F",
            transition: "all .3s cubic-bezier(.16,1,.3,1)",
          }}>
            {tl("getStartedFree")}
          </Link>
        </div>
      </nav>

      {/* ── Breadcrumb / sub-nav ── */}
      <div style={{
        paddingTop: 56 + 16, paddingBottom: 8,
        maxWidth: 720, margin: "0 auto", padding: "72px 24px 0",
      }}>
        <div style={{
          display: "flex", gap: 6, flexWrap: "wrap", marginTop: 16,
        }}>
          {NAV_LINKS.map(({ href, key }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href} style={{
                fontSize: 12.5, fontWeight: 500, padding: "5px 14px",
                borderRadius: 8, textDecoration: "none",
                color: active ? "#1E3A5F" : "#6B7280",
                background: active ? "rgba(30,58,95,0.07)" : "transparent",
                border: active ? "none" : "1px solid rgba(0,0,0,0.06)",
                transition: "all .2s",
              }}>
                {t(key)}
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <main style={{
        maxWidth: 720, margin: "0 auto", padding: "24px 24px 80px",
      }}>
        <div style={{
          background: "white",
          border: "1px solid rgba(0,0,0,0.06)",
          borderRadius: 16,
          padding: "48px 44px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
          {children}
        </div>
      </main>

      {/* ── Footer (matches landing page) ── */}
      <footer style={{
        padding: "32px 40px",
        borderTop: "1px solid rgba(0,0,0,0.06)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        maxWidth: 1060, margin: "0 auto",
      }}>
        <p style={{ fontSize: 12, color: "#6B7280" }}>
          &copy; {new Date().getFullYear()} Cloud Timer &middot; cloudtimer.dk
        </p>
        <div style={{ display: "flex", gap: 18 }}>
          <Link href="/legal/privacy" style={{ fontSize: 12, color: "#6B7280", textDecoration: "none" }}>{t("privacyPolicy")}</Link>
          <Link href="/legal/terms" style={{ fontSize: 12, color: "#6B7280", textDecoration: "none" }}>{t("termsOfService")}</Link>
          <a href="mailto:admin@cloudtimer.dk" style={{ fontSize: 12, color: "#6B7280", textDecoration: "none" }}>{t("contact")}</a>
        </div>
      </footer>

      <CookieConsent />
    </>
  );
}

export function LegalShell({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <Shell>{children}</Shell>
    </LocaleProvider>
  );
}
