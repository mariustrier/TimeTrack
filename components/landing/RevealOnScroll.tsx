"use client";

import { useEffect, useRef, ReactNode } from "react";

export function RevealOnScroll({
  children,
  className = "",
  delay = 0,
  threshold = 0.1,
  rootMargin = "0px 0px -30px 0px",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  threshold?: number;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setTimeout(() => el.classList.add("v"), delay);
            obs.unobserve(el);
          }
        });
      },
      { threshold, rootMargin }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay, threshold, rootMargin]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
