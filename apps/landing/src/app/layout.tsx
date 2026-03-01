import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://oneglanse.com"),
  title: "OneGlanse | Open-source GEO & AI Visibility Platform",
  description:
    "Track brand visibility across LLM providers with self-hostable agents, ClickHouse analytics, and reproducible prompt testing.",
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
