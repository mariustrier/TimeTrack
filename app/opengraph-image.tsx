import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Cloud Timer - Modern Time Tracking for Teams";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1e3a5f 0%, #3B82F6 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <svg
            width="64"
            height="64"
            viewBox="0 0 624.49 581.6"
            fill="none"
          >
            <polyline points="355.65 355.28 328.35 286.55 367.03 271.19" fill="none" stroke="white" strokeMiterlimit="10" strokeWidth="18"/>
            <path d="M327.22,381.56c-52.03,0-94.21-42.18-94.21-94.21s42.18-94.21,94.21-94.21" fill="none" stroke="white" strokeMiterlimit="10" strokeWidth="18"/>
          </svg>
          <span
            style={{
              fontSize: 64,
              fontWeight: 800,
              color: "white",
              letterSpacing: "-0.02em",
            }}
          >
            Cloud Timer
          </span>
        </div>
        <span
          style={{
            fontSize: 28,
            color: "rgba(255, 255, 255, 0.8)",
            maxWidth: "600px",
            textAlign: "center",
          }}
        >
          Modern Time Tracking for Teams
        </span>
        <span
          style={{
            fontSize: 18,
            color: "rgba(255, 255, 255, 0.6)",
            marginTop: "16px",
          }}
        >
          cloudtimer.dk
        </span>
      </div>
    ),
    { ...size }
  );
}
