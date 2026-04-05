import { ExternalServiceError } from "@oneglanse/errors";
import type { Provider, SelectorProfile, Source } from "@oneglanse/types";
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
				const candidates = Array.from(
					document.querySelectorAll(
						"div, section, aside, ul, ol, [role='dialog'], [role='menu'], [role='listbox'], [role='region']",
					),
				).filter(
					(element): element is HTMLElement =>
						element instanceof HTMLElement &&
						isVisible(element) &&
						element.getBoundingClientRect().width >= 120 &&
						element.getBoundingClientRect().height >= 40,
				);

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

					const title =
						item
							.querySelector("h1,h2,h3,h4,strong,b,[title]")
							?.textContent?.trim() ||
						anchor.getAttribute("title")?.trim() ||
						anchor.textContent?.trim() ||
						url;

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

	if (!responseProfile.selectors.sourcesButton.length) {
		const inlineRawSources = await extractInlineRawSourcesFromResponse(
			page,
			responseProfile.selectors.response,
		);
		return buildSources(
			inlineRawSources,
			(url, title, citedText) => `${url}|${title}|${citedText}`,
		);
	}

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

	const mergedRawSources = rawSources;

	if (mergedRawSources.length === 0) {
		throw new ExternalServiceError(
			provider,
			"Sources button was present and opened, but no sources were extracted",
		);
	}

	return buildSources(
		mergedRawSources,
		(url, title, citedText) => `${url}|${title}|${citedText}`,
	);
}
