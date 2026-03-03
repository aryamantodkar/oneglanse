import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "OneGlanse Docs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage(): ImageResponse {
  return new ImageResponse(
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "flex-start",
      justifyContent: "flex-end", width: "100%", height: "100%",
      backgroundColor: "#0a0a0a", padding: "72px",
      fontFamily: "system-ui, sans-serif",
    }}>
      <p style={{ fontSize: "14px", fontWeight: 600, color: "#52525b", margin: "0 0 32px" }}>
        oneglanse.com/docs
      </p>
      <p style={{ fontSize: "72px", fontWeight: 700, color: "#fafafa",
        lineHeight: 1.0, letterSpacing: "-0.04em", margin: "0 0 20px" }}>
        OneGlanse Docs
      </p>
      <p style={{ fontSize: "26px", color: "#a1a1aa", margin: 0, lineHeight: 1.4 }}>
        Self-hosting, deployment, and configuration reference
      </p>
    </div>,
    { width: 1200, height: 630 },
  );
}
