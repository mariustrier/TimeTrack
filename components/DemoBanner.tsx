"use client";

import { useState, useEffect } from "react";
import { useClerk } from "@clerk/nextjs";
import { useTranslations } from "@/lib/i18n";
import { DemoExitModal } from "@/components/DemoExitModal";

export function DemoBanner() {
  const { signOut } = useClerk();
  const t = useTranslations("demo");
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    console.log("[DEMO_FUNNEL]", "banner_view");
  }, []);

  const handleSignup = async () => {
    console.log("[DEMO_FUNNEL]", "banner_signup_click");
    await signOut();
    window.location.href = "https://www.cloudtimer.dk/sign-up?from=demo";
  };

  const handleExit = () => {
    console.log("[DEMO_FUNNEL]", "banner_exit_click");
    setShowModal(true);
  };

  return (
    <>
      <style>{`
        @keyframes demo-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 40,
          zIndex: 9999,
          backgroundColor: "#1E3A5F",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13,
          color: "#fff",
        }}
      >
        {/* Left: pulsing dot + text */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: "#4ADE80",
              flexShrink: 0,
              animation: "demo-pulse 2s ease-in-out infinite",
            }}
          />
          <span
            style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
          >
            <span className="hidden sm:inline">{t("bannerText")}</span>
            <span className="sm:hidden">{t("bannerTextMobile")}</span>
          </span>
        </div>

        {/* Right: signup link + exit button */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <button
            onClick={handleSignup}
            style={{
              background: "none",
              border: "none",
              color: "#93C5FD",
              fontSize: 13,
              fontWeight: 500,
              fontFamily: "'DM Sans', sans-serif",
              cursor: "pointer",
              whiteSpace: "nowrap",
              padding: 0,
              textDecoration: "none",
            }}
            onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.color = "#BFDBFE"; }}
            onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.color = "#93C5FD"; }}
          >
            <span className="hidden sm:inline">{t("bannerSignup")}</span>
            <span className="sm:hidden">→</span>
          </button>
          <button
            onClick={handleExit}
            style={{
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 500,
              fontFamily: "'DM Sans', sans-serif",
              padding: "3px 12px",
              borderRadius: 6,
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.background = "rgba(255,255,255,0.2)"; }}
            onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.background = "rgba(255,255,255,0.12)"; }}
          >
            {t("bannerExit")}
          </button>
        </div>
      </div>

      <DemoExitModal open={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
