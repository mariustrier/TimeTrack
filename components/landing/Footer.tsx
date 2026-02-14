import Link from "next/link";

export function Footer() {
  return (
    <footer className="lp-footer">
      <p>© 2026 Cloud Timer · cloudtimer.dk</p>
      <div className="lp-fl">
        <Link href="/privacy">Privatlivspolitik</Link>
        <Link href="/terms">Vilkår</Link>
        <Link href="/contact">Kontakt</Link>
      </div>
    </footer>
  );
}
