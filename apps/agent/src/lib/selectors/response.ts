import type { Provider } from "@oneglanse/types";
import type { Page } from "playwright";
import { getSelectorProfile } from "./profile.js";

const RESPONSE_MONITOR_KEY = "__oneglanseResponseMonitor";

async function extractResponsePayload(
	page: Page,
	responseSelectors: string[],
	excludeSelectors: string[],
): Promise<{ html: string; text: string }> {
	return await page.evaluate(
		({
			selectors,
			exclude,
			responseMonitorKey,
		}: {
			selectors: string[];
			exclude: string[];
			responseMonitorKey: string;
		}) => {
			const globalWindow = window as typeof window & {
				[key: string]: {
					candidateRoots?: Set<HTMLElement>;
					mutationMarks?: WeakMap<HTMLElement, number>;
				} | undefined;
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
					.replace(/\r/g, "")
					.replace(/\u200b/g, "")
					.replace(/[ \t]+\n/g, "\n")
					.replace(/\n{3,}/g, "\n\n")
					.replace(/[ \t]{2,}/g, " ")
					.trim();
			}

			function hasEditableDescendant(element: Element): boolean {
				return Boolean(
					element.querySelector(
						'textarea, input:not([type="hidden"]), [contenteditable="true"], [role="textbox"]',
					),
				);
			}

			function isInternalAnchor(anchor: HTMLAnchorElement): boolean {
				try {
					const url = new URL(anchor.href, window.location.origin);
					return url.hostname === window.location.hostname;
				} catch {
					return false;
				}
			}

			function blockCountOf(element: Element): number {
				return element.querySelectorAll(
					"p,li,pre,table,blockquote,h1,h2,h3,h4,h5,h6,ul,ol",
				).length;
			}

			function trackedRoots(): HTMLElement[] {
				return Array.from(
					globalWindow[responseMonitorKey]?.candidateRoots ?? [],
				).filter(
					(element): element is HTMLElement =>
						element instanceof HTMLElement &&
						element.isConnected &&
						isVisible(element),
				);
			}

			function matchScore(
				element: HTMLElement,
				order: number,
				roots: HTMLElement[],
			): number {
				const textLength = textOf(element).length;
				if (textLength < 60) {
					return Number.NEGATIVE_INFINITY;
				}

				const buttons = Array.from(
					element.querySelectorAll("button,[role='button']"),
				).filter(isVisible).length;
				const anchors = Array.from(
					element.querySelectorAll("a[href]"),
				).filter(
					(node): node is HTMLAnchorElement =>
						node instanceof HTMLAnchorElement && isVisible(node),
				);
				const internalAnchorCount = anchors.filter(isInternalAnchor).length;
				const blocks = blockCountOf(element);
				const directRoot = roots.includes(element);
				const rootDescendant = roots.some((root) => element.contains(root));
				const latestRoot = roots[0] ?? null;
				const latestRootAffinity =
					latestRoot && (element === latestRoot || element.contains(latestRoot))
						? 3_000
						: 0;

				let score =
					order * 1_000 +
					Math.min(textLength, 8_000) * 0.25 +
					Math.min(blocks, 20) * 120 -
					buttons * 70 -
					internalAnchorCount * 50;

				if (directRoot) {
					score += 4_000;
				} else if (rootDescendant) {
					score += 2_500;
				}
				score += latestRootAffinity;

				return score;
			}

			function pruneSimplePeripheralChildren(root: HTMLElement): void {
				const children = Array.from(root.children).filter(
					(child): child is HTMLElement => child instanceof HTMLElement,
				);
				if (children.length < 2) {
					return;
				}

				const shouldDrop = (child: HTMLElement): boolean => {
					const textLength = textOf(child).length;
					if (textLength === 0 || textLength > 120) {
						return false;
					}
					if (blockCountOf(child) > 0) {
						return false;
					}
					const interactiveCount = child.querySelectorAll(
						"a,button,[role='button']",
					).length;
					return interactiveCount <= 2;
				};

				const first = children[0];
				const last = children.at(-1);
				if (first && shouldDrop(first)) {
					first.remove();
				}
				if (last && last !== first && shouldDrop(last)) {
					last.remove();
				}
			}

			const roots = trackedRoots();
			let target: HTMLElement | null = null;
			let bestTargetScore = Number.NEGATIVE_INFINITY;
			for (const selector of selectors) {
				try {
					const matches = Array.from(
						document.querySelectorAll(selector),
					).filter(isVisible) as HTMLElement[];
					if (matches.length === 0) {
						continue;
					}
					for (const [order, match] of matches.entries()) {
						if (hasEditableDescendant(match)) {
							continue;
						}
						const score = matchScore(match, order, roots);
						if (score > bestTargetScore) {
							target = match;
							bestTargetScore = score;
						}
					}
				} catch {}
			}

			if (!target) {
				return { html: "", text: "" };
			}

			const clone = target.cloneNode(true) as HTMLElement;
			for (const selector of [
				...exclude,
				"script",
				"style",
				"svg",
				"button",
				"noscript",
				"iframe",
				// Strip superscript citation refs (e.g. [1], [2]) — they are captured
				// in source extraction and should not appear in the response prose.
				"sup",
			]) {
				try {
					for (const element of Array.from(clone.querySelectorAll(selector))) {
						element.remove();
					}
				} catch {}
			}

			// Strip standalone citation-badge anchors: an <a> whose parent's full
			// text equals the anchor's own text (the anchor IS the only content),
			// AND the text has no whitespace (not a multi-word phrase).
			// This removes domain-name citation badges like "site.com" that bleed
			// into response prose without stripping legitimate inline product-name
			// links like "Next.js" that are embedded within surrounding text.
			for (const anchor of Array.from(
				clone.querySelectorAll("a[href]"),
			) as HTMLAnchorElement[]) {
				const parent = anchor.parentElement;
				if (!parent) continue;
				const parentText = (
					(parent as HTMLElement).innerText || parent.textContent || ""
				).trim();
				const anchorText = (
					(anchor as HTMLElement).innerText || anchor.textContent || ""
				).trim();
				if (
					parentText === anchorText &&
					anchorText.length > 0 &&
					!/\s/.test(anchorText)
				) {
					anchor.remove();
				}
			}

			pruneSimplePeripheralChildren(clone);

			return {
				html: clone.innerHTML.trim(),
				text: textOf(clone),
			};
		},
		{
			selectors: responseSelectors,
			exclude: excludeSelectors,
			responseMonitorKey: RESPONSE_MONITOR_KEY,
		},
	);
}

async function getResponseExcludeSelectors(
	page: Page,
	provider: Provider,
): Promise<string[]> {
	const [responseProfile, sourcesProfile] = await Promise.all([
		getSelectorProfile(page, provider, "response", {
			allowModel: false,
		}).catch(() => null),
		getSelectorProfile(page, provider, "sources", {
			allowModel: false,
		}).catch(() => null),
	]);

	return [
		...(responseProfile?.selectors.sourcesButton ?? []),
		...(responseProfile?.selectors.sourceItem ?? []),
		...(responseProfile?.selectors.sourcePanel ?? []),
		...(sourcesProfile?.selectors.sourceItem ?? []),
		...(sourcesProfile?.selectors.sourcePanel ?? []),
	];
}

export async function getResolvedResponseText(
	page: Page,
	provider: Provider,
): Promise<string> {
	const profile = await getSelectorProfile(page, provider, "response", {
		allowModel: false,
	}).catch(() => null);
	const excludeSelectors = await getResponseExcludeSelectors(page, provider);
	const payload = await extractResponsePayload(
		page,
		profile?.selectors.response ?? [],
		excludeSelectors,
	);
	return payload.text;
}

export async function extractResolvedResponseHtml(
	page: Page,
	provider: Provider,
): Promise<string> {
	const profile = await getSelectorProfile(page, provider, "response", {
		allowModel: false,
	}).catch(() => null);
	const excludeSelectors = await getResponseExcludeSelectors(page, provider);
	const payload = await extractResponsePayload(
		page,
		profile?.selectors.response ?? [],
		excludeSelectors,
	);
	return payload.html;
}

