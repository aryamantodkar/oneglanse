import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px",
          background:
            "radial-gradient(circle at 20% 20%, #f5f5f5 0%, #ffffff 35%, #f7f7f7 100%)",
          color: "#111111",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              fontSize: 34,
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            OneGlanse
          </div>
          <div
            style={{
              border: "1px solid #d4d4d4",
              borderRadius: 9999,
              padding: "8px 14px",
              fontSize: 18,
              color: "#404040",
            }}
          >
            Open Source
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px", maxWidth: "940px" }}>
          <div style={{ fontSize: 66, fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em" }}>
            Track AI visibility with source-level proof.
          </div>
          <div style={{ fontSize: 30, color: "#525252", lineHeight: 1.2 }}>
            Open-source GEO analytics for prompts, models, sentiment, and citations.
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          {["Visibility", "Mentions", "Sentiment", "Citations"].map((item) => (
            <div
              key={item}
              style={{
                border: "1px solid #d4d4d4",
                borderRadius: 12,
                padding: "10px 14px",
                fontSize: 20,
                color: "#404040",
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
