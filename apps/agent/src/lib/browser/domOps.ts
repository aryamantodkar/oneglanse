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

			function readResponseText(provider: string, selectors: string[]): string {
				for (const selector of selectors || []) {
					const elements = resolveSelectorWithin(document, selector);
					for (let index = elements.length - 1; index >= 0; index -= 1) {
						const element = elements[index] ?? null;
						if (!isVisible(element)) continue;

						const isPlaceholder =
							element.getAttribute("aria-busy") === "true" ||
							(element.getAttribute("data-message-id") || "").startsWith(
								"request-placeholder",
							);
						if (isPlaceholder) continue;

						if (provider === "gemini") {
							const inner =
								element.querySelector("message-content") ||
								element.querySelector(".model-response-text") ||
								element;
							if (!isVisible(inner)) continue;
							const text = elementText(inner);
							if (text) return text;
							continue;
						}

						const text = elementText(element);
						if (text) return text;
					}
				}

				return "";
			}

			function readResponseHtml(selectors: string[]): string {
				for (const selector of selectors || []) {
					const elements = resolveSelectorWithin(document, selector);
					for (let index = elements.length - 1; index >= 0; index -= 1) {
						const element = elements[index] ?? null;
						if (!isVisible(element)) continue;
						if (!(element instanceof HTMLElement)) continue;

						const html = element.innerHTML.trim();
						if (html) return html;
					}
				}

				return "";
			}

			function captureVisibleHtml(
				selectors: string[],
				fallbackSelectors: string[],
			): { selector: string; html: string } {
				for (const selector of selectors || []) {
					const elements = resolveSelectorWithin(document, selector);
					for (let index = elements.length - 1; index >= 0; index -= 1) {
						const element = elements[index] ?? null;
						if (!isVisible(element)) continue;
						if (!(element instanceof HTMLElement)) continue;
						const html = element.outerHTML.trim();
						if (html) return { selector, html };
					}
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

			function extractChatgptRawSources(sels: any) {
				const results: Array<{
					rawHref: string;
					title: string;
					citedText: string;
					imgSrc: string | null;
				}> = [];

				const flyout =
					[sels.flyout.threadFlyout, sels.flyout.aside]
						.map((selector: string) => document.querySelector(selector))
						.find(Boolean) ||
					Array.from(document.querySelectorAll(sels.flyout.dialog)).find(
						(dialog) => dialog.querySelector(sels.anchor),
					) ||
					[
						sels.flyout.testId,
						sels.flyout.classSources,
						sels.flyout.classCitation,
					]
						.map((selector: string) => document.querySelector(selector))
						.find(Boolean) ||
					Array.from(document.querySelectorAll("div")).find(
						(div) =>
							div.querySelectorAll(sels.anchor).length >= 2 &&
							(div as HTMLElement).offsetHeight > 100,
					);

				if (!flyout) return results;

				for (const header of Array.from(
					(flyout as Element).querySelectorAll(sels.listItem),
				) as HTMLElement[]) {
					const label = header.textContent?.trim().toLowerCase();
					if (label !== "citations" && label !== "more") continue;

					const list = header.nextElementSibling;
					if (!(list instanceof HTMLUListElement)) continue;

					for (const anchor of Array.from(
						list.querySelectorAll<HTMLAnchorElement>(sels.anchor),
					)) {
						let href = anchor.getAttribute("href");
						if (!href) continue;

						try {
							href = new URL(href, location.origin)
								.toString()
								.replace(/#.*$/, "");
						} catch {
							continue;
						}

						const blocks = Array.from(anchor.children).filter(
							(element) => element instanceof HTMLElement,
						) as HTMLElement[];

						results.push({
							rawHref: href,
							title: blocks[1]?.textContent?.trim() || "",
							citedText: blocks[2]?.textContent?.trim() || "",
							imgSrc:
								anchor.querySelector(sels.img)?.getAttribute("src") ?? null,
						});
					}
				}

				return results;
			}

			function extractPerplexityRawSources(sels: any) {
				const results: Array<{
					rawHref: string;
					title: string;
					citedText: string;
					imgSrc: string | null;
				}> = [];

				const flyout = Array.from(
					document.querySelectorAll<HTMLDivElement>("div"),
				).find((div) => {
					const style = getComputedStyle(div);
					return (
						style.position === "fixed" &&
						style.right === "0px" &&
						div.querySelectorAll(sels.anchor).length >= 5
					);
				});

				if (!flyout) return results;

				const anchors = Array.from(
					flyout.querySelectorAll<HTMLAnchorElement>(sels.anchor),
				).filter(
					(anchor) =>
						anchor.querySelector(sels.img) && anchor.offsetHeight > 40,
				);

				for (const anchor of anchors) {
					const rawHref = anchor.href.replace(/#.*$/, "");
					if (!rawHref) continue;

					const domainForFilter = (() => {
						try {
							return new URL(rawHref).hostname.replace(/^www\./, "");
						} catch {
							return "";
						}
					})();

					const title =
						Array.from(anchor.querySelectorAll("span"))
							.map((span) => span.textContent?.trim() || "")
							.find((text) => text.length > 20 && text.length < 200) || "";

					const citedText =
						Array.from(anchor.querySelectorAll("div"))
							.map((div) => div.textContent?.trim() || "")
							.filter(
								(text) =>
									text.length > 40 &&
									!text.includes(domainForFilter) &&
									text !== title,
							)
							.at(-1) || "";

					results.push({
						rawHref,
						title,
						citedText,
						imgSrc: anchor.querySelector(sels.img)?.getAttribute("src") ?? null,
					});
				}

				return results;
			}

			function extractGeminiRawSources(sels: any) {
				const results: Array<{
					rawHref: string;
					title: string;
					citedText: string;
					imgSrc: string | null;
				}> = [];

				for (const card of Array.from(
					document.querySelectorAll(sels.sourceCard),
				)) {
					const anchor = card.querySelector(sels.anchor);
					let href = anchor?.getAttribute("href") || "";
					if (!href) continue;

					try {
						href =
							new URL(href, window.location.origin).toString().split("#")[0] ||
							"";
					} catch {
						continue;
					}

					results.push({
						rawHref: href,
						title:
							card.querySelector(sels.title)?.textContent?.trim() ||
							card.querySelector(sels.titleFallback)?.textContent?.trim() ||
							"",
						citedText:
							card.querySelector(sels.snippet)?.textContent?.trim() || "",
						imgSrc: card.querySelector(sels.icon)?.getAttribute("src") ?? null,
					});
				}

				return results;
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
					return readResponseHtml((currentParams?.selectors as string[]) || []);
				case "capture-visible-html":
					return captureVisibleHtml(
						(currentParams?.selectors as string[]) || [],
						(currentParams?.fallbackSelectors as string[]) || [],
					);
				case "raw-sources":
					switch (currentParams?.provider) {
						case "chatgpt":
							return extractChatgptRawSources(currentParams?.selectors);
						case "perplexity":
							return extractPerplexityRawSources(currentParams?.selectors);
						case "gemini":
							return extractGeminiRawSources(currentParams?.selectors);
						default:
							return [];
					}
				default:
					throw new Error(`unknown page operation: ${currentOperation}`);
			}
		},
		{ operation, params: params ?? {} },
	)) as T;
}
