import type { Page as PlaywrightPage } from "playwright-core";

export async function runPageDomOp<T>(
	page: PlaywrightPage,
	operation: string,
	params?: Record<string, unknown>,
): Promise<T> {
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

			function getCachedLatestResponseElement(provider: string): HTMLElement | null {
				const cache = (window as typeof window & {
					__oneglanseLatestResponseElementCache?: Record<
						string,
						HTMLElement | undefined
					>;
				}).__oneglanseLatestResponseElementCache;
				const element = cache?.[provider];
				return element instanceof HTMLElement && element.isConnected
					? element
					: null;
			}

			function setCachedLatestResponseElement(
				provider: string,
				element: HTMLElement | null,
			): void {
				const state = window as typeof window & {
					__oneglanseLatestResponseElementCache?: Record<
						string,
						HTMLElement | undefined
					>;
				};
				state.__oneglanseLatestResponseElementCache ||= {};

				if (!provider) return;
				if (element) {
					state.__oneglanseLatestResponseElementCache[provider] = element;
					return;
				}

				delete state.__oneglanseLatestResponseElementCache[provider];
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
				return Array.from(responseEl.querySelectorAll('a[href^="http"]'))
					.map((anchor) => {
						const link = anchor as HTMLAnchorElement;
						const anchorText = (anchor.textContent || "").trim();
						const paragraph = anchor.closest("p");
						const fullText = paragraph?.textContent || "";
						const index = fullText.indexOf(anchorText);

						let citedText = "";
						if (index > 0) {
							const before = fullText.slice(0, index);
							citedText =
								before.split(/(?<=[.!?])\s+/).pop()?.trim() || before.trim();
						}

						return {
							rawHref: link.href,
							title: anchorText || link.href,
							citedText,
						};
					})
					.filter((source) => source.rawHref);
			}

			function readResponseText(_provider: string, selectors: string[]): string {
				return findLatestResponseElement(selectors)?.element.innerText.trim() || "";
			}

			function readResponseHtml(provider: string, selectors: string[]): string {
				const latestResponse = findLatestResponseElement(selectors);
				if (!latestResponse) {
					setCachedLatestResponseElement(provider, null);
					return "";
				}

				setCachedLatestResponseElement(provider, latestResponse.element);

				if (provider === "claude") {
					setCachedRawSources(
						"claude",
						extractClaudeRawSourcesFromResponseElement(latestResponse.element),
					);
				}

				return latestResponse.element.innerHTML.trim();
			}

			function findSourcesButtonIndexNearLatestResponse(provider: string): number {
				const normalize = (text: string | null | undefined) =>
					text?.toLowerCase().replace(/\s+/g, " ").trim() || "";
			
				const isVisible = (el: HTMLElement) =>
					!!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
			
				const getSourceSignalScore = (text: string, aria: string) => {
					let score = 0;
			
					if (/\b\d+\s*sources?\b/.test(text)) score += 120;
					if (aria.includes("sources")) score += 90;
					if (text === "sources") score += 80;
					if (text.includes("sources")) score += 40;
			
					return score;
				};
			
				const scoreButton = (el: Element | null) => {
					if (!(el instanceof HTMLElement) || !isVisible(el)) return -1;
			
					const text = normalize(el.textContent);
					const aria = normalize(el.getAttribute("aria-label"));
			
					return getSourceSignalScore(text, aria);
				};
			
				const hasLikelySources = (el: HTMLElement) => {
					const text = normalize(el.textContent);
			
					if (getSourceSignalScore(text, "") > 0) return true;
			
					return Array.from(el.querySelectorAll("[aria-label]")).some((child) =>
						getSourceSignalScore("", normalize(child.getAttribute("aria-label"))) > 0
					);
				};
			
				const latestResponse = getCachedLatestResponseElement(provider);
				if (!latestResponse) return -1;
			
				let root: HTMLElement = latestResponse;
			
				for (let i = 0; i < 8; i++) {
					if (!root.parentElement) break;
			
					root = root.parentElement;
			
					if (hasLikelySources(root)) break;
				}
			
				const searchRoot = root.parentElement || root;
			
				const allButtons = Array.from(
					document.querySelectorAll("button, [role='button']")
				);
			
				const candidates = Array.from(
					searchRoot.querySelectorAll("button, [role='button']")
				);
			
				const best = candidates
					.map((el) => {
						const score = scoreButton(el);
						if (score <= 0) return null;
			
						const index = allButtons.indexOf(el);
						if (index === -1) return null;
			
						return { index, score };
					})
					.filter(Boolean)
					.sort(
						(a, b) =>
							(b!.score - a!.score) || (b!.index - a!.index)
					)[0];
			
				return best?.index ?? -1;
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
							/accounts\.google\.com|auth\.openai\.com|perplexity\.ai\/login/.test(
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

			function extractChatgptRawSources() {
				const results: Array<{
					rawHref: string;
					title: string;
					citedText: string;
				}> = [];
				for (const anchor of Array.from(
					document.querySelectorAll(
						'ul li > a[target="_blank"][rel*="noopener"][href^="http"]',
					),
				)) {
					if (!(anchor instanceof HTMLAnchorElement)) continue;

					const textBlocks = Array.from(anchor.querySelectorAll("*"))
						.map((element) => element.textContent?.trim())
						.filter(Boolean);

					results.push({
						rawHref: anchor.href,
						title: textBlocks[1] || "",
						citedText: textBlocks.slice(2).join(" ") || "",
					});
				}

				return results;
			}

			function extractPerplexityRawSources() {
				const results: Array<{
					rawHref: string;
					title: string;
					citedText: string;
				}> = [];
				const panel = document.querySelector(
					'[role="tabpanel"][aria-labelledby*="citations"]',
				);
				if (!panel) return results;

				for (const anchor of Array.from(
					panel.querySelectorAll('a[href^="http"]'),
				)) {
					if (!(anchor instanceof HTMLAnchorElement)) continue;

					const rawHref = anchor.href.replace(/#.*$/, "");
					if (!rawHref) continue;

					const textNodes = Array.from(anchor.querySelectorAll("*"))
						.map((element) => element.textContent?.trim())
						.filter(Boolean);

					results.push({
						rawHref,
						title: textNodes[1] || "",
						citedText: textNodes.slice(2).join(" ") || "",
					});
				}

				return results;
			}

			function extractGeminiRawSources() {
				const results: Array<{
					rawHref: string;
					title: string;
					citedText: string;
				}> = [];
				for (const anchor of Array.from(
					document.querySelectorAll(
						'context-sidebar inline-source-card a[href^="http"]',
					),
				)) {
					if (!(anchor instanceof HTMLAnchorElement)) continue;

					const blocks = Array.from(anchor.querySelectorAll("*"))
						.map((element) => element.textContent?.trim())
						.filter(Boolean);

					results.push({
						rawHref: anchor.href,
						title: blocks[1] || "",
						citedText: blocks.slice(2).join(" ") || "",
					});
				}

				return results;
			}

			function extractClaudeRawSources(selectors: string[]) {
				const cached = getCachedRawSources("claude");
				if (cached) return cached;

				const responseEl = findLatestResponseElement(selectors)?.element;
				if (!responseEl) return [];

				const rawSources =
					extractClaudeRawSourcesFromResponseElement(responseEl);
				setCachedRawSources("claude", rawSources);
				return rawSources;
			}

			function extractAIOverviewRawSources() {
				const results: Array<{
					rawHref: string;
					title: string;
					citedText: string;
				}> = [];
				const rhsCol = document.querySelector('[data-container-id="rhs-col"]');
				if (!rhsCol) {
					return { rawSources: results, containerFound: false };
				}

				const seen = new Set<string>();
				for (const card of Array.from(rhsCol.querySelectorAll("div[data-src-id]"))) {
					if (!(card instanceof HTMLElement)) continue;

					const srcId = card.getAttribute("data-src-id")?.trim() || "";
					if (!srcId || seen.has(srcId)) continue;
					seen.add(srcId);

					const link = card.querySelector('a[href^="http"]');
					if (!(link instanceof HTMLAnchorElement)) continue;

					const title =
						link
							.getAttribute("aria-label")
							?.replace(/\.\s*Opens in new tab\.?$/i, "")
							.trim() ||
						link.href;
					const citedText =
						card.querySelector("[data-crb-snippet-text]")?.textContent?.trim() ||
						"";

					results.push({
						rawHref: link.href,
						title,
						citedText,
					});
				}

				return { rawSources: results, containerFound: true };
			}

			function extractAIOverviewResponseHtml() {
				const sourceCardDatePattern =
					/([A-Z][a-z]+ \d{1,2}, \d{4}|\d{1,2} [A-Z][a-z]+ \d{4}|\d+\s(?:second|minute|hour|day|week|month|year)s? ago|[Yy]esterday|\b\d{4}\b\s(?:—|·))/;
				const placeholderSelector =
					'[data-container-id="model-response-placeholder"]';
				const placeholderWrapperSelector =
					'div:has(> [data-container-id="main-col"])';
				const mainColSelector = '[data-container-id="main-col"]';
				const noiseTags = [
					"script",
					"style",
					"button",
					"svg",
					"noscript",
					"iframe",
					"sup",
				];
				const aiOverviewChipSelector = 'a[href*="google.com/search"]';
				const sourceContainers = [
					'[data-container-id="rhs-col"]',
					'[data-xid="aim-aside-initial-corroboration-container"]',
					'[role="dialog"][data-type="hovc"]',
				];
				const sourceLinkSelector = 'a[target="_blank"][rel="noopener"]';
				const headingSelector = '[role="heading"]';
				const inlineSourceLinkSelector = 'a[target="_blank"][rel="noopener"]';

				const placeholder =
					document.querySelector(placeholderSelector) ||
					document.querySelector(placeholderWrapperSelector) ||
					document.querySelector(mainColSelector)?.parentElement;
				if (!placeholder) {
					return {
						success: false,
						error: "model-response-placeholder not found",
					};
				}

				const mainCol = placeholder.querySelector(mainColSelector) || placeholder;
				if (((mainCol.textContent || "").trim()).length < 50) {
					return { success: false, error: "no-ai-overview: main-col empty" };
				}

				const clone = placeholder.cloneNode(true) as HTMLElement;

				for (const tag of noiseTags) {
					for (const element of Array.from(clone.querySelectorAll(tag))) {
						element.remove();
					}
				}

				for (const anchor of Array.from(
					clone.querySelectorAll(aiOverviewChipSelector),
				)) {
					const span = document.createElement("span");
					span.textContent = anchor.textContent;
					anchor.parentNode?.replaceChild(span, anchor);
				}

				for (const selector of sourceContainers) {
					for (const element of Array.from(clone.querySelectorAll(selector))) {
						element.remove();
					}
				}

				const remainingSourceLinks = Array.from(
					clone.querySelectorAll(sourceLinkSelector),
				);
				const toRemove = new Set<Element>();
				for (const link of remainingSourceLinks) {
					let element: Element = link;
					while (element.parentElement && element.parentElement !== clone) {
						const parent = element.parentElement;
						if (parent.querySelector(headingSelector)) break;
						const hasNonSourceSibling = Array.from(parent.children).some(
							(sibling) =>
								sibling !== element &&
								(sibling.textContent || "").length > 100 &&
								!sibling.querySelector(inlineSourceLinkSelector),
						);
						if (hasNonSourceSibling) break;
						element = parent;
					}
					toRemove.add(element);
				}
				for (const element of toRemove) {
					element.remove();
				}

				const extractedMainCol = clone.querySelector(mainColSelector) || clone;
				for (const element of Array.from(clone.querySelectorAll("*"))) {
					if (
						extractedMainCol &&
						(element === extractedMainCol || extractedMainCol.contains(element))
					) {
						continue;
					}

					const text = element.textContent || "";
					if (
						text.length < 5000 &&
						sourceCardDatePattern.test(text) &&
						!element.querySelector(headingSelector)
					) {
						element.remove();
					}
				}

				const html = (extractedMainCol || clone).outerHTML.trim();
				if (!html) {
					return {
						success: false,
						error: "AI Overview HTML was empty after extraction",
					};
				}

				return { success: true, html };
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
				case "sources-button-index":
					return findSourcesButtonIndexNearLatestResponse(
						String(currentParams?.provider || ""),
					);
				case "raw-sources":
					switch (currentParams?.provider) {
						case "chatgpt":
							return extractChatgptRawSources();
						case "perplexity":
							return extractPerplexityRawSources();
						case "gemini":
							return extractGeminiRawSources();
						case "claude":
							return extractClaudeRawSources(
								(currentParams?.selectors as string[]) || [],
							);
						case "ai-overview":
							return extractAIOverviewRawSources();
						default:
							return [];
					}
				case "ai-overview-response-html":
					return extractAIOverviewResponseHtml();
				default:
					throw new Error(`unknown page operation: ${currentOperation}`);
			}
		},
		{ operation, params: params ?? {} },
	)) as T;
}
