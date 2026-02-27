import type { Source } from "@oneglanse/types";
import type { Page } from "playwright";
import { SELECTORS } from "../../../../config/selectors.js";
import { buildSources, type RawSource } from "../../../../lib/extraction/sourceUtils.js";
import { logger } from "../../../../lib/utils/logger.js";

export async function extractAIOverviewSources(page: Page): Promise<Source[]> {
	try {
		const { rawSources, containerFound } = await page.evaluate((sels) => {
			const results: Array<{
				rawHref: string;
				title: string;
				citedText: string;
				imgSrc: string | null;
			}> = [];

			try {
				let aoContainer: HTMLElement | null = null;

				// Method 1: Find by heading text
				const headings = document.querySelectorAll(sels.headings);
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
					const allDivs = document.querySelectorAll(sels.containers);
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
					return { rawSources: results, containerFound: false };
				}

				const linksInAO = aoContainer.querySelectorAll(sels.anchor);

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

						const rawHref = url?.split("#")[0];
						if (!rawHref) continue;

						// Prefer aria-label / title attribute over raw textContent to avoid UI chrome
						let title =
							link.getAttribute("aria-label")?.trim() ||
							link.getAttribute("title")?.trim() ||
							link.textContent?.trim() ||
							"";
						if (!title) {
							title = rawHref;
						}

						// Walk preceding siblings for cited text context
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
							const paragraph = link.closest(sels.paragraph);
							if (paragraph) {
								citedText =
									paragraph.textContent?.trim().substring(0, 200) || "";
							}
						}

						if (!citedText) {
							citedText = title;
						}

						results.push({
							rawHref,
							title,
							citedText,
							imgSrc: null, // AI Overview source links have no favicon img element
						});
					} catch {
						// Skip malformed links silently
					}
				}

				return { rawSources: results, containerFound: true };
			} catch {
				return { rawSources: results, containerFound: false };
			}
		}, SELECTORS.googleAiOverview);

		if (!containerFound) {
			logger.warn("AI Overview container not found — no sources extracted");
		}

		// Deduplicate by URL only (original behaviour: same URL = same source regardless of title)
		const sources = buildSources(rawSources as RawSource[], (url) => url);

		logger.debug(`Extracted ${sources.length} sources from AI Overview`);
		return sources;
	} catch (err: any) {
		logger.error(`Failed to extract AI Overview sources: ${err.message}`);
		return [];
	}
}
