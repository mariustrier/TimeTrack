import Link from "next/link";

export function Nav() {
  return (
    <nav className="lp-nav">
      <Link href="/" className="lp-logo">
        <div className="lp-logo-mark">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 624.49 581.6" fill="none" width="14" height="14">
            <polyline points="355.65 355.28 328.35 286.55 367.03 271.19" fill="none" stroke="white" strokeMiterlimit="10" strokeWidth="18"/>
            <path d="M327.22,381.56c-52.03,0-94.21-42.18-94.21-94.21s42.18-94.21,94.21-94.21" fill="none" stroke="white" strokeMiterlimit="10" strokeWidth="18"/>
          </svg>
        </div>
        Cloud Timer
      </Link>
      <div className="lp-nav-r">
        <Link href="/sign-in" className="lp-btn lp-btn-s">Log ind</Link>
        <Link href="/sign-up" className="lp-btn lp-btn-p">Opret konto</Link>
      </div>
    </nav>
  );
}
