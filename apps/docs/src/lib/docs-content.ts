import { notFound } from "next/navigation";
import path from "node:path";
import { promises as fs } from "node:fs";
import { DOC_SECTIONS } from "@/lib/docs-index";

const CONTENT_DIR = path.join(process.cwd(), "src", "content", "docs");

export async function readDocBySlug(slug: string): Promise<string> {
  const section = DOC_SECTIONS.find((entry) => entry.slug === slug);
  if (!section) {
    notFound();
  }

  const contentPath = path.join(CONTENT_DIR, `${slug}.md`);
  return fs.readFile(contentPath, "utf-8");
}
