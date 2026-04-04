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
				let bestScore = Number.NEGATIVE_INFINITY;
				const rootRect = root.getBoundingClientRect();
				const minLength = Math.max(120, Math.floor(rootTextLength * 0.18));

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
					const sizePenalty = length / rootTextLength;
					const interactiveCount = node.querySelectorAll(
						"a,button,[role='button']",
					).length;
					const score =
						depth * 120 +
						structureScore * 60 +
						relativeTop * 0.5 +
						order * 4 -
						sizePenalty * 300 -
						interactiveCount * 35;

					if (score > bestScore) {
						best = node;
						bestScore = score;
					}
				}

				return best;
			}

			let target: HTMLElement | null = null;
			for (const selector of selectors) {
				try {
					const matches = Array.from(
						document.querySelectorAll(selector),
					).filter(isVisible) as HTMLElement[];
					if (matches.length === 0) {
						continue;
					}
					// The page is scrolled to the bottom before extraction — the last
					// visible match is always the latest (bottommost) response.
					target = matches.at(-1) ?? null;
					if (target) break;
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
			]) {
				try {
					for (const element of Array.from(clone.querySelectorAll(selector))) {
						element.remove();
					}
				} catch {}
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
