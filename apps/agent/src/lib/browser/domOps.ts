import type { Provider } from "@oneglanse/types";
import type { Page as PlaywrightPage } from "playwright-core";
import { PROVIDER_RAW_SOURCES_DOM_EXTRACTORS } from "../../core/providers/_shared/rawSourcesDom.js";

export async function runPageDomOp<T>(
	page: PlaywrightPage,
	operation: string,
	params?: Record<string, unknown>,
): Promise<T> {
	const nextParams = { ...(params ?? {}) };
	if (operation === "raw-sources") {
		const provider = String(nextParams.provider || "") as Provider;
		nextParams.providerRawSourcesExtractor =
			PROVIDER_RAW_SOURCES_DOM_EXTRACTORS[provider] ?? "";
	}

	return (await page.evaluate(
		({ operation: currentOperation, params: currentParams }) => {
			function splitTopLevelSelectors(selector: string): string[] {
				const parts: string[] = [];
				let current = "";
				let parenDepth = 0;
				let bracketDepth = 0;
				let quote: "'" | '"' | null = null;

				for (const char of selector) {
					if (quote) {
						current += char;
						if (char === quote) {
							quote = null;
						}
						continue;
					}

					if (char === "'" || char === '"') {
						quote = char;
						current += char;
						continue;
					}

					if (char === "(") parenDepth += 1;
					if (char === ")") parenDepth = Math.max(0, parenDepth - 1);
					if (char === "[") bracketDepth += 1;
					if (char === "]") bracketDepth = Math.max(0, bracketDepth - 1);

					if (char === "," && parenDepth === 0 && bracketDepth === 0) {
						if (current.trim()) parts.push(current.trim());
						current = "";
						continue;
					}

					current += char;
				}

				if (current.trim()) parts.push(current.trim());
				return parts;
			}

			function parseHasTextSelector(selector: string): {
				baseSelector: string;
				textFilters: string[];
			} {
				const textFilters: string[] = [];
				let baseSelector = selector;
				const regex = /:has-text\((["'])(.*?)\1\)/g;

				baseSelector = baseSelector.replace(
					regex,
					(_full, _quote, value: string) => {
						textFilters.push(value);
						return "";
					},
				);

				baseSelector = baseSelector.trim() || "*";
				return { baseSelector, textFilters };
			}

			function elementText(element: Element): string {
				if (element instanceof HTMLElement) {
					return (element.innerText || element.textContent || "").trim();
				}
				return (element.textContent || "").trim();
			}

			function isVisible(element: Element | null): element is HTMLElement {
				if (!(element instanceof HTMLElement)) return false;
				if (!element.isConnected) return false;
				const style = window.getComputedStyle(element);
				if (
					style.display === "none" ||
					style.visibility === "hidden" ||
					style.opacity === "0"
				) {
					return false;
				}
				const rect = element.getBoundingClientRect();
				return rect.width > 0 && rect.height > 0;
			}

			function dedupeElements(elements: Element[]): Element[] {
				return Array.from(new Set(elements));
			}

			function resolveSelectorWithin(
				root: ParentNode,
				selector: string,
			): Element[] {
				const elements: Element[] = [];

				for (const part of splitTopLevelSelectors(selector)) {
					const { baseSelector, textFilters } = parseHasTextSelector(part);
					const matches = Array.from(
						root.querySelectorAll(baseSelector),
					).filter((el) =>
						textFilters.every((filter) =>
							elementText(el).toLowerCase().includes(filter.toLowerCase()),
						),
					);
					elements.push(...matches);
				}

				return dedupeElements(elements);
			}

			function isResponsePlaceholder(element: Element): boolean {
				return (
					element.getAttribute("aria-busy") === "true" ||
					(element.getAttribute("data-message-id") || "").startsWith(
						"request-placeholder",
					)
				);
			}

			function findLatestResponseElement(
				selectors: string[],
			): { selector: string; element: HTMLElement } | null {
				const selector = (selectors || []).join(", ");
				if (!selector.trim()) return null;

				const element =
					Array.from(document.querySelectorAll(selector))
						.filter(
							(el): el is HTMLElement =>
								el instanceof HTMLElement &&
								isVisible(el) &&
								!isResponsePlaceholder(el) &&
								el.innerText.trim().length > 50,
						)
						.pop() ?? null;

				return element ? { selector, element } : null;
			}

			function getCachedRawSources(key: string): Array<{
				rawHref: string;
				title: string;
				citedText: string;
			}> | null {
				const cache = (window as typeof window & {
					__oneglanseRawSourcesCache?: Record<
						string,
						Array<{
							rawHref: string;
							title: string;
							citedText: string;
						}>
					>;
				}).__oneglanseRawSourcesCache;

				return cache?.[key] ?? null;
			}

			function setCachedRawSources(
				key: string,
				rawSources: Array<{
					rawHref: string;
					title: string;
					citedText: string;
				}>,
			): void {
				const state = window as typeof window & {
					__oneglanseRawSourcesCache?: Record<
						string,
						Array<{
							rawHref: string;
							title: string;
							citedText: string;
						}>
					>;
				};
				state.__oneglanseRawSourcesCache ||= {};
				state.__oneglanseRawSourcesCache[key] = rawSources;
			}

			function extractClaudeRawSourcesFromResponseElement(responseEl: HTMLElement) {
				const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

				const getTextBeforeAnchor = (anchor: HTMLElement) => {
					let text = "";
					let node: Node | null = anchor;

					while (node) {
						if (node.previousSibling) {
							node = node.previousSibling;

							while (node && node.lastChild) {
								node = node.lastChild;
							}
						} else {
							node = node.parentNode;
						}

						if (!node) break;

						if (node.nodeType === Node.TEXT_NODE) {
							const content = node.textContent || "";
							text = `${content} ${text}`;

							if (/[.!?]\s*$/.test(content)) break;
						}
					}

					return normalize(text);
				};

				return Array.from(responseEl.querySelectorAll('a[href^="http"]'))
					.map((anchor) => {
						const link = anchor as HTMLAnchorElement;
						const anchorElement =
							anchor instanceof HTMLElement ? anchor : null;

						return {
							rawHref: link.href,
							title: (anchor.textContent || "").trim() || link.href,
							citedText: anchorElement ? getTextBeforeAnchor(anchorElement) : "",
						};
					})
					.filter((source) => source.rawHref);
			}

			function runProviderRawSourcesExtractor(
				extractorSource: string,
				selectors: string[],
			) {
				if (!extractorSource.trim()) return [];

				const extractor = Function(
					`return (${extractorSource});`,
				)() as (
					helpers: {
						getCachedRawSources: typeof getCachedRawSources;
						setCachedRawSources: typeof setCachedRawSources;
						findLatestResponseElement: typeof findLatestResponseElement;
						extractClaudeRawSourcesFromResponseElement: typeof extractClaudeRawSourcesFromResponseElement;
					},
					selectors: string[],
				) => unknown;

				return extractor(
					{
						getCachedRawSources,
						setCachedRawSources,
						findLatestResponseElement,
						extractClaudeRawSourcesFromResponseElement,
					},
					selectors,
				);
			}

			function readResponseText(_provider: string, selectors: string[]): string {
				return findLatestResponseElement(selectors)?.element.innerText.trim() || "";
			}

			function isCitationAnchor(anchor: HTMLAnchorElement): boolean {
				const text = anchor.textContent?.trim() || "";
				if (!text || text.length > 40) return false;
				// Purely numeric refs: "1", "+3", "[2]"
				if (/^\+?\d+$/.test(text)) return true;
				// Domain-style citation chips must contain a dot to distinguish them from
				// normal link text like "Read more" or "Learn more".
				// Allows "site.com", "sub.site.com", "emailtooltester.com+3" (Perplexity "+N" suffix).
				// No spaces — domains never have spaces.
				if (/^[a-z0-9.\-+]+$/i.test(text) && text.includes(".") && text.length < 40) return true;
				return false;
			}

			function formatCitationAnchors(root: HTMLElement): void {
				const cleanCitationText = (text: string) =>
					text.replace(/\+\d+$/, "").trim();

				for (const anchor of Array.from(root.querySelectorAll("a[href]"))) {
					if (!(anchor instanceof HTMLAnchorElement)) continue;
					if (!isCitationAnchor(anchor)) continue;

					const rawText = anchor.textContent?.trim();
					if (!rawText) continue;

					const cleaned = cleanCitationText(rawText);
					if (!cleaned) {
						anchor.remove();
						continue;
					}

					const strong = document.createElement("strong");
					strong.textContent = `[${cleaned}]`;

					anchor.replaceWith(
						document.createTextNode(" "),
						strong,
						document.createTextNode(" "),
					);
				}
			}

			function readResponseHtml(provider: string, selectors: string[]): string {
				// AI Overview: bypass findLatestResponseElement (which uses innerText and
				// misses CSS-clipped content) — directly query the container, clone it,
				// strip noise, and return innerHTML so turndown preserves formatting.
				if (provider === "ai-overview") {
					const root = document.querySelector('[data-container-id="main-col"]');
					if (!root) return "";

					const clone = root.cloneNode(true) as HTMLElement;
					formatCitationAnchors(clone);

					clone
						.querySelectorAll(
							'[data-src-id], button, [role="button"], svg, img, style, script',
						)
						.forEach((el) => el.remove());

					return clone.innerHTML.trim();
				}

				const latestResponse = findLatestResponseElement(selectors);
				if (!latestResponse) return "";

				if (provider === "claude") {
					setCachedRawSources(
						"claude",
						extractClaudeRawSourcesFromResponseElement(latestResponse.element),
					);
				}

				// Clone before mutating so the live DOM is untouched
				const clone = latestResponse.element.cloneNode(true) as HTMLElement;
				formatCitationAnchors(clone);

				// Strip UI chrome that leaks into text: action buttons, icons,
				// tooltips, live regions, citation superscripts, and decorative media
				const noiseSelectors = [
					"button",
					"[role='button']",
					"svg",
					"script",
					"style",
					"noscript",
					"iframe",
					"sup",
					"[aria-live]",
					"[data-testid='copy-turn-action-button']",
					"[data-testid='voice-play-turn-action-button']",
					"[data-testid='thumbs-up-button']",
					"[data-testid='thumbs-down-button']",
					"[aria-hidden='true']",
				];
				for (const sel of noiseSelectors) {
					for (const el of Array.from(clone.querySelectorAll(sel))) {
						el.remove();
					}
				}

				return clone.innerHTML.trim();
			}

			function captureVisibleHtml(
				selectors: string[],
				fallbackSelectors: string[],
			): { selector: string; html: string } {
				const latestResponse = findLatestResponseElement(selectors);
				if (latestResponse) {
					const html = latestResponse.element.outerHTML.trim();
					if (html) return { selector: latestResponse.selector, html };
				}

				for (const selector of fallbackSelectors || []) {
					const element = resolveSelectorWithin(document, selector)[0] ?? null;
					if (!isVisible(element)) continue;
					const html = (element as HTMLElement).outerHTML.trim();
					if (html) return { selector, html };
				}

				return { selector: "none", html: "" };
			}

			function detectBotPageState(): {
				botDetected: boolean;
				reason: string | null;
			} {
				const bodyText = (document.body?.innerText || "")
					.replace(/\s+/g, " ")
					.trim();
				const title = (document.title || "").trim();
				const url = window.location.href;

				const signals: Array<{ matched: boolean; reason: string }> = [
					{
						matched:
							/sorry/i.test(url) ||
							/our systems have detected unusual traffic/i.test(bodyText),
						reason: "bot detection: unusual traffic / sorry page",
					},
					{
						matched: /captcha|recaptcha|turnstile|verify you are human/i.test(
							bodyText,
						),
						reason: "bot detection: captcha or human verification challenge",
					},
					{
						matched:
							Boolean(
								document.querySelector(
									'form#captcha-form, iframe[src*="recaptcha"]',
								),
							) || /challenge/i.test(title),
						reason: "bot detection: challenge UI present",
					},
					{
						matched:
							/\/login|\/log-in|\/signin|\/sign-in|\/sign-up|\/signup|\/auth(?:\/|$)|accounts\.google\.com|auth\.openai\.com/.test(
								url,
							),
						reason: "session expired: redirected to login page",
					},
					{
						matched:
							/sign in to continue|you('ve| have) been signed out|create a free account|log in to continue|sign in to (?:chat|use|access)|please (?:sign|log) in/i.test(
								bodyText,
							),
						reason: "session expired: login wall detected",
					},
				];

				const hit = signals.find((signal) => signal.matched);
				return {
					botDetected: Boolean(hit),
					reason: hit?.reason ?? null,
				};
			}

			function getPlatformName(): string {
				const uaDataPlatform =
					(
						navigator as Navigator & {
							userAgentData?: { platform?: string };
						}
					).userAgentData?.platform || "";
				return String(uaDataPlatform || navigator.platform || "").toLowerCase();
			}

			switch (currentOperation) {
				case "ping":
					return true;
				case "window-metrics":
					return {
						outerHeight: window.outerHeight,
						innerHeight: window.innerHeight,
						outerWidth: window.outerWidth,
						innerWidth: window.innerWidth,
					};
				case "detect-bot-page":
					return detectBotPageState();
				case "platform-name":
					return getPlatformName();
				case "response-text":
					return readResponseText(
						String(currentParams?.provider || ""),
						(currentParams?.selectors as string[]) || [],
					);
				case "response-html":
					return readResponseHtml(
						String(currentParams?.provider || ""),
						(currentParams?.selectors as string[]) || [],
					);
				case "capture-visible-html":
					return captureVisibleHtml(
						(currentParams?.selectors as string[]) || [],
						(currentParams?.fallbackSelectors as string[]) || [],
					);
				case "raw-sources":
					return runProviderRawSourcesExtractor(
						String(currentParams?.providerRawSourcesExtractor || ""),
						(currentParams?.selectors as string[]) || [],
					);
				default:
					throw new Error(`unknown page operation: ${currentOperation}`);
			}
		},
		{ operation, params: nextParams },
	)) as T;
}
