import type { ReactNode } from "react";
import { highlightCode } from "@/lib/code-highlighter";
import { parseMarkdown } from "@/lib/markdown-parser";
import type { MarkdownNode } from "@/lib/markdown-types";

function renderInlineCode(text: string): ReactNode[] {
  const segments = text.split(/(`[^`]+`)/g);
  return segments.map((segment, index) => {
    if (segment.startsWith("`") && segment.endsWith("`")) {
      return <code key={`code-${index}`}>{segment.slice(1, -1)}</code>;
    }
    return <span key={`text-${index}`}>{segment}</span>;
  });
}

function renderNode(node: MarkdownNode, index: number): React.JSX.Element {
  switch (node.type) {
    case "h1":
      return <h1 key={`h1-${index}`}>{node.text}</h1>;
    case "h2":
      return <h2 key={`h2-${index}`}>{node.text}</h2>;
    case "h3":
      return <h3 key={`h3-${index}`}>{node.text}</h3>;
    case "paragraph":
      return <p key={`p-${index}`}>{renderInlineCode(node.text)}</p>;
    case "list":
      return (
        <ul key={`list-${index}`}>
          {node.items.map((item) => (
            <li key={item}>{renderInlineCode(item)}</li>
          ))}
        </ul>
      );
    case "code": {
      const tokens = highlightCode(node.code);
      return (
        <pre key={`code-${index}`}>
          <code className="font-mono text-[13px]" data-language={node.language}>
            {tokens.map((token, tokenIndex) => (
              <span key={`token-${tokenIndex}`} className={token.className}>
                {token.value}
              </span>
            ))}
          </code>
        </pre>
      );
    }
  }
}

export function MarkdownRenderer({ source }: { source: string }): React.JSX.Element {
  const nodes = parseMarkdown(source);

  return (
    <article className="docs-prose" aria-label="Documentation content">
      {nodes.map((node, index) => renderNode(node, index))}
    </article>
  );
}
