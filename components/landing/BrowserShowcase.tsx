import { ReactNode } from "react";
import { RevealOnScroll } from "./RevealOnScroll";

export function BrowserShowcase({
  tag,
  title,
  subtitle,
  url,
  children,
}: {
  tag: string;
  title: ReactNode;
  subtitle: string;
  url: string;
  children: ReactNode;
}) {
  return (
    <div className="lp-show">
      <div className="lp-show-label">
        <div className="lp-show-label-tag">{tag}</div>
        <h2>{title}</h2>
      </div>
      <p className="lp-show-sub">{subtitle}</p>

      <RevealOnScroll className="lp-browser">
        <div className="lp-br-bar">
          <div className="lp-dots">
            <span />
            <span />
            <span />
          </div>
          <div className="lp-url-bar">🔒 {url}</div>
        </div>
        <div className="lp-main-area">{children}</div>
      </RevealOnScroll>
    </div>
  );
}
