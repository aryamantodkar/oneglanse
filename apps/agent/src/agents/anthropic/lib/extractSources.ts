import { Page } from "playwright";
import { findLastAssistantLocator } from "../../../lib/input/getLastAssistantText.js";
import { Source } from "@onescope/types";

export async function extractSourcesFromAnthropic(
  page: Page
): Promise<Source[]> {
  const assistant = await findLastAssistantLocator(page);
  if (!assistant) return [];

  return await assistant.evaluate((root) => {
    const results: Source[] = [];
    const seen = new Set<string>();

    const containers = root.querySelectorAll<HTMLElement>('.standard-markdown');

    for (const container of Array.from(containers)) {
      const paragraphs = container.querySelectorAll('p');

      for (const p of Array.from(paragraphs)) {
        let buffer = '';
        let lastCitedText: string | null = null;

        for (const node of Array.from(p.childNodes)) {
          if (node.nodeType === Node.TEXT_NODE) {
            if (lastCitedText) {
              buffer = '';
              lastCitedText = null;
            }
            buffer += node.textContent ?? '';
            continue;
          }

          if (
            node instanceof HTMLElement &&
            !node.querySelector('a[href^="http"]')
          ) {
            buffer += node.innerText ?? '';
            continue;
          }

          let anchor: HTMLAnchorElement | null = null;

          if (
            node.nodeType === Node.ELEMENT_NODE &&
            (node as Element).matches('a[href^="http"]')
          ) {
            anchor = node as HTMLAnchorElement;
          } else if (
            node instanceof HTMLElement
          ) {
            anchor = node.querySelector('a[href^="http"]');
          }

          if (!anchor) continue;

          const citedText: string | null =
            lastCitedText ??
            buffer.replace(/\s+/g, ' ').trim();

          if (citedText.length < 30) continue;

          lastCitedText = citedText;

          let domain: string | null = null;
          try {
            domain = new URL(anchor.href).hostname.replace(/^www\./, '');
          } catch {}

          const title =
            anchor.querySelector('span span')?.textContent?.trim() ||
            domain ||
            anchor.href;

          const key = `${anchor.href}|${citedText}`;
          if (seen.has(key)) continue;
          seen.add(key);

          results.push({
            title,
            citedText,
            url: anchor.href,
            domain,
            favicon: domain
              ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
              : null,
          });
        }
      }
    }

    return results;
  });
}