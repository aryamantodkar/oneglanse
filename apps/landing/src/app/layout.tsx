import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://oneglanse.com"),
  title: "OneGlanse | Open-source GEO & AI Visibility Platform",
  description:
    "Track brand visibility across LLM providers with self-hostable agents, ClickHouse analytics, and reproducible prompt testing.",
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
        alt: "OneGlanse preview",
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
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
