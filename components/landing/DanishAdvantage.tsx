import { RevealOnScroll } from "./RevealOnScroll";

export function DanishAdvantage() {
  return (
    <div className="lp-pains">
      <RevealOnScroll className="lp-pain" delay={0}>
        <div className="lp-pain-ico">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#1E3A5F" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="10" cy="10" r="8" />
            <path d="M10 5v5l3 2" />
          </svg>
        </div>
        <h3>Styr på Flex &amp; Tid</h3>
        <p>Glem Excel-arket. Systemet holder automatisk styr på flexsaldo, afspadsering og normtid for hver medarbejder.</p>
      </RevealOnScroll>

      <RevealOnScroll className="lp-pain" delay={80}>
        <div className="lp-pain-ico">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#1E3A5F" strokeWidth="1.5" strokeLinecap="round">
            <path d="M4 15h12M4 10h12M4 5h12" />
            <circle cx="16" cy="5" r="2" fill="#1E3A5F" />
          </svg>
        </div>
        <h3>Dansk Ferielov</h3>
        <p>Vi håndterer automatisk optjening (2,08 dage), ferieafholdelse og helligdage. Det kører bare.</p>
      </RevealOnScroll>

      <RevealOnScroll className="lp-pain" delay={160}>
        <div className="lp-pain-ico">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#1E3A5F" strokeWidth="1.5" strokeLinecap="round">
            <path d="M3 17V7l7-4 7 4v10" />
            <path d="M8 17v-5h4v5" />
          </svg>
        </div>
        <h3>Fra tid til Faktura</h3>
        <p>Send godkendte timer direkte til e-conomic, Dinero eller Billy som kladder med ét klik. Ingen manuel indtastning.</p>
      </RevealOnScroll>
    </div>
  );
}
