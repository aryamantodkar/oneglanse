import type { Source } from "@onescope/types";
import type { Page } from "playwright";
import { logger } from "../../../../lib/utils/logger.js";

export async function extractAIOverviewSources(page: Page): Promise<Source[]> {
	try {
		const { sources, containerFound } = await page.evaluate(() => {
			const results: any[] = [];
			const seen = new Set<string>();

			try {
				let aoContainer: HTMLElement | null = null;

				// Method 1: Find by heading text
				const headings = document.querySelectorAll(
					'h1, h2, h3, [role="heading"]',
				);
				for (const heading of headings) {
					if (heading.textContent?.toLowerCase().includes("ai overview")) {
						let current: HTMLElement | null = heading.parentElement;
						for (let i = 0; i < 8; i++) {
							if (!current) break;
							const innerText = current.innerText || "";
							if (innerText.length > 500) {
								aoContainer = current;
								break;
							}
							current = current.parentElement;
						}
						break;
					}
				}

				// Method 2: Find by generic container (if Method 1 failed)
				if (!aoContainer) {
					const allDivs = document.querySelectorAll(
						'[role="region"], main > div, [data-sokoban-container]',
					);
					for (const div of allDivs) {
						if (!(div instanceof HTMLElement)) continue;
						const text = div.innerText || "";
						if (
							text.toLowerCase().includes("ai overview") &&
							text.length > 500
						) {
							aoContainer = div;
							break;
						}
					}
				}

				if (!aoContainer) {
					return { sources: results, containerFound: false };
				}

				const linksInAO = aoContainer.querySelectorAll("a[href]");

				for (const link of linksInAO) {
					try {
						if (!(link instanceof HTMLAnchorElement)) continue;
						const url = link.href;

						// Skip Google internal links
						if (
							url.includes("google.com/search") ||
							url.includes("google.com/")
						) {
							continue;
						}

						// FIX: deduplicate on base URL (ignore #:~:text= fragment anchors)
						const key = url?.split("#")[0];
						if (!key || seen.has(key)) continue;
						seen.add(key);

						let domain: string | null = null;
						try {
							domain = new URL(url).hostname?.replace(/^www\\./, "") ?? null;
						} catch {
							domain = null;
						}

						// FIX: prefer aria-label / title attribute over raw textContent to avoid UI chrome
						let title =
							link.getAttribute("aria-label")?.trim() ||
							link.getAttribute("title")?.trim() ||
							link.textContent?.trim() ||
							"";
						if (!title) {
							title = domain || url;
						}

						let citedText = "";

						let textNode: ChildNode | null = link.previousSibling;
						while (textNode) {
							if (textNode.nodeType === Node.TEXT_NODE) {
								const text = textNode.textContent?.trim();
								if (text && text.length > 10) {
									citedText = text.substring(0, 150);
									break;
								}
							} else if (textNode instanceof HTMLElement) {
								const text = textNode.textContent?.trim();
								if (text && text.length > 10) {
									citedText = text.substring(0, 150);
									break;
								}
							}
							textNode = textNode.previousSibling;
						}

						if (!citedText) {
							const paragraph = link.closest('li, p, div[role="paragraph"]');
							if (paragraph) {
								citedText =
									paragraph.textContent?.trim().substring(0, 200) || "";
							}
						}

						if (!citedText) {
							citedText = title;
						}

						const favicon = domain
							? `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
							: null;

						results.push({
							title: title.substring(0, 200),
							cited_text: citedText,
							url: url,
							domain: domain,
							favicon: favicon,
						});
					} catch {
						// Skip malformed links silently
					}
				}

				return { sources: results, containerFound: true };
			} catch {
				return { sources: results, containerFound: false };
			}
		});

		if (!containerFound) {
			logger.warn("AI Overview container not found — no sources extracted");
		}

		logger.debug(`Extracted ${sources.length} sources from AI Overview`);
		return sources;
	} catch (err: any) {
		logger.error(`Failed to extract AI Overview sources: ${err.message}`);
		return [];
	}
}
