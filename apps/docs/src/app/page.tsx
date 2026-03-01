import { DocsLayout } from "@/components/docs/docs-layout";
import { MarkdownRenderer } from "@/components/docs/markdown-renderer";
import { DEFAULT_DOC_SLUG } from "@/lib/docs-index";
import { readDocBySlug } from "@/lib/docs-content";

export default async function DocsHome(): Promise<React.JSX.Element> {
  const source = await readDocBySlug(DEFAULT_DOC_SLUG);

  return (
    <DocsLayout activeSlug={DEFAULT_DOC_SLUG}>
      <MarkdownRenderer source={source} />
    </DocsLayout>
  );
}
