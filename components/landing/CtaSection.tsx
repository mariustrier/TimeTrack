import Link from "next/link";
import { LiveDemoButton } from "./LiveDemoButton";

export function CtaSection() {
  return (
    <div className="lp-cta">
      <h2>
        Få overblik. <em>Fakturér mere.</em>
      </h2>
      <p>
        Cloud Timer er bygget til danske arkitekter, ingeniører og konsulentvirksomheder,
        der vil have styr på tid, økonomi og kapacitet — i ét system.
      </p>
      <div className="lp-cta-acts">
        <LiveDemoButton />
        <Link href="/sign-up" className="lp-btn lp-btn-s lp-btn-lg">
          Opret konto
        </Link>
      </div>
      <p className="lp-hero-note">
        Gratis mens vi tester systemet · Intet kreditkort
      </p>
    </div>
  );
}
