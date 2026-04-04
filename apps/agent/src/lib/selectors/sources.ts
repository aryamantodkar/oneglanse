import type { Provider, SelectorProfile, Source } from "@oneglanse/types";
import { ExternalServiceError } from "@oneglanse/errors";
import { getDomain, getFaviconUrls, logger } from "@oneglanse/utils";
import type { Locator, Page } from "playwright";
import type { RawSource } from "../extraction/sourceUtils.js";
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
): Promise<{ opened: boolean; controlledPanelSelector: string | null }> {
	const buttonMatch = await findSourcesButtonLocator(
		page,
		responseSelectors,
		sourceButtonSelectors,
	);
	if (!buttonMatch) {
		return {
			opened: false,
			controlledPanelSelector: null,
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
): Promise<RawSource[]> {
	return await page.evaluate(
		({
			panels,
			items,
			rootSelector,
		}: {
			panels: string[];
			items: string[];
			rootSelector?: string | null;
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

			function resolveRoot(): HTMLElement | null {
				if (rootSelector) {
					try {
						const controlledPanel = lastVisible(
							Array.from(
								document.querySelectorAll(rootSelector),
							) as HTMLElement[],
						);
						if (controlledPanel) {
							return controlledPanel;
						}
					} catch {}
				}

				for (const selector of panels) {
					try {
						const panel = lastVisible(
							Array.from(document.querySelectorAll(selector)) as HTMLElement[],
						);
						if (panel) {
							return panel;
						}
					} catch {}
				}
				// Do NOT fall back to document — querying the whole page with
				// sourceItem selectors picks up wrong elements (nav links, footers,
				// search result cards). Return null so the caller returns [] instead.
				return null;
			}

			const root = resolveRoot();
			if (!root) return [];
			const rawItems: Element[] = [];
			for (const selector of items) {
				try {
					rawItems.push(...Array.from(root.querySelectorAll(selector)));
				} catch {}
			}

			let dedupedItems = Array.from(new Set(rawItems)).filter(isVisible);
			if (dedupedItems.length <= 1) {
				const anchorItems = Array.from(root.querySelectorAll("a[href]")).filter(
					isVisible,
				);
				if (anchorItems.length > dedupedItems.length) {
					dedupedItems = anchorItems;
				}
			}
			const results: RawSource[] = [];

			for (const item of dedupedItems) {
				const anchor =
					lastVisible(
						Array.from(item.querySelectorAll("a[href]")) as HTMLAnchorElement[],
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
				if (!url) continue;

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
						(text) => text.length > 30 && text !== title && !text.includes(url),
					)
					.sort((left, right) => right.length - left.length);

				results.push({
					rawHref: url,
					title,
					citedText: snippetCandidates[0] ?? title,
					imgSrc:
						(item.querySelector("img") as HTMLImageElement | null)?.src ?? null,
				});
			}

			return results;
		},
		{
			panels: sourcePanelSelectors,
			items: sourceItemSelectors,
			rootSelector,
		},
	);
}

export async function extractResolvedSources(
	page: Page,
	provider: Provider,
): Promise<Source[]> {
	const responseProfile = await resolveResponseProfileForSources(
		page,
		provider,
	);
	if (!responseProfile?.selectors.sourcesButton.length) {
		return [];
	}

	logger.log(`[${provider}] opening sources panel`);
	const { opened, controlledPanelSelector } = await openSourcesPanelIfNeeded(
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

	const sourceProfile =
		(await waitForSelectorProfile(page, provider, "sources", 8_000, {
			requiredFields: ["sourcePanel", "sourceItem"],
		}).catch(() => null)) ??
		(await getSelectorProfile(page, provider, "sources", {
			allowModel: false,
		}).catch(() => null));
	const rawSources = await extractRawSourcesWithSelectors(
		page,
		sourceProfile?.selectors.sourcePanel ?? [],
		sourceProfile?.selectors.sourceItem ?? [],
		controlledPanelSelector,
	);

	if (rawSources.length === 0) {
		throw new ExternalServiceError(
			provider,
			"Sources button was present and opened, but no sources were extracted",
		);
	}

	const seen = new Set<string>();
	const results: Source[] = [];
	for (const { rawHref, title: rawTitle, citedText, imgSrc } of rawSources) {
		const url = rawHref.replace(/#.*$/, "");
		if (!url) continue;
		const key = `${url}|${rawTitle}|${citedText}`;
		if (seen.has(key)) continue;
		seen.add(key);

		const domain = getDomain(url) || null;
		const title = rawTitle || domain || url;
		const favicon = imgSrc ?? getFaviconUrls(domain ?? "")?.[0] ?? null;
		results.push({
			title,
			cited_text: citedText,
			url,
			domain,
			favicon,
		});
	}

	return results;
}
