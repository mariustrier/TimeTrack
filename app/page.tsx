import { Newsreader, JetBrains_Mono } from "next/font/google";
import type { Metadata } from "next";

import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { IntegrationBar } from "@/components/landing/IntegrationBar";
import { DanishAdvantage } from "@/components/landing/DanishAdvantage";
import { BrowserShowcase } from "@/components/landing/BrowserShowcase";
import { TimelinePreview } from "@/components/landing/TimelinePreview";
import { ResourcePlannerPreview } from "@/components/landing/ResourcePlannerPreview";
import { InsightSection } from "@/components/landing/InsightSection";
import { GraphStrip } from "@/components/landing/GraphStrip";
import { FounderQuote } from "@/components/landing/FounderQuote";
import { CtaSection } from "@/components/landing/CtaSection";
import { WhyChoose } from "@/components/landing/WhyChoose";
import { Footer } from "@/components/landing/Footer";

const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500"],
  variable: "--font-newsreader",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title:
    "Cloud Timer — Tidsregistrering, projektøkonomi og fakturering for danske rådgivere",
  description:
    "Den danske platform for arkitekter, ingeniører og konsulenter. Flex, ferielov, integration til e-conomic, Dinero og Billy.",
};

export default function LandingPage() {
  return (
    <div
      className={`${newsreader.variable} ${jetbrainsMono.variable}`}
      style={{
        fontFamily: "'DM Sans', sans-serif",
        background: "var(--lp-bg)",
        color: "var(--lp-text)",
        overflowX: "hidden",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <Nav />

      <Hero />

      <IntegrationBar />

      <DanishAdvantage />

      <BrowserShowcase
        tag="Projekttidslinje"
        title={
          <>
            Se alle projekter. <em>Få overblik med det samme.</em>
          </>
        }
        subtitle="Forstå med det samme hvilke projekter der tjener penge, og hvilke der spiser af bundlinjen — før det er for sent."
        url="app.cloudtimer.dk/projects/timeline"
      >
        <TimelinePreview monoClass={jetbrainsMono.className} />
      </BrowserShowcase>

      <BrowserShowcase
        tag="Ressourceplanlægger"
        title={
          <>
            Se kapaciteten. <em>Før den bliver et problem.</em>
          </>
        }
        subtitle="Se hvem der er overbelastet, og hvem der har ledig tid — så I undgår brandslukning og overskredne budgetter."
        url="app.cloudtimer.dk/resources/planner"
      >
        <ResourcePlannerPreview monoClass={jetbrainsMono.className} />
      </BrowserShowcase>

      <InsightSection />

      <GraphStrip monoClass={jetbrainsMono.className} />

      <FounderQuote />

      <CtaSection />

      <WhyChoose />

      <Footer />
    </div>
  );
}
