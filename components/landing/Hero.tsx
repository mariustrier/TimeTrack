import Link from "next/link";
import { LiveDemoButton } from "./LiveDemoButton";

export function Hero() {
  return (
    <section className="lp-hero">
      <h1>
        Få betaling for <em>al jeres tid</em>.<br />Bygget til danske rådgivere.
      </h1>
      <p className="lp-hero-sub">
        Slut med amerikanske systemer, der ikke forstår flex og feriepenge.
        Cloud Timer samler tidsregistrering, projektøkonomi og fakturering{" "}
        <strong>ét sted</strong>.
      </p>
      <div className="lp-hero-acts">
        <Link href="/sign-up" className="lp-btn lp-btn-p lp-btn-lg">
          Kom i gang — gratis i beta
        </Link>
        <a href="#integrations" className="lp-btn lp-btn-s lp-btn-lg">
          Se integrationer
        </a>
      </div>
      <LiveDemoButton />
      <p className="lp-hero-note">
        Gratis under beta · Intet kreditkort · Dansk support
      </p>
    </section>
  );
}
