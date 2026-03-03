import "nextra-theme-docs/style.css";
import "./globals.css";

import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { getPageMap } from "nextra/page-map";
import type { Metadata } from "next";

const siteUrl = "https://oneglanse.com/docs";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "OneGlanse Docs",
    template: "%s | OneGlanse Docs",
  },
  description:
    "Production documentation for deploying and operating OneGlanse with self-hosted infrastructure.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "OneGlanse Docs",
    title: "OneGlanse Docs",
    description:
      "Production documentation for deploying and operating OneGlanse with self-hosted infrastructure.",
  },
  twitter: {
    card: "summary_large_image",
    title: "OneGlanse Docs",
    description:
      "Production documentation for deploying and operating OneGlanse with self-hosted infrastructure.",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): Promise<React.JSX.Element> {
  const pageMap = await getPageMap();

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Layout
          pageMap={pageMap}
          docsRepositoryBase="https://github.com/aryamantodkar/oneglanse/tree/main/apps/docs/content"
          navbar={<Navbar logo={<span className="docs-logo">OneGlanse Docs</span>} />}
          footer={<Footer>MIT {new Date().getFullYear()} © OneGlanse</Footer>}
          nextThemes={{ defaultTheme: "light", attribute: "class" }}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
