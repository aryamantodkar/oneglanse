import { generateStaticParamsFor, importPage } from "nextra/pages";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Fragment } from "react";
import { useMDXComponents as getMDXComponents } from "../../../mdx-components";

type PageProps = {
  params: Promise<{ mdxPath?: string[] }>;
};

export const generateStaticParams = generateStaticParamsFor("mdxPath");

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { mdxPath } = await params;
  const result = await importPage(mdxPath);

  if (!result) {
    return {};
  }

  const pagePath = mdxPath?.join("/") ?? "";
  const canonical = pagePath ? `/${pagePath}` : "/";
  const absoluteUrl = `https://oneglanse.com/docs${canonical}`;

  return {
    ...result.metadata,
    alternates: {
      canonical,
    },
    openGraph: {
      ...(result.metadata.openGraph ?? {}),
      url: absoluteUrl,
    },
  };
}

export default async function CatchAllPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { mdxPath } = await params;
  const result = await importPage(mdxPath);

  if (!result) {
    notFound();
  }

  const { default: MDXContent, toc, metadata, sourceCode } = result;
  const Wrapper = getMDXComponents({}).wrapper ?? Fragment;

  return (
    <Wrapper toc={toc} metadata={metadata} sourceCode={sourceCode}>
      <MDXContent params={{ mdxPath }} />
    </Wrapper>
  );
}
