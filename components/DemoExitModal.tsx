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

  const handleSignup = async () => {
    console.log("[DEMO_FUNNEL]", "modal_signup_click");
    await signOut();
    window.location.href = "https://www.cloudtimer.dk/sign-up?from=demo";
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
            {/* Logo + name */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 20 }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="220 180 200 220"
                style={{ width: 40, height: 40 }}
                fill="none"
              >
                <polyline
                  points="355.65 355.28 328.35 286.55 367.03 271.19"
                  fill="none"
                  stroke="#1E3A5F"
                  strokeMiterlimit="10"
                  strokeWidth="18"
                />
                <path
                  d="M327.22,381.56c-52.03,0-94.21-42.18-94.21-94.21s42.18-94.21,94.21-94.21"
                  fill="none"
                  stroke="#1E3A5F"
                  strokeMiterlimit="10"
                  strokeWidth="18"
                />
              </svg>
              <span style={{ fontSize: 22, fontWeight: 700, color: "#1E3A5F", letterSpacing: "-0.02em" }}>
                Cloud Timer
              </span>
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
