import { Page } from "playwright";
import { Provider } from "@onescope/types";
import { MODEL_RESPONSE_SELECTORS } from "@onescope/utils";
import TurndownService from "turndown";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  br: "\n",
});

// Ensure paragraphs have proper spacing
turndown.addRule("paragraph", {
  filter: "p",
  replacement(content) {
    return "\n\n" + content + "\n\n";
  },
});

// Preserve div blocks as paragraphs
turndown.addRule("div", {
  filter: "div",
  replacement(content) {
    return "\n\n" + content.trim() + "\n\n";
  },
});

// Headings with proper spacing
turndown.addRule("heading", {
  filter: ["h1", "h2", "h3", "h4", "h5", "h6"],
  replacement(content, node) {
    const level = Number(node.nodeName.charAt(1));
    return "\n\n" + "#".repeat(level) + " " + content + "\n\n";
  },
});

// Lists with proper spacing
turndown.addRule("list", {
  filter: ["ul", "ol"],
  replacement(content, node) {
    const parent = node.parentNode;
    // Don't add extra spacing for nested lists
    if (parent && (parent.nodeName === "LI" || parent.nodeName === "UL" || parent.nodeName === "OL")) {
      return "\n" + content;
    }
    return "\n\n" + content + "\n\n";
  },
});

turndown.addRule("table", {
  filter: "table",
  replacement(_content, node) {
    const table = node as HTMLTableElement;
    const rows = Array.from(table.querySelectorAll("tr"));
    if (rows.length === 0) return "";

    const result: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const cells = Array.from(rows[i]!.querySelectorAll("th, td"));
      const line = cells.map((c) => (c.textContent ?? "").trim()).join(" | ");
      result.push(`| ${line} |`);

      if (i === 0) {
        result.push(`| ${cells.map(() => "---").join(" | ")} |`);
      }
    }

    return "\n\n" + result.join("\n") + "\n\n";
  },
});

export async function extractAssistantMarkdown(
  page: Page,
  provider: Provider
): Promise<string> {
  for (const selector of MODEL_RESPONSE_SELECTORS) {
    const nodes = page.locator(selector);
    const count = await nodes.count();
    if (count === 0) continue;

    for (let i = count - 1; i >= 0; i--) {
      const el = nodes.nth(i);

      try {
        if (!(await el.isVisible())) continue;

        const html = await el.evaluate(
          (root, provider) => {
            if (!(root instanceof HTMLElement)) return "";

            if (provider === "anthropic") {
              const blocks = Array.from(
                root.querySelectorAll<HTMLElement>(".standard-markdown")
              );

              const visibleBlocks = blocks.filter((block) => {
                let parent = block.parentElement;
                while (parent && parent !== root) {
                  const style = window.getComputedStyle(parent);

                  if (
                    style.opacity === "0" ||
                    style.height === "0px" ||
                    style.display === "none" ||
                    parent.classList.contains("overflow-hidden") &&
                    parent.style.height === "0px"
                  ) {
                    return false;
                  }

                  parent = parent.parentElement;
                }
                return true;
              });

              return visibleBlocks
                .map((b) => b.innerHTML?.trim() || "")
                .filter(Boolean)
                .join("<br><br>");
            }

            return root.innerHTML?.trim() || "";
          },
          provider
        );

        if (html.length > 0) {
          // Convert and normalize multiple newlines to double newlines
          const markdown = turndown.turndown(html);
          return markdown.replace(/\n{3,}/g, "\n\n").trim();
        }
      } catch {
        continue;
      }
    }
  }

  return "";
}
