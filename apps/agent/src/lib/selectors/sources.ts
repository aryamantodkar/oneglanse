import { ExternalServiceError } from "@oneglanse/errors";
import type { Provider, SelectorProfile, Source } from "@oneglanse/types";
import { getDomain, getFaviconUrls, logger } from "@oneglanse/utils";
import type { Locator, Page } from "playwright";
import type { RawSource } from "../extraction/sourceUtils.js";
import { buildSources } from "../extraction/sourceUtils.js";
import {
	getSelectorProfile,
	invalidateSelectorProfileForPage,
	waitForSelectorProfile,
} from "./profile.js";

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
	await page.waitForTimeout(1500);
	return {
		opened: true,
		controlledPanelSelector,
		buttonMatch: {
			selector: buttonMatch.selector,
			index: buttonMatch.index,
		},
	};
}

async function resolveResponseProfileForSources(
	page: Page,
	provider: Provider,
): Promise<SelectorProfile | null> {
	const baseProfile = await getSelectorProfile(page, provider, "response", {
		allowModel: false,
		requiredFields: ["response"],
	}).catch(() => null);

	if (!baseProfile) {
		return null;
	}

	if (baseProfile.selectors.sourcesButton.length > 0) {
		return baseProfile;
	}

	return (
		(await getSelectorProfile(page, provider, "response", {
			forceRefresh: true,
			requiredFields: ["response", "sourcesButton"],
		}).catch(() => null)) ?? baseProfile
	);
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

				// Collect candidates from two passes so we don't miss custom elements
				// (e.g. <context-sidebar>, <chat-sources>, web-component tags) that
				// contain anchor lists but don't match any standard HTML element name.
				//
				// Pass 1 — standard semantic elements (fast path)
				const semanticCandidates = Array.from(
					document.querySelectorAll(
						"div, section, aside, ul, ol, [role='dialog'], [role='menu'], [role='listbox'], [role='region']",
					),
				) as HTMLElement[];

				// Pass 2 — any visible element with ≥2 anchor descendants that was not
				// already covered by pass 1 (catches custom elements / web components)
				const allWithAnchors = Array.from(document.querySelectorAll("*")).filter(
					(el): el is HTMLElement =>
						el instanceof HTMLElement &&
						!semanticCandidates.includes(el) &&
						el.querySelectorAll("a[href]").length >= 2,
				);

				const seen = new Set<HTMLElement>();
				const candidates: HTMLElement[] = [];
				for (const el of [...semanticCandidates, ...allWithAnchors]) {
					if (
						!(el instanceof HTMLElement) ||
						seen.has(el) ||
						!isVisible(el) ||
						el.getBoundingClientRect().width < 120 ||
						el.getBoundingClientRect().height < 40
					)
						continue;
					seen.add(el);
					candidates.push(el);
				}

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

			// Extract the best title from a source item element. Tries progressively
			// looser heuristics so that any card structure — heading-based, plain
			// div/span, or anchor-only — is handled correctly.
			function extractBestTitle(
				item: Element,
				anchor: HTMLAnchorElement,
				itemUrl: string,
			): string {
				// 1. Semantic heading / strong / bold
				const semantic = item.querySelector("h1,h2,h3,h4,h5,h6,strong,b");
				const semanticText = semantic?.textContent?.trim();
				if (semanticText && semanticText.length >= 3) return semanticText;

				// 2. [title] attribute on any descendant
				const withTitle = item.querySelector("[title]");
				const titleAttr = withTitle?.getAttribute("title")?.trim();
				if (titleAttr && titleAttr.length >= 3) return titleAttr;

				// 3. Anchor title attribute
				const anchorTitleAttr = anchor.getAttribute("title")?.trim();
				if (anchorTitleAttr && anchorTitleAttr.length >= 3)
					return anchorTitleAttr;

				// 4. Best leaf text node: short-ish, has at least one space (i.e. words,
				//    not a bare domain), not a URL, not the item's own hostname.
				let domain = "";
				try {
					domain = new URL(itemUrl).hostname
						.replace(/^www\./, "")
						.toLowerCase();
				} catch {}

				let bestText = "";
				let bestScore = -1;
				const leafCandidates = Array.from(
					item.querySelectorAll("span, div, p, cite, li"),
				);
				for (const el of leafCandidates) {
					if (!isVisible(el)) continue;
					// Skip elements that contain block-level descendants (not leaf-ish)
					const hasBlockChild = Array.from(el.children).some((child) =>
						["DIV", "P", "UL", "OL", "TABLE", "SECTION", "ARTICLE"].includes(
							child.tagName,
						),
					);
					if (hasBlockChild) continue;

					const text = textOf(el);
					if (text.length < 8 || text.length > 200) continue;
					if (text.includes("://") || /^https?:/i.test(text)) continue;
					if (domain && text.toLowerCase().includes(domain)) continue;

					// Prefer texts with spaces (multiple words) and moderate length
					const hasSpaces = /\s/.test(text);
					const score =
						(hasSpaces ? 100 : 0) + (text.length <= 100 ? 40 : 0) - text.length * 0.1;

					if (score > bestScore) {
						bestScore = score;
						bestText = text;
					}
				}
				if (bestText) return bestText;

				// 5. Fallback: anchor text (if not too long), else URL
				const anchorText = anchor.textContent?.trim() ?? "";
				return anchorText.length > 0 && anchorText.length <= 200
					? anchorText
					: itemUrl;
			}

			const roots = resolveRoots();
			if (roots.length === 0) return [];

			const seenUrls = new Set<string>();
			const results: RawSource[] = [];

			for (const root of roots) {
				// Scroll the panel itself to the bottom to reveal any lazily-rendered
				// or off-screen items. This touches only the panel element's scrollTop —
				// it never calls window.scrollTo and does not move the main page.
				root.scrollTop = root.scrollHeight;

				const rawItems: Element[] = [];
				for (const selector of items) {
					try {
						rawItems.push(...Array.from(root.querySelectorAll(selector)));
					} catch {}
				}

				let dedupedItems = Array.from(new Set(rawItems)).filter(isVisible);
				if (dedupedItems.length <= 1) {
					const anchorItems = Array.from(
						root.querySelectorAll("a[href]"),
					).filter(isConnectedAnchor);
					if (anchorItems.length > dedupedItems.length) {
						dedupedItems = anchorItems;
					}
				}

				for (const item of dedupedItems) {
					const anchor =
						lastVisible(
							Array.from(
								item.querySelectorAll("a[href]"),
							) as HTMLAnchorElement[],
						) || (item instanceof HTMLAnchorElement ? item : null);
					if (!anchor?.href) continue;

					let url = "";
					try {
						url =
							new URL(anchor.href, window.location.origin)
								.toString()
								.split("#")[0] || "";
					} catch {
						continue;
					}
					if (!url || seenUrls.has(url)) continue;
					seenUrls.add(url);

					const title = extractBestTitle(item, anchor, url);

					const snippetCandidates = Array.from(
						item.querySelectorAll("p, span, div, small"),
					)
						.map((element) => textOf(element))
						.filter(
							(text) =>
								text.length > 30 && text !== title && !text.includes(url),
						)
						.sort((left, right) => right.length - left.length);

					results.push({
						rawHref: url,
						title,
						citedText: snippetCandidates[0] ?? title,
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
					return (
						new URL(href, window.location.origin).toString().split("#")[0] ?? ""
					);
				} catch {
					return "";
				}
			}

			function findCitationBlock(
				anchor: HTMLAnchorElement,
				response: HTMLElement,
			): HTMLElement {
				const semanticBlock = anchor.closest(
					"p, li, blockquote, td, th, figcaption",
				);
				if (
					semanticBlock instanceof HTMLElement &&
					response.contains(semanticBlock)
				) {
					return semanticBlock;
				}

				let current: HTMLElement | null = anchor.parentElement;
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
				anchor: HTMLAnchorElement,
				response: HTMLElement,
			): string {
				const block = findCitationBlock(anchor, response);
				const originalAnchors = Array.from(block.querySelectorAll("a[href]"));
				const targetIndex = originalAnchors.indexOf(anchor);
				if (targetIndex < 0) {
					return textOf(block);
				}

				const clone = block.cloneNode(true) as HTMLElement;
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
				const url = normalizeUrl(anchor.href);
				if (!url || seen.has(url)) {
					continue;
				}

				const title =
					anchor.getAttribute("title")?.trim() || textOf(anchor) || url;
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

function mergeRawSources(
	primary: RawSource[],
	inline: RawSource[],
): RawSource[] {
	const inlineByUrl = new Map<string, RawSource>();
	for (const source of inline) {
		const url = source.rawHref.replace(/#.*$/, "");
		if (url) {
			inlineByUrl.set(url, source);
		}
	}

	const merged: RawSource[] = primary.map((source) => {
		const inlineMatch = inlineByUrl.get(source.rawHref.replace(/#.*$/, ""));
		if (!inlineMatch) {
			return source;
		}

		const citedText =
			source.citedText &&
			source.citedText !== source.title &&
			source.citedText.length >= 24
				? source.citedText
				: inlineMatch.citedText;
		const title =
			source.title && source.title !== source.rawHref
				? source.title
				: inlineMatch.title;

		return {
			...source,
			title,
			citedText,
			imgSrc: source.imgSrc ?? inlineMatch.imgSrc,
		};
	});

	for (const source of inline) {
		const url = source.rawHref.replace(/#.*$/, "");
		if (
			!url ||
			merged.some((item) => item.rawHref.replace(/#.*$/, "") === url)
		) {
			continue;
		}
		merged.push(source);
	}

	return merged;
}

// After a sources panel is opened, click any "show more / view more / see all"
// button that appears inside or near the panel to reveal hidden items.
// This is completely generic — it matches any button/link whose accessible
// text contains a well-known "expand" phrase, regardless of provider.
async function expandSourcesPanel(page: Page): Promise<void> {
	await page
		.evaluate(() => {
			const expandPattern =
				/show\s+more|view\s+more|see\s+more|load\s+more|show\s+all|see\s+all|view\s+all|\+\s*\d+\s+more/i;

			// Candidate interactive elements — buttons and same-origin links only.
			// Exclude anchor elements whose href navigates to a different page (e.g.
			// "Show all results" links on search-result pages) to avoid leaving the
			// current page unexpectedly.
			const candidates = Array.from(
				document.querySelectorAll("button, a[role='button'], [role='button']"),
			) as HTMLElement[];

			for (const el of candidates) {
				if (el.hidden) continue;
				const style = window.getComputedStyle(el);
				if (
					style.display === "none" ||
					style.visibility === "hidden" ||
					style.opacity === "0"
				)
					continue;
				const rect = el.getBoundingClientRect();
				if (rect.width < 8 || rect.height < 8) continue;

				// Skip anchor elements that navigate away from the current page
				if (el.tagName === "A") {
					const href = (el as HTMLAnchorElement).href;
					if (
						href &&
						href !== window.location.href &&
						!href.startsWith(window.location.origin + window.location.pathname)
					)
						continue;
				}

				const label = (
					el.getAttribute("aria-label") ||
					el.textContent ||
					""
				).trim();
				if (expandPattern.test(label)) {
					el.click();
					break; // click at most one expand button per call
				}
			}
		}, undefined)
		.catch(() => {});

	// Brief pause for any newly-loaded items to render
	await page.waitForTimeout(1200);
}

export async function extractResolvedSources(
	page: Page,
	provider: Provider,
): Promise<Source[]> {
	const responseProfile = await resolveResponseProfileForSources(
		page,
		provider,
	);
	if (!responseProfile) {
		return [];
	}

	// ── Path A: No sources button ────────────────────────────────────────────
	// The sources panel may be permanently visible (e.g. a side-column that
	// requires no click) OR citations may be purely inline.
	// Try panel extraction first; fall back to inline only if that yields nothing.
	if (!responseProfile.selectors.sourcesButton.length) {
		// Expand any "show more" controls that may be visible even without a button
		// click (e.g. AI Overview's "Show all related links" that expands in-place).
		await expandSourcesPanel(page);

		// Check for a cached sources profile — covers providers where the panel is
		// always visible and was identified in a previous agent run.
		const cachedSourcesProfile = await getSelectorProfile(
			page,
			provider,
			"sources",
			{ allowModel: false },
		).catch(() => null);

		if (cachedSourcesProfile?.selectors.sourcePanel.length) {
			const panelRawSources = await extractRawSourcesWithSelectors(
				page,
				cachedSourcesProfile.selectors.sourcePanel,
				cachedSourcesProfile.selectors.sourceItem,
				null,
				{ responseSelectors: responseProfile.selectors.response },
			);
			if (panelRawSources.length > 0) {
				logger.log(
					`[${provider}] extracted ${panelRawSources.length} sources from always-visible panel`,
				);
				return buildSources(
					panelRawSources,
					(url, title, citedText) => `${url}|${title}|${citedText}`,
				);
			}
		}

		// No cached panel profile — try the sources stage model to detect an
		// always-visible panel (e.g. first encounter with a provider like AI Overview).
		const freshSourcesProfile = await waitForSelectorProfile(
			page,
			provider,
			"sources",
			6_000,
			{ requiredFields: ["sourcePanel"] },
		).catch(() => null);

		if (freshSourcesProfile?.selectors.sourcePanel.length) {
			const panelRawSources = await extractRawSourcesWithSelectors(
				page,
				freshSourcesProfile.selectors.sourcePanel,
				freshSourcesProfile.selectors.sourceItem,
				null,
				{ responseSelectors: responseProfile.selectors.response },
			);
			if (panelRawSources.length > 0) {
				logger.log(
					`[${provider}] extracted ${panelRawSources.length} sources from always-visible panel (fresh profile)`,
				);
				return buildSources(
					panelRawSources,
					(url, title, citedText) => `${url}|${title}|${citedText}`,
				);
			}
		}

		// No panel found via cached or fresh sources profile. The LLM may have
		// missed a sourcesButton when the response profile was first built — e.g. a
		// tab-switcher, toggle, or button that only becomes visible after streaming
		// ends. Force-refresh the response profile so the LLM re-examines the
		// current DOM. If it detects a sourcesButton this time, open the panel and
		// extract sources (same as Path B). This approach is fully generic — the LLM
		// decides what the button is; no DOM structure is assumed in code.
		const retryResponseProfile = await getSelectorProfile(
			page,
			provider,
			"response",
			{ forceRefresh: true },
		).catch(() => null);

		if (retryResponseProfile?.selectors.sourcesButton.length) {
			logger.log(
				`[${provider}] LLM re-resolution detected sourcesButton — retrying via panel extraction`,
			);
			const retryOpen = await openSourcesPanelIfNeeded(
				page,
				retryResponseProfile.selectors.response,
				retryResponseProfile.selectors.sourcesButton,
			);
			if (retryOpen.opened) {
				await expandSourcesPanel(page);
				const retryDirectRaw = await extractRawSourcesWithSelectors(
					page,
					[],
					[],
					retryOpen.controlledPanelSelector,
					{
						buttonSelector: retryOpen.buttonMatch?.selector ?? null,
						buttonIndex: retryOpen.buttonMatch?.index,
						responseSelectors: retryResponseProfile.selectors.response,
					},
				);
				const retrySourceProfile =
					retryDirectRaw.length > 0
						? null
						: ((await waitForSelectorProfile(page, provider, "sources", 8_000, {
								requiredFields: ["sourcePanel", "sourceItem"],
							}).catch(() => null)) ??
							(await getSelectorProfile(page, provider, "sources", {
								allowModel: false,
							}).catch(() => null)));
				const retryRaw =
					retryDirectRaw.length > 0
						? retryDirectRaw
						: await extractRawSourcesWithSelectors(
								page,
								retrySourceProfile?.selectors.sourcePanel ?? [],
								retrySourceProfile?.selectors.sourceItem ?? [],
								retryOpen.controlledPanelSelector,
								{
									buttonSelector: retryOpen.buttonMatch?.selector ?? null,
									buttonIndex: retryOpen.buttonMatch?.index,
									responseSelectors: retryResponseProfile.selectors.response,
								},
							);
				if (retryRaw.length > 0) {
					logger.log(
						`[${provider}] extracted ${retryRaw.length} sources via LLM re-resolution`,
					);
					return buildSources(
						retryRaw,
						(url, title, citedText) => `${url}|${title}|${citedText}`,
					);
				}
			}
		}

		// Final fallback: inline extraction (providers like Claude.ai with no sources)
		const inlineRawSources = await extractInlineRawSourcesFromResponse(
			page,
			responseProfile.selectors.response,
		);
		return buildSources(
			inlineRawSources,
			(url, title, citedText) => `${url}|${title}|${citedText}`,
		);
	}

	// ── Path B: Has sources button — click it, then extract ──────────────────
	logger.log(`[${provider}] opening sources panel`);
	const { opened, controlledPanelSelector, buttonMatch } =
		await openSourcesPanelIfNeeded(
			page,
			responseProfile.selectors.response,
			responseProfile.selectors.sourcesButton,
		);
	if (!opened) {
		throw new ExternalServiceError(
			provider,
			"Sources button was resolved but the sources panel could not be opened",
		);
	}
	logger.log(`[${provider}] sources panel opened`);

	// Expand any "show more / view more" button inside the panel before extracting
	await expandSourcesPanel(page);

	const directRawSources = await extractRawSourcesWithSelectors(
		page,
		[],
		[],
		controlledPanelSelector,
		{
			buttonSelector: buttonMatch?.selector ?? null,
			buttonIndex: buttonMatch?.index,
			responseSelectors: responseProfile.selectors.response,
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
			: await extractRawSourcesWithSelectors(
					page,
					sourceProfile?.selectors.sourcePanel ?? [],
					sourceProfile?.selectors.sourceItem ?? [],
					controlledPanelSelector,
					{
						buttonSelector: buttonMatch?.selector ?? null,
						buttonIndex: buttonMatch?.index,
						responseSelectors: responseProfile.selectors.response,
					},
				);

	if (rawSources.length === 0) {
		// The button opened but yielded no sources — the cached response profile is
		// likely stale (UI changed after the profile was stored). Invalidate it so
		// the next run triggers a fresh LLM re-detection. Also attempt one recovery
		// scan with a fresh sources-stage profile before giving up.
		await invalidateSelectorProfileForPage(page, provider, "response");
		const recoveryProfile = await getSelectorProfile(page, provider, "sources", {
			forceRefresh: true,
			requiredFields: ["sourcePanel"],
		}).catch(() => null);
		const recoveryRaw = await extractRawSourcesWithSelectors(
			page,
			recoveryProfile?.selectors.sourcePanel ?? [],
			recoveryProfile?.selectors.sourceItem ?? [],
			controlledPanelSelector,
			{
				buttonSelector: buttonMatch?.selector ?? null,
				buttonIndex: buttonMatch?.index,
				responseSelectors: responseProfile.selectors.response,
			},
		);
		if (recoveryRaw.length > 0) {
			logger.log(
				`[${provider}] recovered ${recoveryRaw.length} sources after profile invalidation`,
			);
			return buildSources(
				recoveryRaw,
				(url, title, citedText) => `${url}|${title}|${citedText}`,
			);
		}
		throw new ExternalServiceError(
			provider,
			"Sources button was present and opened, but no sources were extracted",
		);
	}

	return buildSources(
		rawSources,
		(url, title, citedText) => `${url}|${title}|${citedText}`,
	);
}
