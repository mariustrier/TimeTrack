import { RevealOnScroll } from "./RevealOnScroll";

export function FounderQuote() {
  return (
    <RevealOnScroll className="lp-founder lp-reveal">
      <blockquote>
        &ldquo;Som arkitekt har jeg oplevet, hvordan selv dygtige teams har
        mistet overblikket over projekter og ikke-fakturerbare timer.{" "}
        <em>Cloud Timer er mit svar på det problem.</em>&rdquo;
      </blockquote>
      <div className="lp-founder-sig">
        <div className="lp-founder-av">M</div>
        <div className="lp-founder-info">
          <div className="lp-nm">Marius Trier Krogh</div>
          <div className="lp-rl">Arkitekt &amp; stifter af Cloud Timer</div>
        </div>
      </div>
    </RevealOnScroll>
  );
}
