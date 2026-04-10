import { ExternalServiceError } from "@oneglanse/errors";
import type { Provider, Source } from "@oneglanse/types";
import { getDomain, getFaviconUrls, logger } from "@oneglanse/utils";
import type { Locator, Page } from "playwright";
import type { RawSource } from "../extraction/sourceUtils.js";
import { buildSources } from "../extraction/sourceUtils.js";
import { getSelectorProfile, waitForSelectorProfile } from "./profile.js";

async function findSourcesButtonLocator(
	page: Page,
	responseSelectors: string[],
	selectors: string[],
): Promise<{ locator: Locator; selector: string; index: number } | null> {
	const match = await page
		.evaluate(
			({
				responseSelectors: responseCandidateSelectors,
				buttonSelectors,
			}: {
				responseSelectors: string[];
				buttonSelectors: string[];
			}) => {
				type ButtonMatch = {
					selector: string;
					index: number;
					score: number;
				};

				function isVisible(element: Element | null): element is HTMLElement {
					if (!(element instanceof HTMLElement)) return false;
					if (!element.isConnected) return false;
					const style = window.getComputedStyle(element);
					if (
						style.display === "none" ||
						style.visibility === "hidden" ||
						style.opacity === "0" ||
						element.hidden
					) {
						return false;
					}
					const rect = element.getBoundingClientRect();
					return rect.width >= 8 && rect.height >= 8;
				}

				function lastVisible<T extends Element>(elements: T[]): T | null {
					for (let index = elements.length - 1; index >= 0; index -= 1) {
						const element = elements[index];
						if (element && isVisible(element)) {
							return element;
						}
					}
					return null;
				}

				function resolveLatestResponse(): HTMLElement | null {
					for (const selector of responseCandidateSelectors) {
						try {
							const response = lastVisible(
								Array.from(
									document.querySelectorAll(selector),
								) as HTMLElement[],
							);
							if (response) {
								return response;
							}
						} catch {}
					}
					return null;
				}

				function sharedAncestorScore(
					response: HTMLElement,
					button: HTMLElement,
				): number {
					let current: HTMLElement | null = button.parentElement;
					let depth = 1;
					while (current && depth <= 6) {
						if (current.contains(response)) {
							return 4_000 - depth * 150;
						}
						current = current.parentElement;
						depth += 1;
					}
					return 0;
				}

				const latestResponse = resolveLatestResponse();
				if (!latestResponse) {
					return null;
				}
				const responseRect = latestResponse.getBoundingClientRect();
				let best: ButtonMatch | null = null;

				for (const selector of buttonSelectors) {
					let matches: HTMLElement[] = [];
					try {
						matches = Array.from(document.querySelectorAll(selector)).filter(
							isVisible,
						) as HTMLElement[];
					} catch {
						continue;
					}

					for (const [index, button] of matches.entries()) {
						const rect = button.getBoundingClientRect();
						const verticalDistance = Math.abs(rect.top - responseRect.bottom);
						const insideResponse = latestResponse.contains(button);
						const nearResponse =
							rect.top >= responseRect.top - 120 &&
							rect.top <= responseRect.bottom + 240;
						let score = -verticalDistance;

						if (insideResponse) {
							score += 10_000;
						}
						if (nearResponse) {
							score += 1_000;
						}
						score += sharedAncestorScore(latestResponse, button);
						score += rect.top / 100;

						if (!best || score > best.score) {
							best = { selector, index, score };
						}
					}
				}

				return best;
			},
			{
				responseSelectors,
				buttonSelectors: selectors,
			},
		)
		.catch(() => null);

	if (!match) {
		return null;
	}

	const locator = page.locator(match.selector).nth(match.index);
	await locator.scrollIntoViewIfNeeded().catch(() => {});
	const visible = await locator.isVisible().catch(() => false);
	if (!visible) {
		return null;
	}

	return {
		locator,
		selector: match.selector,
		index: match.index,
	};
}

export function toAttributeSelector(id: string): string {
	return `[id="${id.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
}

async function resolveControlledPanelSelector(
	page: Page,
	buttonMatch: { selector: string; index: number },
): Promise<string | null> {
	const panelId = await page
		.evaluate(
			({
				selector,
				index,
			}: {
				selector: string;
				index: number;
			}) => {
				try {
					const matches = Array.from(document.querySelectorAll(selector));
					const element = matches[index];
					if (!(element instanceof HTMLElement)) {
						return null;
					}
					return (
						(
							element.getAttribute("aria-controls") ??
							element.getAttribute("aria-owns")
						)?.trim() ?? null
					);
				} catch {
					return null;
				}
			},
			buttonMatch,
		)
		.catch(() => null);
	if (!panelId) {
		return null;
	}

	return toAttributeSelector(panelId);
}

async function openSourcesPanelIfNeeded(
	page: Page,
	responseSelectors: string[],
	sourceButtonSelectors: string[],
): Promise<{
	opened: boolean;
	controlledPanelSelector: string | null;
	buttonMatch: { selector: string; index: number } | null;
}> {
	const buttonMatch = await findSourcesButtonLocator(
		page,
		responseSelectors,
		sourceButtonSelectors,
	);
	if (!buttonMatch) {
		return {
			opened: false,
			controlledPanelSelector: null,
			buttonMatch: null,
		};
	}

	await buttonMatch.locator.scrollIntoViewIfNeeded().catch(() => {});
	const controlledPanelSelector = await resolveControlledPanelSelector(
		page,
		buttonMatch,
	);
	const clicked = await buttonMatch.locator
		.click({ timeout: 3000 })
		.then(() => true)
		.catch(() => false);
	if (!clicked) {
		await buttonMatch.locator.dispatchClick().catch(() => {});
	}
	// Increased from 1500 ms: fixed-position source panels (e.g. Perplexity's
	// right-side drawer) animate in and may have lazy-loaded items. Give them
	// more time so heuristic root-finding and link extraction see the full list.
	await page.waitForTimeout(2800);
	return {
		opened: true,
		controlledPanelSelector,
		buttonMatch: {
			selector: buttonMatch.selector,
			index: buttonMatch.index,
		},
	};
}

async function closeSourcesPanelIfNeeded(
	page: Page,
	buttonMatch: { selector: string; index: number } | null,
	controlledPanelSelector: string | null,
): Promise<void> {
	if (!buttonMatch) {
		return;
	}

	const button = page.locator(buttonMatch.selector).nth(buttonMatch.index);
	const visible = await button.isVisible().catch(() => false);
	if (!visible) {
		await page.keyboard.press("Escape").catch(() => null);
		return;
	}

	const panelVisible = controlledPanelSelector
		? await page
				.locator(controlledPanelSelector)
				.first()
				.isVisible()
				.catch(() => false)
		: false;

	if (!panelVisible && !controlledPanelSelector) {
		await page.keyboard.press("Escape").catch(() => null);
		return;
	}

	const clicked = await button
		.click({ timeout: 2_000 })
		.then(() => true)
		.catch(() => false);
	if (!clicked) {
		await button.dispatchClick().catch(() => null);
	}

	if (controlledPanelSelector) {
		await page
			.waitForSelector(controlledPanelSelector, {
				state: "hidden",
				timeout: 2_500,
			})
			.catch(() => null);
	}

	await page.waitForTimeout(250).catch(() => null);
	await page.keyboard.press("Escape").catch(() => null);
}

async function extractRawSourcesWithSelectors(
	page: Page,
	sourcePanelSelectors: string[],
	sourceItemSelectors: string[],
	rootSelector?: string | null,
	context?: {
		buttonSelector?: string | null;
		buttonIndex?: number;
		responseSelectors?: string[];
	},
): Promise<RawSource[]> {
	return await page.evaluate(
		({
			panels,
			items,
			rootSelector,
			buttonSelector,
			buttonIndex,
			responseSelectors,
		}: {
			panels: string[];
			items: string[];
			rootSelector?: string | null;
			buttonSelector?: string | null;
			buttonIndex?: number;
			responseSelectors?: string[];
		}) => {
			type RawSource = {
				rawHref: string;
				title: string;
				citedText: string;
				imgSrc: string | null;
			};

			function isVisible(element: Element | null): element is HTMLElement {
				if (!(element instanceof HTMLElement)) return false;
				if (!element.isConnected) return false;
				const style = window.getComputedStyle(element);
				if (
					style.display === "none" ||
					style.visibility === "hidden" ||
					style.opacity === "0" ||
					element.hidden
				) {
					return false;
				}
				const rect = element.getBoundingClientRect();
				return rect.width >= 8 && rect.height >= 8;
			}

			function textOf(element: Element): string {
				return ((element as HTMLElement).innerText || element.textContent || "")
					.replace(/\s+/g, " ")
					.trim();
			}

			function normalizeUrl(href: string): string {
				try {
					const abs =
						new URL(href, window.location.origin).toString().split("#")[0] ?? "";
					if (!abs) return "";
					// Unwrap same-origin redirect/proxy URLs so external source links are
					// not dropped by isSameOriginAppUrl. Providers sometimes route outbound
					// links through their own redirect endpoint (e.g. /redirect?url=…).
					// When the destination is on a different host, return it directly.
					try {
						const parsed = new URL(abs);
						if (parsed.hostname === window.location.hostname) {
							for (const key of [
								"url",
								"u",
								"href",
								"target",
								"redirect_url",
								"link",
								"next",
							]) {
								const val = parsed.searchParams.get(key);
								if (!val) continue;
								try {
									const dest = new URL(val);
									if (dest.hostname !== window.location.hostname) {
										return dest.toString().split("#")[0] ?? "";
									}
								} catch {}
							}
						}
					} catch {}
					return abs;
				} catch {
					return "";
				}
			}

			function domainOf(url: string): string {
				try {
					return new URL(url).hostname.replace(/^www\./, "");
				} catch {
					return url;
				}
			}

			function isSameOriginAppUrl(url: string): boolean {
				try {
					const parsed = new URL(url, window.location.origin);
					return parsed.hostname === window.location.hostname;
				} catch {
					return false;
				}
			}

			function lastVisible<T extends Element>(elements: T[]): T | null {
				for (let index = elements.length - 1; index >= 0; index -= 1) {
					const element = elements[index];
					if (element && isVisible(element)) {
						return element;
					}
				}
				return null;
			}

			function resolveButton(): HTMLElement | null {
				if (!buttonSelector || typeof buttonIndex !== "number") {
					return null;
				}
				try {
					const matches = Array.from(
						document.querySelectorAll(buttonSelector),
					) as HTMLElement[];
					const button = matches[buttonIndex] ?? null;
					return isVisible(button) ? button : null;
				} catch {
					return null;
				}
			}

			function resolveLatestResponse(): HTMLElement | null {
				for (const selector of responseSelectors ?? []) {
					try {
						const response = lastVisible(
							Array.from(document.querySelectorAll(selector)) as HTMLElement[],
						);
						if (response) {
							return response;
						}
					} catch {}
				}
				return null;
			}

			function candidateRootScore(
				candidate: HTMLElement,
				button: HTMLElement | null,
				latestResponse: HTMLElement | null,
			): number {
				const rect = candidate.getBoundingClientRect();
				const anchorCount = Array.from(
					candidate.querySelectorAll("a[href]"),
				).filter(isVisible).length;
				if (anchorCount === 0) {
					return Number.NEGATIVE_INFINITY;
				}

				let score =
					anchorCount * 280 -
					rect.width * 0.08 -
					rect.height * 0.05 +
					textOf(candidate).length * 0.04;

				if (
					candidate.matches(
						"[role='dialog'], [role='menu'], [role='listbox'], [role='region']",
					)
				) {
					score += 450;
				}

				// Fixed-position panels (e.g. Perplexity's right-side source drawer)
				// are high-confidence source containers — boost them strongly so they
				// beat all normal-flow candidates in the heuristic scorer.
				if (window.getComputedStyle(candidate).position === "fixed") {
					score += 1_200;
				}

				if (button) {
					const buttonRect = button.getBoundingClientRect();
					const horizontalDistance =
						rect.right < buttonRect.left
							? buttonRect.left - rect.right
							: rect.left > buttonRect.right
								? rect.left - buttonRect.right
								: 0;
					const verticalDistance =
						rect.bottom < buttonRect.top
							? buttonRect.top - rect.bottom
							: rect.top > buttonRect.bottom
								? rect.top - buttonRect.bottom
								: 0;
					score -= horizontalDistance * 0.6 + verticalDistance * 0.7;
					if (
						rect.top <= buttonRect.bottom + 320 &&
						rect.bottom >= buttonRect.top - 120
					) {
						score += 320;
					}
					if (candidate.contains(button)) {
						score -= 700;
					}
				}

				if (latestResponse) {
					if (candidate === latestResponse) {
						score -= 900;
					}
					if (latestResponse.contains(candidate)) {
						score -= 500;
					}
					if (candidate.contains(latestResponse)) {
						score -= 250;
					}
				}

				return score;
			}

			function resolveHeuristicRoot(): HTMLElement | null {
				const button = resolveButton();
				const latestResponse = resolveLatestResponse();
				// Include fixed-positioned elements: providers like Perplexity render
				// the sources panel as a fixed right-side drawer that sits outside
				// the normal document flow and is not found by position-agnostic queries.
				const candidates = Array.from(
					document.querySelectorAll(
						"div, section, aside, ul, ol, [role='dialog'], [role='menu'], [role='listbox'], [role='region']",
					),
				).filter((element): element is HTMLElement => {
					if (!(element instanceof HTMLElement)) return false;
					const rect = element.getBoundingClientRect();
					// Fixed-position panels may have rect.top = 0 (full viewport height);
					// still accept them if they're within the viewport and have some size.
					const pos = window.getComputedStyle(element).position;
					if (pos === "fixed") {
						return rect.width >= 120 && rect.height >= 40 &&
							rect.right > 0 && rect.bottom > 0;
					}
					return isVisible(element) && rect.width >= 120 && rect.height >= 40;
				});

				let best: HTMLElement | null = null;
				let bestScore = Number.NEGATIVE_INFINITY;
				for (const candidate of candidates) {
					const score = candidateRootScore(candidate, button, latestResponse);
					if (score > bestScore) {
						best = candidate;
						bestScore = score;
					}
				}

				return bestScore > Number.NEGATIVE_INFINITY ? best : null;
			}

			// Resolve ALL source panel roots — providers sometimes render citations in
			// multiple containers (e.g. an inline tray + a side panel). Collect from
			// every distinct root and merge results.
			function resolveRoots(): HTMLElement[] {
				const roots: HTMLElement[] = [];
				const seen = new Set<Element>();

				// 1. aria-controls/aria-owns panel (highest confidence)
				if (rootSelector) {
					try {
						for (const el of Array.from(
							document.querySelectorAll(rootSelector),
						) as HTMLElement[]) {
							if (isVisible(el) && !seen.has(el)) {
								roots.push(el);
								seen.add(el);
							}
						}
					} catch {}
				}

				// 2. Each sourcePanel selector — may point to different containers
				for (const selector of panels) {
					try {
						for (const el of Array.from(
							document.querySelectorAll(selector),
						) as HTMLElement[]) {
							if (isVisible(el) && !seen.has(el)) {
								roots.push(el);
								seen.add(el);
							}
						}
					} catch {}
				}

				// 3. Heuristic fallback when no structured panels found
				if (roots.length === 0) {
					const heuristic = resolveHeuristicRoot();
					if (heuristic) roots.push(heuristic);
				}

				return roots;
			}

			// Lenient anchor check for items inside a scrollable panel: anchors that
			// are off-screen within the panel have height=0 from getBoundingClientRect
			// but are still reachable. Do NOT use isVisible here — only check that the
			// element is connected and not explicitly hidden. Never scroll window.
			function isConnectedAnchor(
				element: Element,
			): element is HTMLAnchorElement {
				if (!(element instanceof HTMLAnchorElement)) return false;
				if (!element.isConnected || element.hidden) return false;
				const style = window.getComputedStyle(element);
				return (
					style.display !== "none" &&
					style.visibility !== "hidden" &&
					!!element.href
				);
			}

			const roots = resolveRoots();
			if (roots.length === 0) return [];

			const seenUrls = new Set<string>();
			const results: RawSource[] = [];

			for (const root of roots) {
				const rawItems: Element[] = [];
				for (const selector of items) {
					try {
						rawItems.push(...Array.from(root.querySelectorAll(selector)));
					} catch {}
				}

				const anchorItems = Array.from(root.querySelectorAll("a[href]"))
					.filter(isConnectedAnchor)
					.map((anchor) => {
						// Only use semantic list-item containers (li, article,
						// role=listitem). Generic divs/sections are often shared
						// parent containers that hold ALL items — e.g. a flat panel
						// where 45 anchors share one parent div — which collapses the
						// whole list into a single deduplicated item and drops 44 sources.
						const container = anchor.closest(
							"article, li, [role='listitem']",
						);
						if (
							container instanceof HTMLElement &&
							container.querySelectorAll("a[href]").length <= 2
						) {
							return container;
						}
						// Container has too many anchors (shared parent) or none found:
						// use the anchor itself so every link becomes its own item.
						return anchor;
					})
					.filter(
						(element): element is HTMLElement =>
							element instanceof HTMLElement &&
							isVisible(element) &&
							textOf(element).length >= 4,
					);
				const dedupedItems = Array.from(
					new Set(
						[...rawItems, ...anchorItems].filter(
							(element): element is HTMLElement =>
								element instanceof HTMLElement && isVisible(element),
						),
					),
				);

				for (const item of dedupedItems) {
					// When item IS the anchor itself, querySelectorAll finds only
					// its descendants — the anchor itself is picked via the fallback.
					const anchors = Array.from(
						item.querySelectorAll("a[href]"),
					).filter(isConnectedAnchor);
					const anchor =
						anchors
							.sort((left, right) => textOf(right).length - textOf(left).length)
							.at(0) ?? (item instanceof HTMLAnchorElement ? item : null);
					if (!anchor?.href) continue;

					const url = normalizeUrl(anchor.href);
					if (!url || seenUrls.has(url) || isSameOriginAppUrl(url)) continue;
					seenUrls.add(url);

					// Use innerText (not textContent) for the anchor — innerText
					// preserves CSS-driven newlines, which providers use to separate a
					// short domain-label prefix from the article title on distinct lines
					// (e.g. "quera\nRoadmap for Advanced Error-Corrected Quantum Computers").
					// textContent concatenates all child text into one run with no breaks.
					const anchorInnerText =
						(anchor as HTMLElement).innerText ?? anchor.textContent ?? "";
					const anchorTitle = anchorInnerText.includes("\n")
						? (anchorInnerText
								.split("\n")
								.map((l) => l.trim())
								// Skip URL lines and bare domain/word tokens when extracting the
								// article title from multiline anchor text. Some providers render
								// source cards as a single <a> with newline-separated segments:
								//   "en.wikipedia\nhttps://…\nSpeed of light - Wikipedia\nSnippet…"
								// Require the line to contain a space (i.e. look like natural-language
								// text) AND not start with "http" so domain labels ("en.wikipedia",
								// "byjus") and raw URL lines are both excluded. This is a generic
								// heuristic — it doesn't depend on any specific provider's structure.
								.find(
									(l) =>
										l.length > 8 &&
										l.includes(" ") &&
										!l.startsWith("http"),
								) ??
							textOf(anchor))
						: textOf(anchor);

					const title =
						item
							.querySelector("h1,h2,h3,h4,strong,b,[title]")
							?.textContent?.trim() ||
						anchor.getAttribute("title")?.trim() ||
						anchorTitle ||
						url;

					const itemTextLength = textOf(item).length;
					const snippetCandidates = Array.from(
						item.querySelectorAll("p, span, div, small"),
					)
						.map((element) => textOf(element))
						.filter(
							(text) =>
								text.length > 30 &&
								text !== title &&
								!text.includes(url) &&
								// Exclude wrapper/container elements whose text spans nearly
								// the whole item — they concatenate domain label + title +
								// snippet into one string. The real snippet is a shorter child.
								text.length < itemTextLength * 0.85,
						)
						.sort((left, right) => right.length - left.length);

					// When the item is the anchor itself (no wrapping list container), child
					// element snippet extraction can fail because the snippet element's text
					// occupies ≥85 % of the anchor's full text and is filtered out above.
					// Fall back to parsing the anchor's innerText lines directly — providers
					// like Perplexity embed "domain\nURL\ntitle\nsnippet" all inside one <a>.
					const anchorSnippetFallback = (() => {
						if (!anchorInnerText.includes("\n")) return null;
						return (
							anchorInnerText
								.split("\n")
								.map((l) => l.trim())
								.find(
									(l) =>
										l.length > 30 &&
										!l.startsWith("http") &&
										l !== anchorTitle &&
										l !== title,
								) ?? null
						);
					})();

					results.push({
						rawHref: url,
						title,
						citedText: snippetCandidates[0] ?? anchorSnippetFallback ?? title,
						imgSrc:
							(item.querySelector("img") as HTMLImageElement | null)?.src ??
							null,
					});
				}
			}

			return results;
		},
		{
			panels: sourcePanelSelectors,
			items: sourceItemSelectors,
			rootSelector,
			buttonSelector: context?.buttonSelector,
			buttonIndex: context?.buttonIndex,
			responseSelectors: context?.responseSelectors,
		},
	);
}

async function setSourceRootsScrollFraction(
	page: Page,
	sourcePanelSelectors: string[],
	rootSelector?: string | null,
	fraction = 0,
): Promise<void> {
	await page
		.evaluate(
			({
				panels,
				rootSelector: controlledRootSelector,
				scrollFraction,
			}: {
				panels: string[];
				rootSelector?: string | null;
				scrollFraction: number;
			}) => {
				function isVisible(element: Element | null): element is HTMLElement {
					if (!(element instanceof HTMLElement)) return false;
					if (!element.isConnected) return false;
					const style = window.getComputedStyle(element);
					if (
						style.display === "none" ||
						style.visibility === "hidden" ||
						style.opacity === "0" ||
						element.hidden
					) {
						return false;
					}
					const rect = element.getBoundingClientRect();
					return rect.width >= 8 && rect.height >= 8;
				}

				const roots: HTMLElement[] = [];
				const seen = new Set<Element>();
				for (const selector of [controlledRootSelector ?? "", ...panels]) {
					if (!selector) continue;
					try {
						for (const match of Array.from(
							document.querySelectorAll(selector),
						) as HTMLElement[]) {
							if (!isVisible(match) || seen.has(match)) continue;
							roots.push(match);
							seen.add(match);
						}
					} catch {}
				}

				for (const root of roots) {
					// Vertical scroll — reveals items in vertically overflowing panels
					if (root.scrollHeight > root.clientHeight + 8) {
						root.scrollTop = Math.max(
							0,
							Math.round(
								(root.scrollHeight - root.clientHeight) * scrollFraction,
							),
						);
					}
					// Horizontal scroll — reveals items in carousels and horizontally
					// laid-out source grids that overflow the container to the right
					if (root.scrollWidth > root.clientWidth + 8) {
						root.scrollLeft = Math.max(
							0,
							Math.round(
								(root.scrollWidth - root.clientWidth) * scrollFraction,
							),
						);
					}
				}
			},
			{
				panels: sourcePanelSelectors,
				rootSelector,
				scrollFraction: fraction,
			},
		)
		.catch(() => {});
}

async function collectRawSourcesAcrossScrollPositions(
	page: Page,
	sourcePanelSelectors: string[],
	sourceItemSelectors: string[],
	rootSelector?: string | null,
	context?: {
		buttonSelector?: string | null;
		buttonIndex?: number;
		responseSelectors?: string[];
	},
): Promise<RawSource[]> {
	const fractions = [0, 0.5, 1];
	const merged: RawSource[] = [];
	const seen = new Set<string>();

	for (const fraction of fractions) {
		await setSourceRootsScrollFraction(
			page,
			sourcePanelSelectors,
			rootSelector,
			fraction,
		);
		await page.waitForTimeout(120);
		const batch = await extractRawSourcesWithSelectors(
			page,
			sourcePanelSelectors,
			sourceItemSelectors,
			rootSelector,
			context,
		).catch(() => []);
		for (const source of batch) {
			const key = `${source.rawHref}|${source.title}|${source.citedText}`;
			if (seen.has(key)) continue;
			seen.add(key);
			merged.push(source);
		}
	}

	return merged;
}

async function extractInlineRawSourcesFromResponse(
	page: Page,
	responseSelectors: string[],
): Promise<RawSource[]> {
	return await page.evaluate(
		({ selectors }: { selectors: string[] }) => {
			type RawSource = {
				rawHref: string;
				title: string;
				citedText: string;
				imgSrc: string | null;
			};

			function isVisible(element: Element | null): element is HTMLElement {
				if (!(element instanceof HTMLElement)) return false;
				if (!element.isConnected) return false;
				const style = window.getComputedStyle(element);
				if (
					style.display === "none" ||
					style.visibility === "hidden" ||
					style.opacity === "0" ||
					element.hidden
				) {
					return false;
				}
				const rect = element.getBoundingClientRect();
				return rect.width >= 4 && rect.height >= 4;
			}

			function textOf(element: Element): string {
				return ((element as HTMLElement).innerText || element.textContent || "")
					.replace(/\s+/g, " ")
					.trim();
			}

			function lastVisible<T extends Element>(elements: T[]): T | null {
				for (let index = elements.length - 1; index >= 0; index -= 1) {
					const element = elements[index];
					if (element && isVisible(element)) {
						return element;
					}
				}
				return null;
			}

			function resolveLatestResponse(): HTMLElement | null {
				for (const selector of selectors) {
					try {
						const response = lastVisible(
							Array.from(document.querySelectorAll(selector)) as HTMLElement[],
						);
						if (response) {
							return response;
						}
					} catch {}
				}
				return null;
			}

			function normalizeUrl(href: string): string {
				try {
					const abs =
						new URL(href, window.location.origin).toString().split("#")[0] ?? "";
					if (!abs) return "";
					// Unwrap same-origin redirect/proxy URLs so external source links are
					// not dropped by isSameOriginAppUrl. Providers sometimes route outbound
					// links through their own redirect endpoint (e.g. /redirect?url=…).
					// When the destination is on a different host, return it directly.
					try {
						const parsed = new URL(abs);
						if (parsed.hostname === window.location.hostname) {
							for (const key of [
								"url",
								"u",
								"href",
								"target",
								"redirect_url",
								"link",
								"next",
							]) {
								const val = parsed.searchParams.get(key);
								if (!val) continue;
								try {
									const dest = new URL(val);
									if (dest.hostname !== window.location.hostname) {
										return dest.toString().split("#")[0] ?? "";
									}
								} catch {}
							}
						}
					} catch {}
					return abs;
				} catch {
					return "";
				}
			}

			function domainOf(url: string): string {
				try {
					return new URL(url).hostname.replace(/^www\./, "");
				} catch {
					return url;
				}
			}

			function findCitationBlock(
				target: HTMLElement,
				response: HTMLElement,
			): HTMLElement {
				const semanticBlock = target.closest(
					"p, li, blockquote, td, th, figcaption",
				);
				if (
					semanticBlock instanceof HTMLElement &&
					response.contains(semanticBlock)
				) {
					return semanticBlock;
				}

				let current: HTMLElement | null = target.parentElement;
				while (current && current !== response) {
					if (
						["DIV", "SECTION", "ARTICLE"].includes(current.tagName) &&
						textOf(current).length >= 30
					) {
						return current;
					}
					current = current.parentElement;
				}

				return response;
			}

			function sentenceFromCitation(
				target: HTMLAnchorElement,
				response: HTMLElement,
			): string {
				const block = findCitationBlock(target, response);
				const clone = block.cloneNode(true) as HTMLElement;
				const originalAnchors = Array.from(block.querySelectorAll("a[href]"));
				const targetIndex = originalAnchors.indexOf(target);
				if (targetIndex < 0) {
					return textOf(block);
				}
				const cloneAnchors = Array.from(clone.querySelectorAll("a[href]"));
				cloneAnchors.forEach((element, index) => {
					element.replaceWith(
						document.createTextNode(index === targetIndex ? " [[CITE]] " : " "),
					);
				});

				const serialized = textOf(clone);
				if (!serialized.includes("[[CITE]]")) {
					return serialized;
				}

				const [beforeRaw = "", afterRaw = ""] = serialized.split("[[CITE]]");
				const sentenceDelimiter = /(?<=[.!?])\s+/;
				const before = beforeRaw.trim();
				const after = afterRaw.trim();
				const beforeSentence = before
					? (before.split(sentenceDelimiter).filter(Boolean).at(-1)?.trim() ??
						"")
					: "";
				if (beforeSentence.length >= 24) {
					return beforeSentence;
				}

				const afterSentence = after
					? (after.split(sentenceDelimiter).filter(Boolean)[0]?.trim() ?? "")
					: "";
				const combined = [beforeSentence, afterSentence]
					.filter(Boolean)
					.join(" ")
					.trim();
				if (combined.length >= 24) {
					return combined;
				}

				return serialized.replace("[[CITE]]", "").trim();
			}

			const response = resolveLatestResponse();
			if (!response) {
				return [];
			}

			const rawSources: RawSource[] = [];
			const seen = new Set<string>();
			const anchors = Array.from(response.querySelectorAll("a[href]")).filter(
				(element): element is HTMLAnchorElement =>
					element instanceof HTMLAnchorElement &&
					element.isConnected &&
					!!element.href &&
					isVisible(element),
			);
			for (const anchor of anchors) {
				const rawLabel = textOf(anchor).replace(/\+\d+\s*$/, "").trim();
				const url = normalizeUrl(anchor.href);
				if (!url || seen.has(url)) {
					continue;
				}

				const rawTitle =
					anchor.getAttribute("title")?.trim() || rawLabel || "";
				const title =
					rawTitle.length >= 4 && !/^\[?\d+\]?$/.test(rawTitle)
						? rawTitle
						: domainOf(url);
				const citedText = sentenceFromCitation(anchor, response) || title;
				rawSources.push({
					rawHref: url,
					title,
					citedText,
					imgSrc:
						(anchor.querySelector("img") as HTMLImageElement | null)?.src ??
						null,
				});
				seen.add(url);
			}

			return rawSources;
		},
		{ selectors: responseSelectors },
	);
}

async function extractNearbyVisibleRawSources(
	page: Page,
	context?: {
		buttonSelector?: string | null;
		buttonIndex?: number;
		responseSelectors?: string[];
	},
): Promise<RawSource[]> {
	return await page.evaluate(
		({
			buttonSelector,
			buttonIndex,
			responseSelectors,
		}: {
			buttonSelector?: string | null;
			buttonIndex?: number;
			responseSelectors?: string[];
		}) => {
			type RawSource = {
				rawHref: string;
				title: string;
				citedText: string;
				imgSrc: string | null;
			};

			function isVisible(element: Element | null): element is HTMLElement {
				if (!(element instanceof HTMLElement)) return false;
				if (!element.isConnected) return false;
				const style = window.getComputedStyle(element);
				if (
					style.display === "none" ||
					style.visibility === "hidden" ||
					style.opacity === "0" ||
					element.hidden
				) {
					return false;
				}
				const rect = element.getBoundingClientRect();
				return rect.width >= 4 && rect.height >= 4;
			}

			function textOf(element: Element | null): string {
				if (!(element instanceof HTMLElement)) return "";
				return (element.innerText || element.textContent || "")
					.replace(/\s+/g, " ")
					.trim();
			}

			function normalizeUrl(href: string): string {
				try {
					return new URL(href, window.location.origin).toString().split("#")[0] ?? "";
				} catch {
					return "";
				}
			}

			function isExternal(anchor: HTMLAnchorElement): boolean {
				try {
					return (
						new URL(anchor.href, window.location.origin).hostname !==
						window.location.hostname
					);
				} catch {
					return false;
				}
			}

			function lastVisible<T extends Element>(elements: T[]): T | null {
				for (let index = elements.length - 1; index >= 0; index -= 1) {
					const element = elements[index];
					if (element && isVisible(element)) return element;
				}
				return null;
			}

			const button = (() => {
				if (!buttonSelector || typeof buttonIndex !== "number") return null;
				try {
					const matches = Array.from(document.querySelectorAll(buttonSelector));
					const match = matches[buttonIndex];
					return match instanceof HTMLElement && isVisible(match) ? match : null;
				} catch {
					return null;
				}
			})();

			const response = (() => {
				for (const selector of responseSelectors ?? []) {
					try {
						const match = lastVisible(
							Array.from(document.querySelectorAll(selector)) as HTMLElement[],
						);
						if (match) return match;
					} catch {}
				}
				return null;
			})();

			const buttonRect = button?.getBoundingClientRect() ?? null;
			const responseRect = response?.getBoundingClientRect() ?? null;
			const seen = new Set<string>();
			const results: RawSource[] = [];

			for (const anchor of Array.from(document.querySelectorAll("a[href]"))) {
				if (!(anchor instanceof HTMLAnchorElement) || !isVisible(anchor)) continue;
				if (!isExternal(anchor)) continue;
				const rect = anchor.getBoundingClientRect();
				const nearButton =
					buttonRect &&
					rect.top >= buttonRect.top - 160 &&
					rect.bottom <= buttonRect.bottom + 720;
				const nearResponse =
					responseRect &&
					rect.top >= responseRect.top - 80 &&
					rect.bottom <= responseRect.bottom + 720;
				const inViewport =
					rect.top >= -20 && rect.bottom <= window.innerHeight + 80;
				if (!nearButton && !nearResponse && !inViewport) {
					continue;
				}

				const url = normalizeUrl(anchor.href);
				if (!url || seen.has(url)) continue;
				seen.add(url);

				const item =
					anchor.closest("article, li, [role='listitem'], div, section") ??
					anchor;
				const title =
					item.querySelector("h1,h2,h3,h4,strong,b,[title]")?.textContent?.trim() ||
					anchor.getAttribute("title")?.trim() ||
					anchor.textContent?.trim() ||
					url;
				const citedText = textOf(item) || title;
				results.push({
					rawHref: url,
					title,
					citedText,
					imgSrc:
						(item.querySelector("img") as HTMLImageElement | null)?.src ?? null,
				});
			}

			return results;
		},
		{
			buttonSelector: context?.buttonSelector,
			buttonIndex: context?.buttonIndex,
			responseSelectors: context?.responseSelectors,
		},
	);
}


export async function extractResolvedSources(
	page: Page,
	provider: Provider,
): Promise<Source[]> {
	const responseProfile = await getSelectorProfile(page, provider, "response", {
		allowModel: false,
		requiredFields: ["response"],
	}).catch(() => null);
	const responseSelectors = responseProfile?.selectors.response ?? [];
	const sourcesButtonSelectors =
		responseProfile?.selectors.sourcesButton ?? [];

	if (!sourcesButtonSelectors.length) {
		const sourceProfile =
			(await waitForSelectorProfile(page, provider, "sources", 8_000, {
				requiredFields: ["sourcePanel", "sourceItem"],
			}).catch(() => null)) ??
			(await getSelectorProfile(page, provider, "sources", {
				allowModel: false,
				requiredFields: ["sourcePanel", "sourceItem"],
			}).catch(() => null));
		const modeledInlineSources =
			sourceProfile &&
			sourceProfile.selectors.sourcePanel.length > 0 &&
			sourceProfile.selectors.sourceItem.length > 0
				? await collectRawSourcesAcrossScrollPositions(
						page,
						sourceProfile.selectors.sourcePanel,
						sourceProfile.selectors.sourceItem,
						null,
						{
							responseSelectors,
						},
					).catch(() => [])
				: [];
		if (modeledInlineSources.length > 0) {
			return buildSources(
				modeledInlineSources,
				(url, title, citedText) => `${url}|${title}|${citedText}`,
			);
		}
		const inlineRawSources =
			responseSelectors.length > 0
				? await extractInlineRawSourcesFromResponse(page, responseSelectors)
				: [];
		const nearbyVisibleRawSources = await extractNearbyVisibleRawSources(page, {
			responseSelectors,
		}).catch(() => []);
		const fallbackSources = [...inlineRawSources, ...nearbyVisibleRawSources];
		return buildSources(
			fallbackSources,
			(url, title, citedText) => `${url}|${title}|${citedText}`,
		);
	}

	logger.log(`[${provider}] opening sources panel`);
	const { opened, controlledPanelSelector, buttonMatch } =
		await openSourcesPanelIfNeeded(
			page,
			responseSelectors,
			sourcesButtonSelectors,
		);
	if (!opened) {
		throw new ExternalServiceError(
			provider,
			"Sources button was resolved but the sources panel could not be opened",
		);
	}
	logger.log(`[${provider}] sources panel opened`);
	try {
		const directRawSources = await collectRawSourcesAcrossScrollPositions(
			page,
			[],
			[],
			controlledPanelSelector,
			{
				buttonSelector: buttonMatch?.selector ?? null,
				buttonIndex: buttonMatch?.index,
				responseSelectors,
			},
		);

		const sourceProfile =
			directRawSources.length > 0
				? null
				: ((await waitForSelectorProfile(page, provider, "sources", 8_000, {
						requiredFields: ["sourcePanel", "sourceItem"],
					}).catch(() => null)) ??
					(await getSelectorProfile(page, provider, "sources", {
						allowModel: false,
					}).catch(() => null)));
		const rawSources =
			directRawSources.length > 0
				? directRawSources
				: await collectRawSourcesAcrossScrollPositions(
						page,
						sourceProfile?.selectors.sourcePanel ?? [],
						sourceProfile?.selectors.sourceItem ?? [],
						controlledPanelSelector,
						{
							buttonSelector: buttonMatch?.selector ?? null,
							buttonIndex: buttonMatch?.index,
							responseSelectors,
						},
					);

		// When a sources panel is present and yielded results, use it exclusively.
		// Providers that have a sources panel list all inline citations inside that
		// panel — extracting inline links from the response body too would duplicate
		// sources and mix panel-quality snippets with inline citation fragments.
		if (rawSources.length > 0) {
			return buildSources(
				rawSources,
				(url, title, citedText) => `${url}|${title}|${citedText}`,
			);
		}

		// Panel opened but yielded no structured sources — fall back to inline
		// extraction so the caller still gets something rather than an error.
		const inlineRawSources = await extractInlineRawSourcesFromResponse(
			page,
			responseSelectors,
		).catch(() => []);
		const nearbyVisibleRawSources = await extractNearbyVisibleRawSources(page, {
			buttonSelector: buttonMatch?.selector ?? null,
			buttonIndex: buttonMatch?.index,
			responseSelectors,
		}).catch(() => []);
		const fallbackSources = [...inlineRawSources, ...nearbyVisibleRawSources];

		if (fallbackSources.length === 0) {
			throw new ExternalServiceError(
				provider,
				"Sources button was present and opened, but no sources were extracted",
			);
		}

		return buildSources(
			fallbackSources,
			(url, title, citedText) => `${url}|${title}|${citedText}`,
		);
	} finally {
		await closeSourcesPanelIfNeeded(
			page,
			buttonMatch,
			controlledPanelSelector,
		).catch(() => null);
	}
}
