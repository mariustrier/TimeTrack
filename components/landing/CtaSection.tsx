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
      <LiveDemoButton />
      <div className="lp-cta-acts">
        <Link href="/sign-up" className="lp-btn lp-btn-s lp-btn-lg">
          Kom i gang — gratis i beta
        </Link>
      </div>
    </div>
  );
}
