import { notFound } from "next/navigation";
import { DocsLayout } from "@/components/docs/docs-layout";
import { MarkdownRenderer } from "@/components/docs/markdown-renderer";
import { readDocBySlug } from "@/lib/docs-content";
import { DOC_SECTIONS } from "@/lib/docs-index";

type DocPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return DOC_SECTIONS.map((section) => ({ slug: section.slug }));
}

export default async function DocPage({ params }: DocPageProps): Promise<React.JSX.Element> {
  const { slug } = await params;
  const exists = DOC_SECTIONS.some((section) => section.slug === slug);

  if (!exists) {
    notFound();
  }

  const source = await readDocBySlug(slug);

  return (
    <DocsLayout activeSlug={slug}>
      <MarkdownRenderer source={source} />
    </DocsLayout>
  );
}
