import { ImageResponse } from "next/og";

export const runtime = "edge";
export const revalidate = 86400;
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
          padding: "52px",
          background:
            "linear-gradient(160deg, #ffffff 0%, #f7f7f7 55%, #f2f2f2 100%)",
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
            Open-source
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "980px" }}>
          <div style={{ fontSize: 62, fontWeight: 700, lineHeight: 1.04, letterSpacing: "-0.03em" }}>
            Open-source AI visibility tracking.
          </div>
          <div style={{ fontSize: 28, color: "#525252", lineHeight: 1.2 }}>
            Measure visibility, mentions, sentiment, and citations across model answers.
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {["Open Source", "Self-hostable", "Source-backed Insights", "AI Visibility"].map((item) => (
            <div
              key={item}
              style={{
                border: "1px solid #d4d4d4",
                borderRadius: 12,
                padding: "9px 12px",
                fontSize: 18,
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
