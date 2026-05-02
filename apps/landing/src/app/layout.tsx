import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Geist } from "next/font/google";

const geist = Geist({
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

export const metadata: Metadata = {
	metadataBase: new URL("https://oneglanse.com"),
	title: "OneGlanse | Open-source GEO & AI Visibility Tracker",
	description:
		"OneGlanse is the open-source GEO tracker that monitors how your brand appears in ChatGPT, Gemini, Perplexity, Claude, and Google AI Overview. Self-hosted, free to run, your data stays on your machine.",
	keywords: [
		"GEO",
		"generative engine optimization",
		"AI visibility",
		"AI visibility tracker",
		"AI visibility tracking",
		"brand visibility AI",
		"ChatGPT brand tracking",
		"Gemini brand tracking",
		"Perplexity brand tracking",
		"open source GEO tool",
		"self-hosted GEO",
		"LLM visibility",
		"AI search optimization",
		"AI mention tracking",
		"oneglanse",
	],
	alternates: {
		canonical: "https://oneglanse.com",
	},
	icons: {
		icon: [
			{
				url: "/logo.png",
				media: "(prefers-color-scheme: light)",
				type: "image/png",
			},
			{
				url: "/logo-dark.png",
				media: "(prefers-color-scheme: dark)",
				type: "image/png",
			},
		],
		shortcut: [
			{
				url: "/logo.png",
				type: "image/png",
			},
		],
		apple: [
			{
				url: "/logo.png",
				type: "image/png",
			},
		],
	},
	openGraph: {
		title: "OneGlanse | Open-source GEO & AI Visibility Tracker",
		description:
			"OneGlanse is the open-source GEO tracker that monitors how your brand appears in ChatGPT, Gemini, Perplexity, Claude, and Google AI Overview. Self-hosted, free to run, your data stays on your machine.",
		url: "https://oneglanse.com",
		siteName: "OneGlanse",
		type: "website",
		images: [
			{
				url: "/opengraph-image",
				width: 1200,
				height: 630,
				alt: "OneGlanse open-source AI visibility tracking",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "OneGlanse | Open-source GEO & AI Visibility Tracker",
		description:
			"OneGlanse is the open-source GEO tracker that monitors how your brand appears in ChatGPT, Gemini, Perplexity, Claude, and Google AI Overview. Self-hosted, free to run, your data stays on your machine.",
		images: ["/twitter-image"],
	},
};

const jsonLd = {
	"@context": "https://schema.org",
	"@type": "SoftwareApplication",
	name: "OneGlanse",
	url: "https://oneglanse.com",
	description:
		"Open-source GEO and AI visibility tracking platform. Monitors how brands appear in ChatGPT, Gemini, Perplexity, Claude, and Google AI Overview using real browser automation.",
	applicationCategory: "BusinessApplication",
	operatingSystem: "Linux, macOS, Windows",
	offers: {
		"@type": "Offer",
		price: "0",
		priceCurrency: "USD",
	},
	license: "https://github.com/aryamantodkar/oneglanse/blob/main/LICENSE",
	codeRepository: "https://github.com/aryamantodkar/oneglanse",
	author: {
		"@type": "Organization",
		name: "OneGlanse",
		url: "https://oneglanse.com",
		sameAs: ["https://github.com/aryamantodkar/oneglanse"],
	},
	keywords:
		"GEO, generative engine optimization, AI visibility, AI tracking, ChatGPT tracking, open source, self-hosted",
};

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
	return (
		<html lang="en" className={geist.variable} suppressHydrationWarning>
			<body>
				<script
					type="application/ld+json"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: structured data for search engines
					dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
				/>
				{children}
				<Analytics />
			</body>
		</html>
	);
}
