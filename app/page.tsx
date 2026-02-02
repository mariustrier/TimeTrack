"use client";

import Link from "next/link";
import {
  Clock,
  BarChart3,
  Users,
  Zap,
  TrendingUp,
  Shield,
  ArrowRight,
  Check,
} from "lucide-react";
import { LocaleProvider, useTranslations } from "@/lib/i18n";
import { LocaleToggle } from "@/components/ui/locale-toggle";
import { CookieConsent } from "@/components/ui/cookie-consent";

function Navbar() {
  const t = useTranslations("landing");
  return (
    <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-brand-950/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Clock className="h-7 w-7 text-brand-400" />
          <span className="text-xl font-bold text-white">Cloud Timer</span>
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm text-slate-300 hover:text-white transition-colors">{t("features")}</a>
          <a href="#pricing" className="text-sm text-slate-300 hover:text-white transition-colors">{t("earlyAccess")}</a>
        </div>
        <div className="flex items-center gap-3">
          <LocaleToggle className="h-9 w-9 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10" />
          <Link
            href="/sign-in"
            className="text-sm text-slate-300 hover:text-white transition-colors"
          >
            {t("signIn")}
          </Link>
          <Link
            href="/sign-up"
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
          >
            {t("getStarted")}
          </Link>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  const t = useTranslations("landing");
  return (
    <section className="gradient-bg relative overflow-hidden pt-32 pb-20 lg:pt-40 lg:pb-32">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMS41Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
            {t("heroTitle1")}{" "}
            <span className="text-brand-200">{t("heroTitle2")}</span>
          </h1>
          <p className="mt-6 text-lg text-brand-100/80 sm:text-xl">
            {t("heroSubtitle")}
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-3.5 text-sm font-semibold text-brand-700 shadow-lg hover:bg-brand-50 transition-all"
            >
              {t("startFreeTrial")}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-8 py-3.5 text-sm font-semibold text-white hover:bg-white/10 transition-all"
            >
              {t("seeFeatures")}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProblemSection() {
  const t = useTranslations("landing");
  const problems = [
    {
      icon: Clock,
      title: t("lostHours"),
      description: t("lostHoursDesc"),
    },
    {
      icon: TrendingUp,
      title: t("invisibleCosts"),
      description: t("invisibleCostsDesc"),
    },
    {
      icon: Users,
      title: t("teamBlindSpots"),
      description: t("teamBlindSpotsDesc"),
    },
  ];

  return (
    <section className="bg-muted/50 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t("problemTitle")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {t("problemSubtitle")}
          </p>
        </div>
        <div className="mt-16 grid gap-8 sm:grid-cols-3">
          {problems.map((problem) => (
            <div
              key={problem.title}
              className="rounded-xl border border-border bg-card p-8 shadow-sm"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950">
                <problem.icon className="h-6 w-6 text-red-500 dark:text-red-400" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                {problem.title}
              </h3>
              <p className="mt-2 text-muted-foreground">{problem.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const t = useTranslations("landing");
  const features = [
    {
      icon: Zap,
      title: t("oneClickEntry"),
      description: t("oneClickEntryDesc"),
      color: "bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400",
    },
    {
      icon: BarChart3,
      title: t("realTimeProfitability"),
      description: t("realTimeProfitabilityDesc"),
      color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
    },
    {
      icon: Shield,
      title: t("teamManagement"),
      description: t("teamManagementDesc"),
      color: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
    },
  ];

  return (
    <section id="features" className="bg-background py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t("featuresTitle")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {t("featuresSubtitle")}
          </p>
        </div>
        <div className="mt-16 grid gap-8 sm:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-xl border border-border bg-card p-8 shadow-sm transition-all hover:shadow-md"
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-lg ${feature.color}`}
              >
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="mt-2 text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  const t = useTranslations("landing");

  const allFeatures = [
    t("proF1"),
    t("proF2"),
    t("proF3"),
    t("proF4"),
    t("proF5"),
    t("proF6"),
    t("proF7"),
    t("proF8"),
  ];

  return (
    <section id="pricing" className="bg-muted/50 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t("earlyAccess")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {t("earlyAccessDesc")}
          </p>
        </div>
        <div className="mx-auto mt-12 max-w-lg">
          <div className="relative rounded-2xl border border-brand-500 ring-1 ring-brand-500 bg-card p-8 shadow-sm">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="rounded-full bg-brand-500 px-4 py-1 text-xs font-semibold text-white">
                {t("earlyAccess")}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-foreground">{t("allFeaturesIncluded")}</h3>
            <div className="mt-4">
              <span className="text-4xl font-bold text-foreground">{t("freePrice")}</span>
            </div>
            <ul className="mt-8 space-y-3">
              {allFeatures.map((feature) => (
                <li key={feature} className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-brand-500" />
                  <span className="text-sm text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/sign-up"
              className="mt-8 block rounded-lg bg-brand-500 py-3 text-center text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
            >
              {t("getStartedFree")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  const t = useTranslations("landing");
  return (
    <section className="gradient-bg py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {t("ctaTitle")}
          </h2>
          <p className="mt-4 text-lg text-brand-100/80">
            {t("ctaSubtitle")}
          </p>
          <div className="mt-10">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-3.5 text-sm font-semibold text-brand-700 shadow-lg hover:bg-brand-50 transition-all"
            >
              {t("getStartedFree")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const t = useTranslations("landing");
  const tl = useTranslations("legal");
  return (
    <footer className="bg-brand-950 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <Clock className="h-6 w-6 text-brand-400" />
            <span className="text-lg font-bold text-white">Cloud Timer</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/legal/privacy" className="text-sm text-slate-400 hover:text-white transition-colors">{tl("privacyPolicy")}</Link>
            <Link href="/legal/terms" className="text-sm text-slate-400 hover:text-white transition-colors">{tl("termsOfService")}</Link>
            <Link href="/legal/dpa" className="text-sm text-slate-400 hover:text-white transition-colors">{tl("dpa")}</Link>
            <Link href="/legal/cookies" className="text-sm text-slate-400 hover:text-white transition-colors">{tl("cookiePolicy")}</Link>
          </div>
          <p className="text-sm text-slate-400">
            &copy; {new Date().getFullYear()} Cloud Timer. {t("allRightsReserved")}
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Cloud Timer",
    url: "https://cloudtimer.dk",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "Track time, manage projects, and boost team profitability with Cloud Timer. Built for agencies and consultancies.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    publisher: {
      "@type": "Organization",
      name: "Cloud Timer",
      url: "https://cloudtimer.dk",
    },
  };

  return (
    <LocaleProvider>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main>
        <Navbar />
        <Hero />
        <ProblemSection />
        <FeaturesSection />
        <PricingSection />
        <CTASection />
        <Footer />
        <CookieConsent />
      </main>
    </LocaleProvider>
  );
}
