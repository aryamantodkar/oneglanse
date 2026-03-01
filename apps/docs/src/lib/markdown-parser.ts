import type { MarkdownNode } from "@/lib/markdown-types";

export function parseMarkdown(source: string): MarkdownNode[] {
  const lines = source.split("\n");
  const nodes: MarkdownNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]?.trimEnd() ?? "";

    if (!line.trim()) {
      index++;
      continue;
    }

    if (line.startsWith("```")) {
      const language = line.replace("```", "").trim() || "text";
      const codeLines: string[] = [];
      index++;

      while (index < lines.length && !(lines[index] ?? "").startsWith("```")) {
        codeLines.push(lines[index] ?? "");
        index++;
      }

      index++;
      nodes.push({ type: "code", language, code: codeLines.join("\n") });
      continue;
    }

    if (line.startsWith("### ")) {
      nodes.push({ type: "h3", text: line.slice(4) });
      index++;
      continue;
    }

    if (line.startsWith("## ")) {
      nodes.push({ type: "h2", text: line.slice(3) });
      index++;
      continue;
    }

    if (line.startsWith("# ")) {
      nodes.push({ type: "h1", text: line.slice(2) });
      index++;
      continue;
    }

    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (index < lines.length) {
        const listLine = (lines[index] ?? "").trim();
        if (!listLine.startsWith("- ")) break;
        items.push(listLine.slice(2));
        index++;
      }
      nodes.push({ type: "list", items });
      continue;
    }

    const paragraphLines: string[] = [line];
    index++;

    while (index < lines.length) {
      const nextLine = lines[index] ?? "";
      const trimmed = nextLine.trim();
      const isBoundary =
        !trimmed ||
        trimmed.startsWith("#") ||
        trimmed.startsWith("- ") ||
        trimmed.startsWith("```");

      if (isBoundary) break;
      paragraphLines.push(trimmed);
      index++;
    }

    nodes.push({ type: "paragraph", text: paragraphLines.join(" ") });
  }

  return nodes;
}
