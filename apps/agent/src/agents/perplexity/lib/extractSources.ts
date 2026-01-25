import { Page } from "playwright";
import { Source } from "../../../types/types.js";

export async function exractSoucesFromPerplexity(page: Page): Promise<Source[]>{
    const sources = await page.evaluate(() => {
        const results: Source[] = [];
      
        const seen = new Set<string>();
      
        // Perplexity sources panel = fixed right-side container with many links
        const flyout = Array.from(document.querySelectorAll<HTMLDivElement>('div'))
          .find(d => {
            const style = getComputedStyle(d);
            return (
              style.position === 'fixed' &&
              style.right === '0px' &&
              d.querySelectorAll('a[href^="http"]').length >= 5
            );
          });
      
        if (!flyout) return results;
      
        // Each source is a full clickable card (<a>) with a favicon
        const anchors = Array.from(
          flyout.querySelectorAll<HTMLAnchorElement>('a[href^="http"]')
        ).filter(a =>
          a.querySelector('img') &&      // favicon present
          a.offsetHeight > 40            // real card, not icon/link
        );
      
        for (const a of anchors) {
          const href = a.href;
          if (!href) continue;
      
          let domain: string | null = null;
          try {
            domain = new URL(href).hostname.replace(/^www\./, '');
          } catch {}
      
          // Title: first visible, non-trivial span
          const title =
            Array.from(a.querySelectorAll('span'))
              .map(s => s.textContent?.trim() || '')
              .find(t => t.length > 20 && t.length < 200) ||
            domain ||
            href;
      
          // Description: longest readable text block
           const citedText =
            Array.from(a.querySelectorAll('div'))
            .map(d => d.textContent?.trim() || '')
            .filter(t =>
                t.length > 40 &&
                !t.includes(domain ?? '') &&     // avoid domain label
                t !== title                      // avoid headline duplication
            )
            .at(-1) || '';
      
          const favicon =
            a.querySelector('img')?.getAttribute('src') ??
            (domain
              ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
              : null);
      
          const key = `${href}|${title}`;
          if (seen.has(key)) continue;
          seen.add(key);
      
          results.push({
            title,
            citedText,
            url: href,
            domain,
            favicon
          });
        }
      
        return results;
      });

    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(300);

    return sources;
}