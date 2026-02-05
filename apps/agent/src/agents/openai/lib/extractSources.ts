import { Page, Locator } from "playwright";
import { Source } from "@onescope/types";

export async function exractSoucesFromOpenai(page: Page, sourcesButton: Locator): Promise<Source[]>{
    const sources = await page.evaluate(() => {  
        const results: Source[] = [];
        const seen = new Set<string>();
      
        const flyout =
            // ChatGPT
            document.querySelector('div[class*="threadFlyOut"]') ||
            document.querySelector('aside') ||

            // Claude / generic dialogs
            Array.from(document.querySelectorAll('[role="dialog"]'))
            .find(d => d.querySelector('a[href^="http"]')) ||

            // Perplexity
            document.querySelector('[data-testid*="sources"]') ||
            document.querySelector('[class*="sources"]') ||
            document.querySelector('[class*="citation"]') ||

            // Last-resort fallback (panel already open)
            Array.from(document.querySelectorAll('div'))
            .find(d =>
                d.querySelectorAll('a[href^="http"]').length >= 2 &&
                d.offsetHeight > 100
            );

        if (!flyout) return results;
      
        const headers = Array.from(flyout.querySelectorAll("li"));
      
        for (const header of headers) {
            const label = header.textContent?.trim().toLowerCase();
            if (label !== "citations" && label !== "more") continue;
        
            const ul = header.nextElementSibling;
            if (!(ul instanceof HTMLUListElement)) continue;
        
            const anchors = ul.querySelectorAll<HTMLAnchorElement>("a[href^='http']");
        
            for (const a of Array.from(anchors)) {
              let href = a.getAttribute("href");
              if (!href) continue;
        
              try {
                href = new URL(href, location.origin).toString();
              } catch {
                continue;
              }
        
              const domain = (() => {
                try {
                  return new URL(href).hostname.replace(/^www\./, "");
                } catch {
                  return null;
                }
              })();
        
              const blocks = Array.from(a.children)
                .filter(el => el instanceof HTMLElement) as HTMLElement[];
        
              const title =
                blocks[1]?.textContent?.trim() ||
                domain ||
                href;
        
              const citedText =
                blocks[2]?.textContent?.trim() || "";
        
              const favicon =
                a.querySelector("img")?.getAttribute("src") ??
                (domain
                  ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
                  : null);
        
              const key = `${href}|${title}|${citedText}`;
              if (seen.has(key)) continue;
              seen.add(key);
        
              results.push({
                title,
                cited_text: citedText,
                url: href,
                domain,
                favicon
              });
            }
          }
      
        return results;
      });

    const handle = await sourcesButton.elementHandle();
    if (!handle) return [];

    await page.evaluate((el) => {
        if (el instanceof HTMLElement) {
            el.dispatchEvent(
                new MouseEvent("click", {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    view: window,
                })
            );
        }
    }, handle);

    await page.waitForTimeout(300);

    return sources;
}
