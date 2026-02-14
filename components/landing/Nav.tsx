import Link from "next/link";

export function Nav() {
  return (
    <nav className="lp-nav">
      <Link href="/" className="lp-logo">
        <div className="lp-logo-mark" />
        Cloud Timer
      </Link>
      <div className="lp-nav-r">
        <Link href="/sign-in" className="lp-btn lp-btn-s">Log ind</Link>
        <Link href="/sign-up" className="lp-btn lp-btn-p">Opret konto</Link>
      </div>
    </nav>
  );
}
