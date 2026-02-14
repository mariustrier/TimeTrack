import { RevealOnScroll } from "./RevealOnScroll";
import { AnimatedCounter } from "./AnimatedCounter";

export function GraphStrip({ monoClass }: { monoClass?: string }) {
  const mc = monoClass || "";

  return (
    <div className="lp-graph-strip">
      <RevealOnScroll className="lp-g-card" delay={0}>
        <h3>Udnyttelsesgrad</h3>
        <div className="lp-sub">Fakturerbar tid vs. kapacitet</div>
        <AnimatedCounter target={74} suffix="%" className={`lp-g-big ${mc} lp-counter`} />
        <div className="lp-g-big-l">Gennemsnitlig — Q1 2026</div>
        <svg className="lp-g-svg" viewBox="0 0 240 100">
          <line className="lp-g-gl" x1="0" y1="25" x2="240" y2="25" />
          <line className="lp-g-gl" x1="0" y1="55" x2="240" y2="55" />
          <defs>
            <linearGradient id="aG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(30,58,95,.1)" />
              <stop offset="100%" stopColor="rgba(30,58,95,0)" />
            </linearGradient>
          </defs>
          <path className="lp-g-area" d="M0,68 C20,62 40,52 60,48 C85,42 105,38 130,30 C160,22 185,26 210,18 L240,12 L240,88 L0,88Z" fill="url(#aG)" />
          <path className="lp-g-line" d="M0,68 C20,62 40,52 60,48 C85,42 105,38 130,30 C160,22 185,26 210,18 L240,12" fill="none" stroke="var(--lp-accent)" strokeWidth="2" strokeLinecap="round" />
          <circle cx="240" cy="12" r="3" fill="var(--lp-accent)" className="lp-g-area" />
        </svg>
      </RevealOnScroll>

      <RevealOnScroll className="lp-g-card" delay={80}>
        <h3>Ikke-fakturerbare timer</h3>
        <div className="lp-sub">Hvor forsvinder de?</div>
        <svg className="lp-g-svg" viewBox="0 0 200 110" style={{ marginTop: 12 }}>
          <defs>
            <linearGradient id="b1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--lp-red)" /><stop offset="100%" stopColor="rgba(220,38,38,.3)" /></linearGradient>
            <linearGradient id="b2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#B45309" /><stop offset="100%" stopColor="rgba(180,83,9,.3)" /></linearGradient>
            <linearGradient id="b3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#92400E" /><stop offset="100%" stopColor="rgba(146,64,14,.3)" /></linearGradient>
            <linearGradient id="b4" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--lp-accent)" /><stop offset="100%" stopColor="rgba(30,58,95,.3)" /></linearGradient>
          </defs>
          <rect className="lp-g-bar" x="10" y="5" width="30" height="85" rx="5" fill="url(#b1)" style={{ transitionDelay: "0s" }} />
          <rect className="lp-g-bar" x="55" y="22" width="30" height="68" rx="5" fill="url(#b2)" style={{ transitionDelay: "0.08s" }} />
          <rect className="lp-g-bar" x="100" y="34" width="30" height="56" rx="5" fill="url(#b3)" style={{ transitionDelay: "0.16s" }} />
          <rect className="lp-g-bar" x="145" y="42" width="30" height="48" rx="5" fill="url(#b4)" style={{ transitionDelay: "0.24s" }} />
          <text className={`lp-g-lbl ${mc}`} x="14" y="104">Koord.</text>
          <text className={`lp-g-lbl ${mc}`} x="58" y="104">Rettel.</text>
          <text className={`lp-g-lbl ${mc}`} x="104" y="104">Tilbud</text>
          <text className={`lp-g-lbl ${mc}`} x="148" y="104">Møder</text>
        </svg>
      </RevealOnScroll>

      <RevealOnScroll className="lp-g-card" delay={160}>
        <h3>Tidsfordeling</h3>
        <div className="lp-sub">Projekt vs. intern</div>
        <div style={{ display: "flex", alignItems: "center", gap: 22, marginTop: 16 }}>
          <svg viewBox="0 0 100 100" width={120} height={120} style={{ flexShrink: 0 }}>
            <circle cx="50" cy="50" r="36" fill="none" stroke="var(--lp-surface-2)" strokeWidth="11" />
            <circle className="lp-g-ds a" cx="50" cy="50" r="36" fill="none" stroke="var(--lp-accent)" strokeWidth="11" pathLength={100} strokeLinecap="round" />
            <circle className="lp-g-ds b" cx="50" cy="50" r="36" fill="none" stroke="var(--lp-green)" strokeWidth="11" strokeDashoffset="-42" pathLength={100} strokeLinecap="round" />
            <circle className="lp-g-ds c" cx="50" cy="50" r="36" fill="none" stroke="#B45309" strokeWidth="11" strokeDashoffset="-65" pathLength={100} strokeLinecap="round" />
            <circle className="lp-g-ds d" cx="50" cy="50" r="36" fill="none" stroke="var(--lp-red)" strokeWidth="11" strokeDashoffset="-83" pathLength={100} strokeLinecap="round" />
            <text className={`lp-g-dc ${mc}`} x="50" y="47" textAnchor="middle" fill="var(--lp-text)" fontWeight="700" fontSize="13">1.2k</text>
            <text className="lp-g-dc" x="50" y="59" textAnchor="middle" fill="var(--lp-dim)" fontSize="8">timer</text>
          </svg>
          <div style={{ fontSize: 12, color: "var(--lp-dim)", lineHeight: 2.3 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 6, height: 6, borderRadius: 2, background: "var(--lp-accent)" }} />Projekt — 42%</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 6, height: 6, borderRadius: 2, background: "var(--lp-green)" }} />Klient — 23%</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 6, height: 6, borderRadius: 2, background: "#B45309" }} />Intern — 18%</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 6, height: 6, borderRadius: 2, background: "var(--lp-red)" }} />Admin — 17%</div>
          </div>
        </div>
      </RevealOnScroll>
    </div>
  );
}
