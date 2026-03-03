import "nextra-theme-docs/style.css";
import "./globals.css";

import type { Metadata } from "next";
import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { getPageMap } from "nextra/page-map";

const siteUrl = "https://oneglanse.com/docs";

function ArrowUpRightIcon(): React.JSX.Element {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="docs-nav-icon">
      <path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GitHubIcon(): React.JSX.Element {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="docs-nav-icon">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 0 0-3.16 19.49c.5.1.68-.21.68-.48l-.01-1.7c-2.78.6-3.37-1.18-3.37-1.18-.45-1.14-1.1-1.44-1.1-1.44-.9-.62.07-.61.07-.61 1 .07 1.52 1.03 1.52 1.03.89 1.52 2.33 1.08 2.9.82.09-.64.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.95 0-1.1.39-2 1.03-2.7-.1-.25-.45-1.29.1-2.68 0 0 .84-.27 2.75 1.03a9.5 9.5 0 0 1 5 0c1.9-1.3 2.74-1.03 2.74-1.03.55 1.39.2 2.43.1 2.68.64.7 1.03 1.6 1.03 2.7 0 3.85-2.34 4.7-4.57 4.94.36.31.68.91.68 1.84l-.01 2.72c0 .27.18.59.69.48A10 10 0 0 0 12 2Z"
      />
    </svg>
  );
}

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
          navbar={
            <Navbar logo={<span className="docs-logo">OneGlanse Docs</span>}>
              <div className="docs-nav-actions">
                <a className="docs-nav-btn docs-nav-btn-secondary" href="https://github.com/aryamantodkar/oneglanse" target="_blank" rel="noreferrer">
                  <GitHubIcon />
                  <span>GitHub</span>
                </a>
                <a className="docs-nav-btn docs-nav-btn-primary" href="https://app.oneglanse.com" target="_blank" rel="noreferrer">
                  <span>Try App</span>
                  <ArrowUpRightIcon />
                </a>
              </div>
            </Navbar>
          }
          footer={<Footer>MIT {new Date().getFullYear()} © OneGlanse</Footer>}
          nextThemes={{ defaultTheme: "light", attribute: "class" }}
        >
          <div className="docs-page-enter">{children}</div>
        </Layout>
      </body>
    </html>
  );
}
