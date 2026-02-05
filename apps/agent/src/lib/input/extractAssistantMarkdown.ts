import { Page } from "playwright";
import { Provider } from "@onescope/types";
import { MODEL_RESPONSE_SELECTORS } from "@onescope/utils";
import TurndownService from "turndown";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
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
          return turndown.turndown(html).trim();
        }
      } catch {
        continue;
      }
    }
  }

  return "";
}
