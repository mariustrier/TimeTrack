import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#3B82F6",
          borderRadius: "36px",
        }}
      >
        <svg
          width="120"
          height="120"
          viewBox="0 0 624.49 581.6"
          fill="none"
        >
          <polyline points="355.65 355.28 328.35 286.55 367.03 271.19" fill="none" stroke="white" strokeMiterlimit="10" strokeWidth="18"/>
          <path d="M327.22,381.56c-52.03,0-94.21-42.18-94.21-94.21s42.18-94.21,94.21-94.21" fill="none" stroke="white" strokeMiterlimit="10" strokeWidth="18"/>
        </svg>
      </div>
    ),
    { ...size }
  );
}
