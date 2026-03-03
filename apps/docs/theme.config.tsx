const config = {
  logo: <span className="docs-logo">OneGlanse Docs</span>,
  project: {
    link: "https://github.com/aryamantodkar/oneglanse",
  },
  docsRepositoryBase:
    "https://github.com/aryamantodkar/oneglanse/tree/main/apps/docs/content",
  footer: {
    text: `MIT ${new Date().getFullYear()} © OneGlanse`,
  },
  useNextSeoProps() {
    return {
      titleTemplate: "%s | OneGlanse Docs",
    };
  },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
      <meta name="theme-color" content="#111111" media="(prefers-color-scheme: dark)" />
    </>
  ),
};

export default config;
