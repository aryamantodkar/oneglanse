declare const chrome: any;

type SerializedPattern =
	| { kind: "string"; value: string }
	| { kind: "regex"; source: string; flags: string };

type LocatorStep =
	| { kind: "selector"; selector: string }
	| { kind: "filterText"; pattern: SerializedPattern }
	| { kind: "getByText"; pattern: SerializedPattern }
	| { kind: "index"; index: number };

type SerializedLocator = {
	steps: LocatorStep[];
};

type ContentMessage = {
	method: string;
	params?: any;
};

function postReady(): void {
	chrome.runtime.sendMessage({
		type: "onescope-content-ready",
		url: window.location.href,
	});
}

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

	baseSelector = baseSelector.replace(regex, (_full, _quote, value: string) => {
		textFilters.push(value);
		return "";
	});

	baseSelector = baseSelector.trim() || "*";
	return { baseSelector, textFilters };
}

function matchesPattern(value: string, pattern: SerializedPattern): boolean {
	if (pattern.kind === "string") {
		return value.toLowerCase().includes(pattern.value.toLowerCase());
	}

	try {
		return new RegExp(pattern.source, pattern.flags).test(value);
	} catch {
		return false;
	}
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

function isEnabled(element: Element | null): boolean {
	if (!(element instanceof HTMLElement)) return false;
	if ("disabled" in element && Boolean((element as HTMLButtonElement).disabled)) {
		return false;
	}
	return element.getAttribute("aria-disabled") !== "true";
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
		const matches = Array.from(root.querySelectorAll(baseSelector)).filter((el) =>
			textFilters.every((filter) =>
				elementText(el).toLowerCase().includes(filter.toLowerCase()),
			),
		);
		elements.push(...matches);
	}

	return dedupeElements(elements);
}

function resolveLocator(locator: SerializedLocator): Element[] {
	let current: Array<Document | Element> = [document];

	for (const step of locator.steps) {
		switch (step.kind) {
			case "selector":
				current = current.flatMap((root) =>
					resolveSelectorWithin(root, step.selector),
				);
				break;
			case "filterText":
				current = current.filter((candidate) =>
					candidate instanceof Element &&
					matchesPattern(elementText(candidate), step.pattern),
				);
				break;
			case "getByText":
				current = current.flatMap((root) => {
					if (!(root instanceof Element)) return [];
					const descendants = [root, ...Array.from(root.querySelectorAll("*"))];
					return descendants.filter((candidate) =>
						matchesPattern(elementText(candidate), step.pattern),
					);
				});
				break;
			case "index": {
				const pool = current.filter(
					(candidate): candidate is Element => candidate instanceof Element,
				);
				const index =
					step.index >= 0 ? step.index : Math.max(0, pool.length + step.index);
				current = pool[index] ? [pool[index]] : [];
				break;
			}
		}
	}

	return current.filter(
		(candidate): candidate is Element => candidate instanceof Element,
	);
}

function nativeValueSetterFor(
	element: HTMLInputElement | HTMLTextAreaElement,
): ((value: string) => void) | null {
	const proto = Object.getPrototypeOf(element);
	const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
	return descriptor?.set
		? (value) => descriptor.set?.call(element, value)
		: null;
}

function setEditableValue(element: Element, value: string): void {
	if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
		const setter = nativeValueSetterFor(element);
		if (setter) {
			setter(value);
		} else {
			element.value = value;
		}
		element.dispatchEvent(new Event("input", { bubbles: true }));
		element.dispatchEvent(new Event("change", { bubbles: true }));
		return;
	}

	if (element instanceof HTMLElement) {
		element.focus();
		element.innerText = value;
		element.dispatchEvent(new Event("input", { bubbles: true }));
		element.dispatchEvent(new Event("change", { bubbles: true }));
	}
}

function readInputValue(element: Element | null): string {
	if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
		return element.value.trim();
	}
	if (element instanceof HTMLElement) {
		return (element.innerText || element.textContent || "").trim();
	}
	return "";
}

function editableState(element: Element | null): {
	connected: boolean;
	visible: boolean;
	editable: boolean;
} {
	if (!(element instanceof HTMLElement)) {
		return { connected: false, visible: false, editable: false };
	}

	const connected = element.isConnected;
	const visible = isVisible(element);
	const editable =
		element.tagName === "TEXTAREA" ||
		element.tagName === "INPUT" ||
		element.getAttribute("contenteditable") === "true";

	return { connected, visible, editable };
}

function dispatchClick(element: Element | null): void {
	if (!(element instanceof HTMLElement)) return;
	element.dispatchEvent(
		new MouseEvent("click", {
			bubbles: true,
			cancelable: true,
			composed: true,
			view: window,
		}),
	);
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

function detectBotPageState(): { botDetected: boolean; reason: string | null } {
	const bodyText = (document.body?.innerText || "").replace(/\s+/g, " ").trim();
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
			matched: /captcha|recaptcha|turnstile|verify you are human/i.test(bodyText),
			reason: "bot detection: captcha or human verification challenge",
		},
		{
			matched:
				Boolean(
					document.querySelector('form#captcha-form, iframe[src*="recaptcha"]'),
				) || /challenge/i.test(title),
			reason: "bot detection: challenge UI present",
		},
	];

	const hit = signals.find((signal) => signal.matched);
	return {
		botDetected: Boolean(hit),
		reason: hit?.reason ?? null,
	};
}

function extractChatgptRawSources(sels: any): Array<{
	rawHref: string;
	title: string;
	citedText: string;
	imgSrc: string | null;
}> {
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
		Array.from(document.querySelectorAll(sels.flyout.dialog)).find((dialog) =>
			dialog.querySelector(sels.anchor),
		) ||
		[sels.flyout.testId, sels.flyout.classSources, sels.flyout.classCitation]
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
				href = new URL(href, location.origin).toString().replace(/#.*$/, "");
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
				imgSrc: anchor.querySelector(sels.img)?.getAttribute("src") ?? null,
			});
		}
	}

	return results;
}

function extractPerplexityRawSources(sels: any): Array<{
	rawHref: string;
	title: string;
	citedText: string;
	imgSrc: string | null;
}> {
	const results: Array<{
		rawHref: string;
		title: string;
		citedText: string;
		imgSrc: string | null;
	}> = [];

	const flyout = Array.from(document.querySelectorAll<HTMLDivElement>("div")).find(
		(div) => {
			const style = getComputedStyle(div);
			return (
				style.position === "fixed" &&
				style.right === "0px" &&
				div.querySelectorAll(sels.anchor).length >= 5
			);
		},
	);

	if (!flyout) return results;

	const anchors = Array.from(
		flyout.querySelectorAll<HTMLAnchorElement>(sels.anchor),
	).filter(
		(anchor) => anchor.querySelector(sels.img) && anchor.offsetHeight > 40,
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

function extractGeminiRawSources(sels: any): Array<{
	rawHref: string;
	title: string;
	citedText: string;
	imgSrc: string | null;
}> {
	const results: Array<{
		rawHref: string;
		title: string;
		citedText: string;
		imgSrc: string | null;
	}> = [];

	for (const card of Array.from(document.querySelectorAll(sels.sourceCard))) {
		const anchor = card.querySelector(sels.anchor);
		let href = anchor?.getAttribute("href") || "";
		if (!href) continue;

		try {
			href = new URL(href, window.location.origin).toString().split("#")[0] || "";
		} catch {
			continue;
		}

		results.push({
			rawHref: href,
			title:
				card.querySelector(sels.title)?.textContent?.trim() ||
				card.querySelector(sels.titleFallback)?.textContent?.trim() ||
				"",
			citedText: card.querySelector(sels.snippet)?.textContent?.trim() || "",
			imgSrc: card.querySelector(sels.icon)?.getAttribute("src") ?? null,
		});
	}

	return results;
}

function extractAIOverviewRawSources(sels: any): {
	rawSources: Array<{
		rawHref: string;
		title: string;
		citedText: string;
		imgSrc: string | null;
	}>;
	containerFound: boolean;
} {
	const results: Array<{
		rawHref: string;
		title: string;
		citedText: string;
		imgSrc: string | null;
	}> = [];

	let aoContainer: HTMLElement | null = null;

	for (const heading of Array.from(document.querySelectorAll(sels.headings))) {
		if (!heading.textContent?.toLowerCase().includes("ai overview")) continue;
		let current: HTMLElement | null = heading.parentElement;
		for (let index = 0; index < 8; index += 1) {
			if (!current) break;
			if ((current.innerText || "").length > 500) {
				aoContainer = current;
				break;
			}
			current = current.parentElement;
		}
		if (aoContainer) break;
	}

	if (!aoContainer) {
		for (const div of Array.from(document.querySelectorAll(sels.containers))) {
			if (!(div instanceof HTMLElement)) continue;
			const text = div.innerText || "";
			if (text.toLowerCase().includes("ai overview") && text.length > 500) {
				aoContainer = div;
				break;
			}
		}
	}

	if (!aoContainer) {
		return { rawSources: results, containerFound: false };
	}

	for (const link of Array.from(aoContainer.querySelectorAll(sels.anchor))) {
		if (!(link instanceof HTMLAnchorElement)) continue;
		const url = link.href;
		if (!url || url.includes("google.com/search") || url.includes("google.com/")) {
			continue;
		}

		const rawHref = url.split("#")[0];
		if (!rawHref) continue;

		let title =
			link.getAttribute("aria-label")?.trim() ||
			link.getAttribute("title")?.trim() ||
			link.textContent?.trim() ||
			"";
		if (!title) title = rawHref;

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
				citedText = paragraph.textContent?.trim().substring(0, 200) || "";
			}
		}

		results.push({
			rawHref,
			title,
			citedText: citedText || title,
			imgSrc: null,
		});
	}

	return { rawSources: results, containerFound: true };
}

function extractAIOverviewResponseHtml(sels: any): {
	success: boolean;
	html?: string;
	error?: string;
} {
	const SOURCE_CARD_DATE_PATTERN =
		/([A-Z][a-z]+ \d{1,2}, \d{4}|\d{1,2} [A-Z][a-z]+ \d{4}|\d+\s(?:second|minute|hour|day|week|month|year)s? ago|[Yy]esterday|\b\d{4}\b\s(?:—|·))/;

	const placeholder =
		document.querySelector(sels.placeholder) ||
		document.querySelector(sels.placeholderWrapper) ||
		document.querySelector(sels.mainCol)?.parentElement;
	if (!placeholder) {
		return {
			success: false,
			error: "model-response-placeholder not found",
		};
	}

	const mainCol = placeholder.querySelector(sels.mainCol) || placeholder;
	if (((mainCol.textContent || "").trim()).length < 50) {
		return { success: false, error: "no-ai-overview: main-col empty" };
	}

	const clone = placeholder.cloneNode(true) as HTMLElement;

	for (const tag of sels.noiseTags) {
		for (const element of Array.from(clone.querySelectorAll(tag))) {
			element.remove();
		}
	}

	for (const anchor of Array.from(clone.querySelectorAll(sels.aiOverviewChip))) {
		const span = document.createElement("span");
		span.textContent = anchor.textContent;
		anchor.parentNode?.replaceChild(span, anchor);
	}

	for (const selector of sels.sourceContainers) {
		for (const element of Array.from(clone.querySelectorAll(selector))) {
			element.remove();
		}
	}

	const remainingSourceLinks = Array.from(clone.querySelectorAll(sels.sourceLink));
	const toRemove = new Set<Element>();
	for (const link of remainingSourceLinks) {
		let element: Element = link;
		while (element.parentElement && element.parentElement !== clone) {
			const parent = element.parentElement;
			if (parent.querySelector(sels.heading)) break;
			const hasNonSourceSibling = Array.from(parent.children).some(
				(sibling) =>
					sibling !== element &&
					(sibling.textContent || "").length > 100 &&
					!sibling.querySelector(sels.inlineSourceLink),
			);
			if (hasNonSourceSibling) break;
			element = parent;
		}
		toRemove.add(element);
	}
	for (const element of toRemove) {
		element.remove();
	}

	const extractedMainCol = clone.querySelector(sels.mainCol) || clone;
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
			SOURCE_CARD_DATE_PATTERN.test(text) &&
			!element.querySelector(sels.heading)
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

async function waitForSelectorInPage(
	selector: string,
	timeoutMs: number,
	state: "attached" | "visible" | "hidden",
): Promise<void> {
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		const elements = resolveSelectorWithin(document, selector);
		if (state === "hidden") {
			const visible = elements.some((element) => isVisible(element));
			if (!visible) return;
		} else if (state === "attached") {
			if (elements.length > 0) return;
		} else {
			if (elements.some((element) => isVisible(element))) return;
		}

		await new Promise((resolve) => setTimeout(resolve, 100));
	}

	throw new Error(`selector wait timed out: ${selector}`);
}

async function handleMessage(message: ContentMessage): Promise<any> {
	const params = message.params || {};

	switch (message.method) {
		case "ping":
			return true;
		case "waitForSelector":
			await waitForSelectorInPage(
				params.selector,
				params.timeoutMs || 30_000,
				params.state || "visible",
			);
			return true;
		case "pageOp":
			switch (params.operation) {
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
				case "response-text":
					return readResponseText(params.provider, params.selectors || []);
				case "response-html":
					return readResponseHtml(params.selectors || []);
				case "capture-visible-html":
					return captureVisibleHtml(
						params.selectors || [],
						params.fallbackSelectors || [],
					);
				case "raw-sources":
					switch (params.provider) {
						case "chatgpt":
							return extractChatgptRawSources(params.selectors);
						case "perplexity":
							return extractPerplexityRawSources(params.selectors);
						case "gemini":
							return extractGeminiRawSources(params.selectors);
						case "ai-overview":
							return extractAIOverviewRawSources(params.selectors);
						default:
							return [];
					}
				case "ai-overview-response-html":
					return extractAIOverviewResponseHtml(params.selectors);
				default:
					throw new Error(`unknown page operation: ${params.operation}`);
			}
		case "locatorOp": {
			const locator = params.locator as SerializedLocator;
			const elements = resolveLocator(locator);
			const element = elements[0] || null;
			switch (params.operation) {
				case "count":
					return elements.length;
				case "isVisible":
					return isVisible(element);
				case "isEnabled":
					return isEnabled(element);
				case "focus":
					if (element instanceof HTMLElement) {
						element.focus();
					}
					return true;
				case "boundingBox":
					if (!isVisible(element)) return null;
					{
						const rect = element.getBoundingClientRect();
						return {
							x: rect.x,
							y: rect.y,
							width: rect.width,
							height: rect.height,
						};
					}
				case "scrollIntoViewIfNeeded":
					if (element instanceof HTMLElement) {
						element.scrollIntoView({
							block: "center",
							inline: "center",
							behavior: "auto",
						});
					}
					return true;
				case "click":
					if (element instanceof HTMLElement) {
						element.click();
					}
					return true;
				case "waitFor":
					if (params.state === "hidden") {
						const timeoutMs = params.timeoutMs || 5_000;
						const deadline = Date.now() + timeoutMs;
						while (Date.now() < deadline) {
							if (!isVisible(resolveLocator(locator)[0] || null)) return true;
							await new Promise((resolve) => setTimeout(resolve, 100));
						}
						throw new Error("locator did not become hidden");
					}
					return true;
				case "readInputValue":
					return readInputValue(element);
				case "setInputValue":
					if (element) {
						setEditableValue(element, params.value || "");
					}
					return true;
				case "getEditableState":
					return editableState(element);
				case "dispatchClick":
					dispatchClick(element);
					return true;
				default:
					throw new Error(`unknown locator operation: ${params.operation}`);
			}
		}
		case "keyboardPress": {
			const key = params.key as string;
			const active = document.activeElement;
			if (
				key === "Backspace" &&
				(active instanceof HTMLInputElement ||
					active instanceof HTMLTextAreaElement ||
					active instanceof HTMLElement)
			) {
				setEditableValue(active, "");
				return true;
			}
			if (key === "Escape") {
				active?.dispatchEvent(
					new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
				);
				active?.dispatchEvent(
					new KeyboardEvent("keyup", { key: "Escape", bubbles: true }),
				);
				return true;
			}
			if (key === "Enter") {
				active?.dispatchEvent(
					new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
				);
				active?.dispatchEvent(
					new KeyboardEvent("keyup", { key: "Enter", bubbles: true }),
				);
				return true;
			}
			if (key === "Control+A" || key === "Meta+A") {
				const activeElement = document.activeElement;
				if (
					activeElement instanceof HTMLInputElement ||
					activeElement instanceof HTMLTextAreaElement
				) {
					activeElement.select();
					return true;
				}
				return true;
			}
			if (key === "Shift+Enter") {
				active?.dispatchEvent(
					new KeyboardEvent("keydown", {
						key: "Enter",
						shiftKey: true,
						bubbles: true,
					}),
				);
				active?.dispatchEvent(
					new KeyboardEvent("keyup", {
						key: "Enter",
						shiftKey: true,
						bubbles: true,
					}),
				);
				return true;
			}
			return true;
		}
		case "keyboardType": {
			const active = document.activeElement;
			if (active instanceof Element) {
				setEditableValue(active, `${readInputValue(active)}${params.text || ""}`);
			}
			return true;
		}
		case "mouseMove":
			return true;
		case "mouseWheel":
			window.scrollBy({ left: params.deltaX || 0, top: params.deltaY || 0 });
			return true;
		case "mouseClick": {
			const target = document.elementFromPoint(params.x || 0, params.y || 0);
			dispatchClick(target);
			return true;
		}
		default:
			throw new Error(`unknown content message: ${message.method}`);
	}
}

chrome.runtime.onMessage.addListener(
	(message: ContentMessage, _sender: unknown, sendResponse: (value: any) => void) => {
		Promise.resolve(handleMessage(message))
			.then((result) => sendResponse({ ok: true, result }))
			.catch((error) =>
				sendResponse({
					ok: false,
					error: error instanceof Error ? error.message : String(error),
				}),
			);
		return true;
	},
);

postReady();
