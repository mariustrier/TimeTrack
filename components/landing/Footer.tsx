import Link from "next/link";

export function Footer() {
  return (
    <footer className="lp-footer">
      <p>© 2026 Cloud Timer · cloudtimer.dk</p>
      <div className="lp-fl">
        <Link href="/legal/privacy">Privatlivspolitik</Link>
        <Link href="/legal/terms">Vilkår</Link>
        <a href="mailto:hello@cloudtimer.dk">Kontakt</a>
      </div>
    </footer>
  );
}
