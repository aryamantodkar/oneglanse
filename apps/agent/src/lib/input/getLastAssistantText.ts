import { Locator, Page } from "playwright";
import { Provider } from "@onescope/types";
import { MODEL_RESPONSE_SELECTORS, RESPONSE_GENERATION_SELECTORS } from "@onescope/utils";
import TurndownService from "turndown";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

// Preserve table formatting
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

      // Add separator after header row
      if (i === 0) {
        result.push(`| ${cells.map(() => "---").join(" | ")} |`);
      }
    }

    return "\n\n" + result.join("\n") + "\n\n";
  },
});

function htmlToMarkdown(html: string): string {
  return turndown.turndown(html).trim();
}

export async function getLastAssistantText(
  page: Page,
  provider: Provider,
  fetchingResponses: Boolean = false
): Promise<string> {
  for (const selector of MODEL_RESPONSE_SELECTORS) {
    const nodes = page.locator(selector);
    const count = await nodes.count();
    if (count === 0) continue;

    for (let i = count - 1; i >= 0; i--) {
      const el = nodes.nth(i);

      try {
        if (!(await el.isVisible())) continue;

        let html: string = "";

        if(!fetchingResponses){
          html = await el.evaluate(el => {
            if (!(el instanceof HTMLElement)) return "";
            return el.innerHTML?.trim() || "";
          });
        }
        else{
          html = await el.evaluate(
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
        }

        if (html.length > 0) return htmlToMarkdown(html);
      } catch {
        continue;
      }
    }
  }

  return "";
}

export async function isGenerating(page: Page): Promise<boolean> {
  for (const selector of RESPONSE_GENERATION_SELECTORS) {
    if (await page.locator(selector).isVisible().catch(() => false)) {
      return true;
    }
  }
  return false;
}

export async function findLastAssistantLocator(
  page: Page
): Promise<Locator | null> {
  for (const selector of MODEL_RESPONSE_SELECTORS) {
    const locator = page.locator(selector);
    if (await locator.count() === 0) continue;
    return locator.last();
  }
  return null;
}

export async function findLastAssistantBox(
  page: Page
) {
  const locator = await findLastAssistantLocator(page);
  return locator ? await locator.boundingBox() : null;
}
