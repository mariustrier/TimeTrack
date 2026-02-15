"use client";

import { useState, useEffect } from "react";
import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useTranslations } from "@/lib/i18n";

interface DemoExitModalProps {
  open: boolean;
  onClose: () => void;
}

export function DemoExitModal({ open, onClose }: DemoExitModalProps) {
  const { signOut } = useClerk();
  const router = useRouter();
  const t = useTranslations("demo");
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (open) {
      console.log("[DEMO_FUNNEL]", "modal_view");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleSignup = () => {
    console.log("[DEMO_FUNNEL]", "modal_signup_click");
    router.push("/sign-up?from=demo");
  };

  const handleBook = () => {
    console.log("[DEMO_FUNNEL]", "modal_book_click");
    window.location.href = "mailto:hello@cloudtimer.dk?subject=Demo%20booking";
  };

  const handleExit = async () => {
    console.log("[DEMO_FUNNEL]", "modal_exit_click");
    setExiting(true);
    try {
      await fetch("/api/demo/exit", { method: "POST" });
      await signOut();
      window.location.href = "/";
    } catch {
      setExiting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        backgroundColor: "rgba(0,0,0,0.4)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          margin: "0 16px",
          backgroundColor: "#fff",
          borderRadius: 16,
          padding: "40px 32px 32px",
          textAlign: "center",
          fontFamily: "'DM Sans', sans-serif",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
          position: "relative",
        }}
      >
        {exiting ? (
          <div style={{ padding: "40px 0" }}>
            <div
              style={{
                width: 32,
                height: 32,
                border: "3px solid #E5E7EB",
                borderTopColor: "#1E3A5F",
                borderRadius: "50%",
                margin: "0 auto 16px",
                animation: "demo-spin 0.8s linear infinite",
              }}
            />
            <p style={{ fontSize: 15, color: "#6B7280" }}>{t("modalExiting")}</p>
            <style>{`@keyframes demo-spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <>
            {/* Logo mark */}
            <div style={{ marginBottom: 20 }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 1000 1000"
                style={{ width: 48, height: 48, color: "#1E3A5F" }}
                fill="currentColor"
              >
                <polyline
                  points="500 445.6 500 500 535.5 523.2"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="15"
                  strokeMiterlimit="10"
                />
                <path d="M616.8,467.2c-6.4-2.9-13.9-5.2-21.2-6.1-15.5-37.4-52.3-63.8-95.3-63.8s-45.8,8.1-63.2,21.7c-.9,0-1.8,0-2.7,0-33.1,0-60,26.9-60,60s.3,6.7.8,9.9c-20.5,9.5-34.8,30.3-34.8,54.4s26.9,60,60,60h99.9c1.2,0,2.3,0,3.5,0-1.2,0-2.3,0-3.5,0h2.5c2.8,0,5.6-.3,8.4-.6.2,0,.4,0,.6,0,.5,0,.9,0,1.4-.2-.3,0-.6,0-.9,0,1.2-.1,2.4-.3,3.5-.5,0,0,0,0,0,0,0,0,0,0,0,0,1.4-.2,2.7-.4,4.1-.7.2,0,.3,0,.5,0,1.3-.3,2.6-.5,3.8-.8.1,0,.2,0,.3,0,4.2-1,8.2-2.3,12.2-3.8.2,0,.4-.2.6-.2,1.1-.4,2.2-.9,3.3-1.3.2,0,.4-.2.6-.3,4.6-2,9-4.3,13.2-6.9,29.3-18.2,48.9-50.6,48.9-87.6s-.6-13.2-1.9-19.5c7.1,2,13.9,5.4,19.4,9.9,12,9.7,19.7,24.5,19.7,41.2,0,29.2-23.7,52.9-52.9,52.9s-.6,0-.9,0c-.3.4-.7.7-1,1.1-6.7,6.7-14.1,12.6-22,17.5l21.6-.5h1.1c.3,0,1,0,1.3,0,39.1,0,70.9-31.8,70.9-70.9s-17.2-53.5-41.8-64.7ZM508.8,602.9c.6,0,1.3-.1,1.9-.2-.6,0-1.3.1-1.9.2ZM505.1,603.1c.7,0,1.5,0,2.2-.1-.7,0-1.5,0-2.2.1ZM500.3,585.2c-17.3,0-33.4-5.2-46.8-14.1-23-15.2-38.2-41.3-38.2-70.9s18.4-61,45.4-75.2c11.8-6.2,25.3-9.8,39.5-9.8,46.9,0,85,38,85,85s-38,85-85,85Z" />
              </svg>
            </div>

            {/* Headline */}
            <h2
              style={{
                fontFamily: "'Newsreader', serif",
                fontStyle: "italic",
                fontSize: 26,
                fontWeight: 500,
                color: "#1E3A5F",
                margin: "0 0 8px",
                lineHeight: 1.3,
              }}
            >
              {t("modalHeadline")}
            </h2>

            {/* Subtitle */}
            <p style={{ fontSize: 15, color: "#6B7280", margin: "0 0 20px" }}>
              {t("modalSubtitle")}
            </p>

            {/* Feature pills */}
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 28, flexWrap: "wrap" }}>
              {[t("modalPill1"), t("modalPill2"), t("modalPill3")].map((pill) => (
                <span
                  key={pill}
                  style={{
                    display: "inline-block",
                    padding: "5px 14px",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#1E3A5F",
                    backgroundColor: "#EFF6FF",
                    borderRadius: 20,
                    border: "1px solid #DBEAFE",
                  }}
                >
                  {pill}
                </span>
              ))}
            </div>

            {/* Primary button */}
            <button
              onClick={handleSignup}
              style={{
                display: "block",
                width: "100%",
                padding: "13px 0",
                fontSize: 15,
                fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
                color: "#fff",
                backgroundColor: "#1E3A5F",
                border: "none",
                borderRadius: 10,
                cursor: "pointer",
                marginBottom: 10,
                transition: "background-color 0.15s",
              }}
              onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.backgroundColor = "#2A4A73"; }}
              onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.backgroundColor = "#1E3A5F"; }}
            >
              {t("modalPrimary")}
            </button>

            {/* Secondary button */}
            <button
              onClick={handleBook}
              style={{
                display: "block",
                width: "100%",
                padding: "12px 0",
                fontSize: 14,
                fontWeight: 500,
                fontFamily: "'DM Sans', sans-serif",
                color: "#1E3A5F",
                backgroundColor: "transparent",
                border: "1.5px solid #D1D5DB",
                borderRadius: 10,
                cursor: "pointer",
                marginBottom: 16,
                transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.borderColor = "#9CA3AF"; }}
              onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.borderColor = "#D1D5DB"; }}
            >
              {t("modalSecondary")}
            </button>

            {/* Tertiary link */}
            <button
              onClick={handleExit}
              style={{
                display: "inline",
                background: "none",
                border: "none",
                fontSize: 13,
                color: "#9CA3AF",
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
                textDecoration: "underline",
                textUnderlineOffset: 3,
                padding: 0,
              }}
            >
              {t("modalTertiary")}
            </button>

            {/* Fine print */}
            <p style={{ fontSize: 12, color: "#D1D5DB", marginTop: 20 }}>
              {t("modalFinePrint")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
