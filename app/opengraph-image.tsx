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
            viewBox="340 380 340 240"
            fill="white"
          >
            <polyline points="500 445.6 500 500 535.5 523.2" fill="none" stroke="white" strokeLinecap="round" strokeWidth="15" strokeMiterlimit="10"/>
            <path d="M616.8,467.2c-6.4-2.9-13.9-5.2-21.2-6.1-15.5-37.4-52.3-63.8-95.3-63.8s-45.8,8.1-63.2,21.7c-.9,0-1.8,0-2.7,0-33.1,0-60,26.9-60,60s.3,6.7.8,9.9c-20.5,9.5-34.8,30.3-34.8,54.4s26.9,60,60,60h99.9c1.2,0,2.3,0,3.5,0-1.2,0-2.3,0-3.5,0h2.5c2.8,0,5.6-.3,8.4-.6.2,0,.4,0,.6,0,.5,0,.9,0,1.4-.2-.3,0-.6,0-.9,0,1.2-.1,2.4-.3,3.5-.5,0,0,0,0,0,0,0,0,0,0,0,0,1.4-.2,2.7-.4,4.1-.7.2,0,.3,0,.5,0,1.3-.3,2.6-.5,3.8-.8.1,0,.2,0,.3,0,4.2-1,8.2-2.3,12.2-3.8.2,0,.4-.2.6-.2,1.1-.4,2.2-.9,3.3-1.3.2,0,.4-.2.6-.3,4.6-2,9-4.3,13.2-6.9,29.3-18.2,48.9-50.6,48.9-87.6s-.6-13.2-1.9-19.5c7.1,2,13.9,5.4,19.4,9.9,12,9.7,19.7,24.5,19.7,41.2,0,29.2-23.7,52.9-52.9,52.9s-.6,0-.9,0c-.3.4-.7.7-1,1.1-6.7,6.7-14.1,12.6-22,17.5l21.6-.5h1.1c.3,0,1,0,1.3,0,39.1,0,70.9-31.8,70.9-70.9s-17.2-53.5-41.8-64.7ZM508.8,602.9c.6,0,1.3-.1,1.9-.2-.6,0-1.3.1-1.9.2ZM505.1,603.1c.7,0,1.5,0,2.2-.1-.7,0-1.5,0-2.2.1ZM500.3,585.2c-17.3,0-33.4-5.2-46.8-14.1-23-15.2-38.2-41.3-38.2-70.9s18.4-61,45.4-75.2c11.8-6.2,25.3-9.8,39.5-9.8,46.9,0,85,38,85,85s-38,85-85,85Z"/>
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
