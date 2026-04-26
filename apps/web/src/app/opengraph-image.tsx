import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
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
					padding: "60px",
					background:
						"linear-gradient(135deg, #09090b 0%, #0f0f14 60%, #0c0c12 100%)",
					color: "#ffffff",
					fontFamily:
						"ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
				}}
			>
				<div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em" }}>
					OneGlanse
				</div>

				<div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
					<div
						style={{
							fontSize: 64,
							fontWeight: 800,
							lineHeight: 1.0,
							letterSpacing: "-0.04em",
						}}
					>
						The only free,{"\n"}open-source GEO tracker.
					</div>
					<div
						style={{
							fontSize: 26,
							color: "rgba(255,255,255,0.5)",
							lineHeight: 1.35,
						}}
					>
						Monitor brand visibility, citations, and sentiment across AI
						products — for free.
					</div>
				</div>

				<div style={{ display: "flex", gap: "10px" }}>
					{["ChatGPT", "Gemini", "Perplexity", "Claude", "AI Overview"].map(
						(p) => (
							<div
								key={p}
								style={{
									border: "1px solid rgba(255,255,255,0.11)",
									borderRadius: 10,
									padding: "9px 16px",
									fontSize: 17,
									color: "rgba(255,255,255,0.65)",
									background: "rgba(255,255,255,0.05)",
								}}
							>
								{p}
							</div>
						),
					)}
				</div>
			</div>
		),
		size,
	);
}
