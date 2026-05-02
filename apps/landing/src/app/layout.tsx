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
	title: "OneGlanse | Open-source GEO & AI Visibility Platform",
	description:
		"Track brand visibility across LLM providers with self-hostable agents, ClickHouse analytics, and reproducible prompt testing.",
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
		title: "OneGlanse | Open-source GEO & AI Visibility Platform",
		description:
			"Track brand visibility across LLM providers with self-hostable agents, ClickHouse analytics, and reproducible prompt testing.",
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
		title: "OneGlanse | Open-source GEO & AI Visibility Platform",
		description:
			"Track brand visibility across LLM providers with self-hostable agents, ClickHouse analytics, and reproducible prompt testing.",
		images: ["/twitter-image"],
	},
};

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
	return (
		<html lang="en" className={geist.variable} suppressHydrationWarning>
			<body>
				{children}
				<Analytics />
			</body>
		</html>
	);
}
