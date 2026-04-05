import type { Provider } from "@oneglanse/types";
import type { Page } from "playwright";
import { getSelectorProfile } from "./profile.js";

async function extractResponsePayload(
	page: Page,
	responseSelectors: string[],
	excludeSelectors: string[],
): Promise<{ html: string; text: string }> {
	return await page.evaluate(
		({
			selectors,
			exclude,
		}: {
			selectors: string[];
			exclude: string[];
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

			function textOf(element: Element): string {
				return ((element as HTMLElement).innerText || element.textContent || "")
					.replace(/\s+/g, " ")
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

			function isSubstantiveNode(element: HTMLElement): boolean {
				const textLength = textOf(element).length;
				if (textLength >= 220) {
					return true;
				}

				const blockCount = blockCountOf(element);
				if (blockCount >= 2) {
					return true;
				}

				return Boolean(
					element.querySelector(
						"pre,table,blockquote,ul,ol,p + p,h1,h2,h3,h4,h5,h6 + p",
					),
				);
			}

			function isAuxiliaryNode(element: HTMLElement): boolean {
				if (
					["P", "LI", "PRE", "TABLE", "BLOCKQUOTE", "UL", "OL"].includes(
						element.tagName,
					) ||
					/^H[1-6]$/.test(element.tagName)
				) {
					return false;
				}

				const textLength = textOf(element).length;
				if (textLength === 0 || textLength > 120) {
					return false;
				}

				if (
					element.getAttribute("role") === "status" ||
					element.hasAttribute("aria-live")
				) {
					return true;
				}

				if (blockCountOf(element) > 0) {
					return false;
				}

				const interactiveCount = element.querySelectorAll(
					"a,button,[role='button']",
				).length;
				if (interactiveCount > 2) {
					return false;
				}

				const childElements = Array.from(element.children).filter(
					(child): child is HTMLElement => child instanceof HTMLElement,
				);
				if (childElements.some((child) => isSubstantiveNode(child))) {
					return false;
				}

				const wordCount = textOf(element).split(/\s+/).filter(Boolean).length;

				return wordCount <= 12 && childElements.length <= 4;
			}

			function answerScoreOf(
				element: HTMLElement,
				order: number,
				maxTop: number,
			): number {
				const text = textOf(element);
				const length = text.length;
				if (length < 60) {
					return Number.NEGATIVE_INFINITY;
				}

				const anchors = Array.from(
					element.querySelectorAll("a[href]"),
				).filter(
					(node): node is HTMLAnchorElement =>
						node instanceof HTMLAnchorElement && isVisible(node),
				);
				const internalAnchorCount = anchors.filter(isInternalAnchor).length;
				const externalAnchorCount = anchors.length - internalAnchorCount;
				const buttons = Array.from(
					element.querySelectorAll("button,[role='button']"),
				).filter(isVisible).length;
				const blockCount = blockCountOf(element);
				const codeLikeCount = element.querySelectorAll(
					"pre,code,table,blockquote,ul,ol",
				).length;
				const lines = text
					.split(/\n+/)
					.map((line) => line.trim())
					.filter(Boolean);
				const shortLineRatio =
					lines.length > 0
						? lines.filter((line) => line.length <= 120).length / lines.length
						: 0;
				const sentenceCount = text
					.split(/(?<=[.!?])\s+/)
					.map((part) => part.trim())
					.filter((part) => part.length >= 20).length;
				const rect = element.getBoundingClientRect();
				const topWeight = maxTop > 0 ? rect.top / maxTop : 0;

				let score =
					Math.min(length, 8_000) * 0.55 +
					blockCount * 130 +
					codeLikeCount * 70 +
					sentenceCount * 40 +
					topWeight * 320 +
					order * 6 -
					internalAnchorCount * 70 -
					externalAnchorCount * 30 -
					buttons * 55;

				if (
					internalAnchorCount >= 4 &&
					internalAnchorCount >= Math.ceil(anchors.length * 0.5) &&
					blockCount <= 1 &&
					codeLikeCount === 0
				) {
					score -= 700;
				}

				if (anchors.length >= 10 && blockCount <= 1 && codeLikeCount === 0) {
					score -= 650;
				}

				if (
					lines.length >= 6 &&
					shortLineRatio >= 0.75 &&
					sentenceCount <= 2 &&
					codeLikeCount === 0
				) {
					score -= 420;
				}

				if (buttons >= 8 && anchors.length >= 8 && codeLikeCount === 0) {
					score -= 750;
				}

				return score;
			}

			function prunePeripheralChildren(root: HTMLElement): void {
				const directChildren = Array.from(root.children).filter(
					(child): child is HTMLElement => child instanceof HTMLElement,
				);
				if (directChildren.length === 0) {
					return;
				}

				const firstSubstantiveIndex =
					directChildren.findIndex(isSubstantiveNode);
				if (firstSubstantiveIndex > 0) {
					for (const child of directChildren.slice(0, firstSubstantiveIndex)) {
						if (isAuxiliaryNode(child)) {
							child.remove();
						}
					}
				}

				const lastSubstantiveIndex = [...directChildren]
					.reverse()
					.findIndex(isSubstantiveNode);
				if (lastSubstantiveIndex >= 0) {
					const lastIndex = directChildren.length - 1 - lastSubstantiveIndex;
					for (const child of directChildren.slice(lastIndex + 1)) {
						if (isAuxiliaryNode(child)) {
							child.remove();
						}
					}
				}

				for (const child of Array.from(root.querySelectorAll("*"))) {
					if (!(child instanceof HTMLElement) || !child.isConnected) {
						continue;
					}
					if (isAuxiliaryNode(child)) {
						const parent = child.parentElement;
						const siblings = parent
							? Array.from(parent.children).filter(
									(node): node is HTMLElement => node instanceof HTMLElement,
								)
							: [];
						const childIndex = siblings.indexOf(child);
						const hasNearbySubstantiveSibling = siblings.some(
							(node, index) =>
								index !== childIndex &&
								Math.abs(index - childIndex) <= 1 &&
								isSubstantiveNode(node),
						);
						if (hasNearbySubstantiveSibling) {
							child.remove();
						}
					}
				}
			}

			function pruneLeadingPreambleBlocks(root: HTMLElement): void {
				const containers = [
					root,
					...Array.from(root.querySelectorAll("div, section, article")),
				].filter(
					(element): element is HTMLElement => element instanceof HTMLElement,
				);

				for (const container of containers) {
					const children = Array.from(container.children).filter(
						(child): child is HTMLElement => child instanceof HTMLElement,
					);
					if (children.length < 2) {
						continue;
					}

					const meaningfulChildren = children.filter(
						(child) => textOf(child).length > 0,
					);
					if (meaningfulChildren.length < 2) {
						continue;
					}

					const candidate = meaningfulChildren[0];
					const next = meaningfulChildren[1];
					if (!candidate || !next) {
						continue;
					}
					const candidateText = textOf(candidate);
					const remainingTextLength = meaningfulChildren
						.slice(1)
						.map((child) => textOf(child).length)
						.reduce((sum, length) => sum + length, 0);

					const candidateLooksLikePreamble =
						["P", "DIV"].includes(candidate.tagName) &&
						candidateText.length >= 24 &&
						candidateText.length <= 220 &&
						!candidate.querySelector("ul, ol, table, pre, blockquote") &&
						remainingTextLength >= candidateText.length * 2 &&
						(/[.:]$/.test(candidateText) ||
							next.tagName === "HR" ||
							/^H[1-6]$/.test(next.tagName) ||
							next.querySelector("h1, h2, h3, h4, h5, h6, ul, ol, table"));

					if (candidateLooksLikePreamble) {
						candidate.remove();
					}
				}
			}

			function refineResponseRoot(root: HTMLElement): HTMLElement {
				const rootTextLength = textOf(root).length;
				if (rootTextLength < 80) {
					return root;
				}

				const descendants = Array.from(root.querySelectorAll("*")).filter(
					(node): node is HTMLElement =>
						node instanceof HTMLElement &&
						isVisible(node) &&
						!hasEditableDescendant(node),
				);

				let best = root;
				const rootRect = root.getBoundingClientRect();
				const rootBlockCount = blockCountOf(root);
				const rootInteractiveCount = root.querySelectorAll(
					"a,button,[role='button']",
				).length;
				const rootHasChrome =
					rootInteractiveCount >= 8 && rootBlockCount <= 2;
				let bestScore = answerScoreOf(root, 0, rootRect.top || 1);
				const minLength = Math.max(
					160,
					Math.floor(rootTextLength * (rootHasChrome ? 0.35 : 0.55)),
				);

				for (const [order, node] of descendants.entries()) {
					const length = textOf(node).length;
					if (length < minLength) continue;
					if (length > rootTextLength) continue;
					if (length >= rootTextLength * 0.95) continue;
					if (isAuxiliaryNode(node)) continue;

					let depth = 0;
					let current: HTMLElement | null = node;
					while (current && current !== root) {
						depth += 1;
						current = current.parentElement;
					}

					const blockCount = node.querySelectorAll(
						"p,li,pre,table,blockquote,h1,h2,h3,h4,h5,h6",
					).length;
					const childTextContainers = Array.from(node.children).filter(
						(child) =>
							child instanceof HTMLElement &&
							isVisible(child) &&
							!hasEditableDescendant(child) &&
							textOf(child).length >= 60,
					).length;
					const structureScore = blockCount + childTextContainers;
					if (structureScore < 2 && length < rootTextLength * 0.45) {
						continue;
					}

					const rect = node.getBoundingClientRect();
					const relativeTop = Math.max(0, rect.top - rootRect.top);
					const score =
						answerScoreOf(node, order, Math.max(rootRect.bottom, rect.top, 1)) +
						depth * 60 +
						structureScore * 50 -
						// Penalise candidates that start below the root's top — they cut
						// off leading content (headings, intro paragraphs) from long
						// multi-section answers. Previously this was a bonus, which caused
						// the scorer to prefer a mid-answer subtree over the full root.
						relativeTop * 0.15;

					if (score > bestScore) {
						best = node;
						bestScore = score;
					}
				}

				if (best !== root) {
					const bestTextLength = textOf(best).length;
					const rootStructuredBlockCount = root.querySelectorAll(
						"p,li,pre,table,blockquote,h1,h2,h3,h4,h5,h6,ul,ol",
					).length;
					const bestStructuredBlockCount = best.querySelectorAll(
						"p,li,pre,table,blockquote,h1,h2,h3,h4,h5,h6,ul,ol",
					).length;
					const rootHeadingCount = root.querySelectorAll("h1,h2,h3,h4,h5,h6").length;
					const bestHeadingCount = best.querySelectorAll("h1,h2,h3,h4,h5,h6").length;
					const rootLooksStructured =
						rootBlockCount >= 3 || rootTextLength >= 600;
					if (
						rootLooksStructured &&
						(bestTextLength < rootTextLength * (rootHasChrome ? 0.45 : 0.75) ||
							bestStructuredBlockCount <
								rootStructuredBlockCount * (rootHasChrome ? 0.35 : 0.65) ||
							// Require the chosen subtree to retain at least 75% of the
					// root's headings. Gemini/Claude long answers often have multiple
					// H2/H3 section headings — a subtree missing more than 25% of
					// them is dropping whole sections and should be rejected.
					bestHeadingCount < rootHeadingCount * 0.75)
					) {
						return root;
					}
				}

				return best;
			}

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
					const maxTop = matches.reduce(
						(max, match) => Math.max(max, match.getBoundingClientRect().top),
						1,
					);
					for (const [order, match] of matches.entries()) {
						const score = answerScoreOf(match, order, maxTop);
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

			target = refineResponseRoot(target);

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

			prunePeripheralChildren(clone);
			pruneLeadingPreambleBlocks(clone);

			return {
				html: clone.innerHTML.trim(),
				text: textOf(clone),
			};
		},
		{ selectors: responseSelectors, exclude: excludeSelectors },
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

export async function isResolvedResponseGenerating(
	page: Page,
	provider: Provider,
): Promise<boolean> {
	const profile = await getSelectorProfile(page, provider, "response", {
		allowModel: false,
	}).catch(() => null);
	const selectors = profile?.selectors.generationIndicator ?? [];
	if (selectors.length === 0) {
		return false;
	}

	for (const selector of selectors) {
		const visible = await page
			.locator(selector)
			.isVisible()
			.catch(() => false);
		if (visible) {
			return true;
		}
	}
	return false;
}
