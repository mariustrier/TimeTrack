"use client";

import Link from "next/link";
import { Clock } from "lucide-react";
import { LocaleProvider, useTranslations } from "@/lib/i18n";
import { LocaleToggle } from "@/components/ui/locale-toggle";
import { CookieConsent } from "@/components/ui/cookie-consent";

function LegalLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("legal");
  const tl = useTranslations("landing");

  return (
    <>
      <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-brand-950/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <Clock className="h-7 w-7 text-brand-400" />
            <span className="text-xl font-bold text-white">Cloud Timer</span>
          </Link>
          <div className="flex items-center gap-3">
            <LocaleToggle className="h-9 w-9 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10" />
            <Link
              href="/sign-in"
              className="text-sm text-slate-300 hover:text-white transition-colors"
            >
              {tl("signIn")}
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-4 pt-28 pb-20 sm:px-6 lg:px-8">
        {children}
      </main>

      <footer className="bg-brand-950 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-2">
              <Clock className="h-6 w-6 text-brand-400" />
              <span className="text-lg font-bold text-white">Cloud Timer</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/legal/privacy" className="text-sm text-slate-400 hover:text-white transition-colors">{t("privacyPolicy")}</Link>
              <Link href="/legal/terms" className="text-sm text-slate-400 hover:text-white transition-colors">{t("termsOfService")}</Link>
              <Link href="/legal/dpa" className="text-sm text-slate-400 hover:text-white transition-colors">{t("dpa")}</Link>
              <Link href="/legal/cookies" className="text-sm text-slate-400 hover:text-white transition-colors">{t("cookiePolicy")}</Link>
            </div>
            <p className="text-sm text-slate-400">
              &copy; {new Date().getFullYear()} Cloud Timer. {tl("allRightsReserved")}
            </p>
          </div>
          <p className="mt-4 text-center text-xs text-slate-500">{t("companyInfo")}</p>
        </div>
      </footer>
      <CookieConsent />
    </>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <LegalLayout>{children}</LegalLayout>
    </LocaleProvider>
  );
}
