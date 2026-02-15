import Link from "next/link";

export function Footer() {
  return (
    <footer className="lp-footer" style={{ flexWrap: "wrap", gap: 12 }}>
      <p>© 2026 Cloud Timer · cloudtimer.dk · CVR: Afventer registrering</p>
      <div className="lp-fl">
        <Link href="/legal/privacy">Privatlivspolitik</Link>
        <Link href="/legal/terms">Vilkår</Link>
        <Link href="/legal/cookies">Cookiepolitik</Link>
        <a href="mailto:admin@cloudtimer.dk">Kontakt</a>
      </div>
    </footer>
  );
}
