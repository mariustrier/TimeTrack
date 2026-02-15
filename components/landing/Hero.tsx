import Link from "next/link";
import { LiveDemoButton } from "./LiveDemoButton";

export function Hero() {
  return (
    <section className="lp-hero">
      <h1>
        Få betaling for <em>al jeres tid</em>.<br />Bygget til danske rådgivere.
      </h1>
      <p className="lp-hero-sub">
        Slut med systemer, der ikke forstår flex og feriepenge.<br />
        Cloud Timer samler tidsregistrering, projektøkonomi og fakturering <strong>ét sted</strong>.
      </p>
      <div className="lp-hero-acts" style={{ gap: 32 }}>
        <LiveDemoButton />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Link href="/sign-up" className="lp-btn lp-btn-s lp-btn-lg">
            Opret konto
          </Link>
          <p className="lp-demo-sub">Gratis mens vi tester systemet.</p>
        </div>
      </div>
    </section>
  );
}
