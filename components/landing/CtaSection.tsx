import Link from "next/link";

export function CtaSection() {
  return (
    <div className="lp-cta">
      <h2>
        Få overblik. <em>Fakturér mere.</em>
      </h2>
      <p>
        Cloud Timer er bygget til danske arkitekter, ingeniører og konsulenter,
        der vil have styr på tid, økonomi og kapacitet — i ét system.
      </p>
      <div className="lp-cta-acts">
        <Link href="/sign-up" className="lp-btn lp-btn-p lp-btn-lg">
          Kom i gang — gratis i beta
        </Link>
        <a href="#integrations" className="lp-btn lp-btn-s lp-btn-lg">
          Se integrationer
        </a>
      </div>
    </div>
  );
}
