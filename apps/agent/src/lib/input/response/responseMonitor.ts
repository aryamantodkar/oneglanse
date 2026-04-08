import type { Page } from "playwright";

const RESPONSE_MONITOR_KEY = "__oneglanseResponseMonitor";

export type ResponseProbeSnapshot = {
	text: string;
	textLength: number;
	candidateCount: number;
	anchorFound: boolean;
	started: boolean;
	firstRelevantMutationAt: number | null;
	lastRelevantMutationAt: number | null;
	quietForMs: number | null;
	relevantMutationCount: number;
};

type BrowserMonitorState = {
	started: boolean;
	firstRelevantMutationAt: number | null;
	lastRelevantMutationAt: number | null;
	relevantMutationCount: number;
};

type BrowserMonitor = {
	state: BrowserMonitorState;
	observer: MutationObserver;
	anchorEditor: HTMLElement | null;
	anchorForm: Element | null;
	candidateRoots: Set<HTMLElement>;
	mutationMarks: WeakMap<HTMLElement, number>;
	capturedHtml: string | null;
};

export async function resetResponseMonitor(page: Page): Promise<void> {
	await page.evaluate((monitorKey: string) => {
		const globalWindow = window as typeof window & {
			[key: string]: BrowserMonitor | undefined;
		};

		function normalizeText(value: string): string {
			return value
				.replace(/\u200b/g, "")
				.replace(/\r/g, "")
				.replace(/[ \t]+\n/g, "\n")
				.replace(/\n{3,}/g, "\n\n")
				.replace(/[ \t]{2,}/g, " ")
				.trim();
		}

		function isVisible(element: Element | null): element is HTMLElement {
			if (!(element instanceof HTMLElement)) return false;
			if (!element.isConnected) return false;
			const style = window.getComputedStyle(element);
			if (
				style.display === "none" ||
				style.visibility === "hidden" ||
				style.opacity === "0" ||
				element.hidden ||
				element.getAttribute("aria-hidden") === "true"
			) {
				return false;
			}
			const rect = element.getBoundingClientRect();
			return rect.width >= 8 && rect.height >= 8;
		}

		function isOverlayLike(element: HTMLElement): boolean {
			const style = window.getComputedStyle(element);
			if (!["fixed", "sticky"].includes(style.position)) {
				return false;
			}
			const rect = element.getBoundingClientRect();
			if (rect.width < 80 || rect.height < 24) {
				return false;
			}
			return (
				(rect.width > window.innerWidth * 0.9 &&
					rect.height > window.innerHeight * 0.7) ||
				rect.top >= window.innerHeight * 0.6
			);
		}

		function isEditable(element: Element | null): element is HTMLElement {
			return Boolean(
				element instanceof HTMLTextAreaElement ||
					(element instanceof HTMLInputElement &&
						!["hidden", "submit", "button", "checkbox", "radio"].includes(
							element.type,
						)) ||
					(element instanceof HTMLElement &&
						(element.isContentEditable ||
							element.getAttribute("contenteditable") === "true" ||
							element.getAttribute("role") === "textbox")),
			);
		}

		function closestEditable(node: Node | null): HTMLElement | null {
			let current: Node | null = node;
			while (current) {
				if (current instanceof HTMLElement && isEditable(current) && isVisible(current)) {
					return current;
				}
				current = current.parentNode;
			}
			return null;
		}

		function findAnchorEditor(): HTMLElement | null {
			const active = closestEditable(document.activeElement);
			if (active) {
				return active;
			}

			const candidates = Array.from(
				document.querySelectorAll(
					'textarea, input:not([type="hidden"]):not([type="submit"]):not([type="button"]), [contenteditable="true"], [role="textbox"]',
				),
			).filter(
				(element): element is HTMLElement => isEditable(element) && isVisible(element),
			);

			candidates.sort((left, right) => {
				const leftRect = left.getBoundingClientRect();
				const rightRect = right.getBoundingClientRect();
				return rightRect.bottom - leftRect.bottom;
			});

			return candidates[0] ?? null;
		}

		function elementFromNode(node: Node | null): HTMLElement | null {
			if (!node) return null;
			if (node instanceof HTMLElement) return node;
			if (node instanceof Text) {
				return node.parentElement;
			}
			return null;
		}

		function isIgnoredRegion(element: HTMLElement): boolean {
			return Boolean(
				element.closest(
					"nav,header,footer,aside,dialog,[role='navigation'],[role='banner'],[role='contentinfo']",
				),
			);
		}

		function isInEditorRegion(
			element: HTMLElement,
			editor: HTMLElement | null,
			editorForm: Element | null,
		): boolean {
			if (!editor) return false;
			if (element === editor || element.contains(editor) || editor.contains(element)) {
				return true;
			}
			if (editorForm && editorForm.contains(element)) {
				return true;
			}
			return false;
		}

		function blockCount(element: HTMLElement): number {
			return element.querySelectorAll(
				"p,li,pre,table,blockquote,article,section,main,ul,ol,h1,h2,h3,h4,h5,h6",
			).length;
		}

		function normalizeCandidateText(element: HTMLElement): string {
			return normalizeText(element.innerText || element.textContent || "");
		}

		function hasEditableDescendant(element: HTMLElement): boolean {
			return Boolean(
				element.querySelector(
					'textarea, input:not([type="hidden"]), [contenteditable="true"], [role="textbox"]',
				),
			);
		}

		function visibleChildrenOf(element: HTMLElement): HTMLElement[] {
			return Array.from(element.children).filter(
				(child): child is HTMLElement =>
					child instanceof HTMLElement && isVisible(child),
			);
		}

		function isCandidateRoot(
			element: HTMLElement,
			editor: HTMLElement | null,
			editorForm: Element | null,
		): boolean {
			if (!isVisible(element)) return false;
			if (isInEditorRegion(element, editor, editorForm)) return false;
			if (isIgnoredRegion(element)) return false;
			if (isOverlayLike(element)) return false;
			if (hasEditableDescendant(element)) return false;

			const rect = element.getBoundingClientRect();
			if (rect.bottom < -120 || rect.top > window.innerHeight + 120) {
				return false;
			}
			if (rect.width < 80) {
				return false;
			}

			const text = normalizeCandidateText(element);
			if (text.length < 20 || text.length > 60_000) {
				return false;
			}

			const buttons = element.querySelectorAll(
				"button,input,textarea,[role='button'],[role='textbox']",
			).length;
			const links = element.querySelectorAll("a[href]").length;
			const blocks = blockCount(element);
			const words = text.split(/\s+/).filter(Boolean).length;
			const children = visibleChildrenOf(element);
			// A child that holds ≥90% of the text AND the element has multiple total children.
			// "Multiple total children" catches:
			//   • sr-only siblings (e.g. ChatGPT's <h4 class="sr-only">ChatGPT said:</h4>
			//     is a 1×1px invisible sibling, so totalChildren=2, visibleChildren=1)
			//   • thinking+response containers (Claude's thinking block is a fully visible
			//     sibling with ~3% of the text, so totalChildren=2, dominantChild=97%)
			// We intentionally do NOT apply this to pure single-child wrappers
			// (totalChildren=1) because those are legitimate content containers.
			const totalChildCount = element.children.length;
			const veryDominantChild = totalChildCount > 1
				? children.find((child) => {
					const childText = normalizeCandidateText(child);
					return childText.length >= text.length * 0.9;
				})
				: undefined;
			const dominantChild = veryDominantChild ?? children.find((child) => {
				const childText = normalizeCandidateText(child);
				return childText.length >= Math.max(80, text.length * 0.7);
			});

			if (buttons >= 8 && text.length < 500) return false;
			if (links >= 16 && blocks <= 1 && text.length < 700) return false;
			if (words < 6 && blocks === 0 && text.length < 40) return false;
			if (veryDominantChild) return false;
			if (dominantChild && children.length >= 2 && blocks <= 1) return false;

			return true;
		}

		function candidateRootsForNode(
			node: HTMLElement,
			editor: HTMLElement | null,
			editorForm: Element | null,
		): HTMLElement[] {
			const roots: HTMLElement[] = [];
			let current: HTMLElement | null = node;
			let depth = 0;

			while (current && depth < 8) {
				if (isCandidateRoot(current, editor, editorForm)) {
					roots.push(current);
				}
				if (
					current === document.body ||
					current.closest("main, article, section, [role='main'], [role='article']")
				) {
					if (roots.length > 0) {
						break;
					}
				}
				current = current.parentElement;
				depth += 1;
			}

			return roots;
		}

		function relevantRootsForMutation(
			mutation: MutationRecord,
			editor: HTMLElement | null,
			editorForm: Element | null,
		): HTMLElement[] {
			const mutationNodes = [
				elementFromNode(mutation.target),
				...Array.from(mutation.addedNodes, elementFromNode),
				...Array.from(mutation.removedNodes, elementFromNode),
			].filter((node): node is HTMLElement => node instanceof HTMLElement);

			const roots: HTMLElement[] = [];
			const seen = new Set<HTMLElement>();
			for (const node of mutationNodes) {
				for (const root of candidateRootsForNode(node, editor, editorForm)) {
					if (seen.has(root)) continue;
					seen.add(root);
					roots.push(root);
				}
			}

			return roots;
		}

		globalWindow[monitorKey]?.observer.disconnect();

		const state: BrowserMonitorState = {
			started: false,
			firstRelevantMutationAt: null,
			lastRelevantMutationAt: null,
			relevantMutationCount: 0,
		};
		const anchorEditor = findAnchorEditor();
		const anchorForm = anchorEditor?.closest("form") ?? null;
		const candidateRoots = new Set<HTMLElement>();
		const mutationMarks = new WeakMap<HTMLElement, number>();

		const observer = new MutationObserver((mutations) => {
			const roots = mutations.flatMap((mutation) =>
				relevantRootsForMutation(mutation, anchorEditor, anchorForm),
			);
			if (roots.length === 0) {
				return;
			}

			const now = Date.now();
			if (!state.started) {
				state.started = true;
				state.firstRelevantMutationAt = now;
			}
			state.lastRelevantMutationAt = now;
			state.relevantMutationCount += roots.length;
			for (const root of roots) {
				candidateRoots.add(root);
				mutationMarks.set(root, now);
			}
		});

		observer.observe(document.body, {
			subtree: true,
			childList: true,
			characterData: true,
		});

		globalWindow[monitorKey] = {
			state,
			observer,
			anchorEditor,
			anchorForm,
			candidateRoots,
			mutationMarks,
			capturedHtml: null,
		};
	}, RESPONSE_MONITOR_KEY);
}

export async function readResponseProbe(
	page: Page,
): Promise<ResponseProbeSnapshot> {
	return await page.evaluate((monitorKey: string) => {
		const globalWindow = window as typeof window & {
			[key: string]: BrowserMonitor | undefined;
		};

		function normalizeText(value: string): string {
			return value
				.replace(/\u200b/g, "")
				.replace(/\r/g, "")
				.replace(/[ \t]+\n/g, "\n")
				.replace(/\n{3,}/g, "\n\n")
				.replace(/[ \t]{2,}/g, " ")
				.trim();
		}

		function isVisible(element: Element | null): element is HTMLElement {
			if (!(element instanceof HTMLElement)) return false;
			if (!element.isConnected) return false;
			const style = window.getComputedStyle(element);
			if (
				style.display === "none" ||
				style.visibility === "hidden" ||
				style.opacity === "0" ||
				element.hidden ||
				element.getAttribute("aria-hidden") === "true"
			) {
				return false;
			}
			const rect = element.getBoundingClientRect();
			return rect.width >= 8 && rect.height >= 8;
		}

		function blockCount(element: HTMLElement): number {
			return element.querySelectorAll(
				"p,li,pre,table,blockquote,ul,ol,h1,h2,h3,h4,h5,h6",
			).length;
		}

		function isOverlayLike(element: HTMLElement): boolean {
			const style = window.getComputedStyle(element);
			if (!["fixed", "sticky"].includes(style.position)) {
				return false;
			}
			const rect = element.getBoundingClientRect();
			if (rect.width < 80 || rect.height < 24) {
				return false;
			}
			return (
				(rect.width > window.innerWidth * 0.9 &&
					rect.height > window.innerHeight * 0.7) ||
				rect.top >= window.innerHeight * 0.6
			);
		}

		function isIgnoredRegion(element: HTMLElement): boolean {
			return Boolean(
				element.closest(
					"nav,header,footer,aside,dialog,[role='navigation'],[role='banner'],[role='contentinfo']",
				),
			);
		}

		const monitor = globalWindow[monitorKey];
		const editor = monitor?.anchorEditor ?? null;
		const editorForm = monitor?.anchorForm ?? null;
		const candidates: Array<{ score: number; text: string; el: HTMLElement }> = [];
		const roots = Array.from(monitor?.candidateRoots ?? []).filter(
			(element): element is HTMLElement =>
				element instanceof HTMLElement && element.isConnected,
		);

		for (const element of roots) {
			if (!isVisible(element)) continue;
			if (element === document.body) continue;
			if (isIgnoredRegion(element)) continue;
			if (isOverlayLike(element)) continue;
			if (
				editor &&
				(element === editor ||
					element.contains(editor) ||
					editor.contains(element) ||
					(editorForm && editorForm.contains(element)))
			) {
				continue;
			}

			const rect = element.getBoundingClientRect();
			if (rect.bottom < -120 || rect.top > window.innerHeight + 120) continue;
			if (rect.width < 80) continue;

			const text = normalizeText(element.innerText || element.textContent || "");
			if (text.length < 20 || text.length > 60_000) continue;

			const visibleChildren = Array.from(element.children).filter(
				(child): child is HTMLElement =>
					child instanceof HTMLElement && isVisible(child),
			);
			const totalChildCount = element.children.length;
			const veryDominantChild = totalChildCount > 1
				? visibleChildren.find((child) => {
					const childText = normalizeText(child.innerText || child.textContent || "");
					return childText.length >= text.length * 0.9;
				})
				: undefined;
			const dominantChild = veryDominantChild ?? visibleChildren.find((child) => {
				const childText = normalizeText(child.innerText || child.textContent || "");
				return childText.length >= Math.max(80, text.length * 0.7);
			});
			if (veryDominantChild) continue;
			if (dominantChild && visibleChildren.length >= 2 && blockCount(element) <= 1) continue;

			const buttons = element.querySelectorAll(
				"button,input,textarea,[role='button'],[role='textbox']",
			).length;
			const links = element.querySelectorAll("a[href]").length;
			const blocks = blockCount(element);
			const words = text.split(/\s+/).filter(Boolean).length;
			const childCount = visibleChildren.length;
			const lastMutationAt = monitor?.mutationMarks.get(element) ?? 0;
			const mutationRecencyScore =
				lastMutationAt > 0 ? Math.max(0, 6000 - (Date.now() - lastMutationAt)) : 0;
			const sourceCardPenalty =
				blocks === 0 &&
				text.length < 400 &&
				/^[\w.-]+\.(com|org|edu|gov|net|io|ai|co|uk|ca|de|fr|jp|in)\b/i.test(
					text.trim(),
				)
					? 2000
					: 0;

			if (buttons >= 8 && text.length < 500) continue;
			if (links >= 16 && blocks <= 1 && text.length < 700) continue;
			if (words < 6 && blocks === 0 && text.length < 40) continue;

			const score =
				Math.min(text.length, 5000) * 0.6 +
				Math.min(blocks, 20) * 180 +
				mutationRecencyScore +
				Math.max(0, window.innerHeight - Math.abs(rect.bottom - window.innerHeight)) *
					0.15 -
				buttons * 90 -
				links * 28 -
				Math.max(childCount - 12, 0) * 80 -
				sourceCardPenalty;

			candidates.push({ score, text, el: element });
		}

		// Descendants filter: eliminate outer containers that have a more specific
		// scored descendant covering ≥85% of their text. This generically handles:
		//   • full-conversation wrappers containing only the response element
		//   • thinking+response parent containers (tc=1 wrappers)
		//   • any other outer shell that scored but has a better-targeted inner element
		const filtered = candidates.filter(({ el, text: t }) =>
			!candidates.some(
				({ el: other, text: otherText }) =>
					el !== other && el.contains(other) && otherText.length >= t.length * 0.85,
			),
		);
		filtered.sort((left, right) => right.score - left.score);

		const best = filtered[0];
		const state = monitor?.state;
		const quietForMs =
			state?.lastRelevantMutationAt != null
				? Date.now() - state.lastRelevantMutationAt
				: null;

		return {
			text: best?.text ?? "",
			textLength: best?.text.length ?? 0,
			candidateCount: candidates.length,
			anchorFound: Boolean(editor),
			started: Boolean(state?.started),
			firstRelevantMutationAt: state?.firstRelevantMutationAt ?? null,
			lastRelevantMutationAt: state?.lastRelevantMutationAt ?? null,
			quietForMs,
			relevantMutationCount: state?.relevantMutationCount ?? 0,
		} satisfies ResponseProbeSnapshot;
	}, RESPONSE_MONITOR_KEY);
}

export async function disposeResponseMonitor(page: Page): Promise<void> {
	await page.evaluate((monitorKey: string) => {
		const globalWindow = window as typeof window & {
			[key: string]: BrowserMonitor | undefined;
		};
		const monitor = globalWindow[monitorKey];
		if (!monitor) return;

		// Capture the best candidate's HTML NOW — while elements are still connected
		// and mutation timestamps are fresh. This avoids:
		//  1. Stale timestamps (mutationRecencyScore would be 0 after disposal)
		//  2. Disconnected elements after page navigation (Perplexity, Gemini)
		//  3. Scoring divergence with readResponseProbe (same formula below)
		function isVisible(element: Element | null): element is HTMLElement {
			if (!(element instanceof HTMLElement)) return false;
			if (!element.isConnected) return false;
			const style = window.getComputedStyle(element);
			if (
				style.display === "none" ||
				style.visibility === "hidden" ||
				style.opacity === "0" ||
				element.hidden ||
				element.getAttribute("aria-hidden") === "true"
			) {
				return false;
			}
			const rect = element.getBoundingClientRect();
			return rect.width >= 8 && rect.height >= 8;
		}

		function blockCount(element: HTMLElement): number {
			return element.querySelectorAll(
				"p,li,pre,table,blockquote,ul,ol,h1,h2,h3,h4,h5,h6",
			).length;
		}

		function normalizeText(value: string): string {
			return value
				.replace(/\u200b/g, "")
				.replace(/\r/g, "")
				.replace(/[ \t]+\n/g, "\n")
				.replace(/\n{3,}/g, "\n\n")
				.replace(/[ \t]{2,}/g, " ")
				.trim();
		}

		function isIgnoredRegion(element: HTMLElement): boolean {
			return Boolean(
				element.closest(
					"nav,header,footer,aside,dialog,[role='navigation'],[role='banner'],[role='contentinfo']",
				),
			);
		}

		function isOverlayLike(element: HTMLElement): boolean {
			const style = window.getComputedStyle(element);
			if (!["fixed", "sticky"].includes(style.position)) return false;
			const rect = element.getBoundingClientRect();
			if (rect.width < 80 || rect.height < 24) return false;
			return (
				(rect.width > window.innerWidth * 0.9 && rect.height > window.innerHeight * 0.7) ||
				rect.top >= window.innerHeight * 0.6
			);
		}

		const editor = monitor.anchorEditor;
		const editorForm = monitor.anchorForm;
		const scored: Array<{ el: HTMLElement; score: number; textLen: number }> = [];

		for (const element of monitor.candidateRoots) {
			if (!(element instanceof HTMLElement) || !element.isConnected) continue;
			if (!isVisible(element)) continue;
			if (element === document.body) continue;
			if (isIgnoredRegion(element)) continue;
			if (isOverlayLike(element)) continue;
			if (
				editor &&
				(element === editor ||
					element.contains(editor) ||
					editor.contains(element) ||
					(editorForm && editorForm.contains(element)))
			) {
				continue;
			}

			const rect = element.getBoundingClientRect();
			if (rect.bottom < -120 || rect.top > window.innerHeight + 120) continue;
			if (rect.width < 80) continue;

			const text = normalizeText(element.innerText || element.textContent || "");
			if (text.length < 20 || text.length > 60_000) continue;

			const buttons = element.querySelectorAll(
				"button,input,textarea,[role='button'],[role='textbox']",
			).length;
			const links = element.querySelectorAll("a[href]").length;
			const blocks = blockCount(element);
			const words = text.split(/\s+/).filter(Boolean).length;
			const visibleChildren = Array.from(element.children).filter(
				(child): child is HTMLElement => child instanceof HTMLElement && isVisible(child),
			);
			const childCount = visibleChildren.length;
			const totalChildCount = element.children.length;
			const veryDominantChild = totalChildCount > 1
				? visibleChildren.find((child) => {
					const childText = normalizeText(child.innerText || child.textContent || "");
					return childText.length >= text.length * 0.9;
				})
				: undefined;
			const dominantChild = veryDominantChild ?? visibleChildren.find((child) => {
				const childText = normalizeText(child.innerText || child.textContent || "");
				return childText.length >= Math.max(80, text.length * 0.7);
			});

			if (buttons >= 8 && text.length < 500) continue;
			if (links >= 16 && blocks <= 1 && text.length < 700) continue;
			if (words < 6 && blocks === 0 && text.length < 40) continue;
			if (veryDominantChild) continue;
			if (dominantChild && childCount >= 2 && blocks <= 1) continue;

			const lastMutationAt = monitor.mutationMarks.get(element) ?? 0;
			const mutationRecencyScore =
				lastMutationAt > 0 ? Math.max(0, 6000 - (Date.now() - lastMutationAt)) : 0;
			const sourceCardPenalty =
				blocks === 0 &&
				text.length < 400 &&
				/^[\w.-]+\.(com|org|edu|gov|net|io|ai|co|uk|ca|de|fr|jp|in)\b/i.test(text.trim())
					? 2000
					: 0;

			const score =
				Math.min(text.length, 5000) * 0.6 +
				Math.min(blocks, 20) * 180 +
				mutationRecencyScore +
				Math.max(0, window.innerHeight - Math.abs(rect.bottom - window.innerHeight)) * 0.15 -
				buttons * 90 -
				links * 28 -
				Math.max(childCount - 12, 0) * 80 -
				sourceCardPenalty;

			scored.push({ el: element, score, textLen: text.length });
		}

		// Descendants filter: eliminate outer containers that have a more specific
		// scored descendant covering ≥85% of their text. Same logic as readResponseProbe.
		const filteredScored = scored.filter(({ el, textLen }) =>
			!scored.some(
				({ el: other, textLen: otherLen }) =>
					el !== other && el.contains(other) && otherLen >= textLen * 0.85,
			),
		);
		filteredScored.sort((a, b) => b.score - a.score);
		const best = filteredScored[0]?.el ?? null;

		if (best) {
			const clone = (best as HTMLElement).cloneNode(true) as HTMLElement;
			for (const sel of ["script", "style", "svg", "button", "noscript", "iframe", "sup"]) {
				for (const el of Array.from(clone.querySelectorAll(sel))) {
					el.remove();
				}
			}
			// Strip standalone citation-badge anchors (no whitespace, sole text in parent)
			for (const anchor of Array.from(clone.querySelectorAll("a[href]")) as HTMLAnchorElement[]) {
				const parent = anchor.parentElement;
				if (!parent) continue;
				const parentText = ((parent as HTMLElement).innerText || parent.textContent || "").trim();
				const anchorText = ((anchor as HTMLElement).innerText || anchor.textContent || "").trim();
				if (parentText === anchorText && anchorText.length > 0 && !/\s/.test(anchorText)) {
					anchor.remove();
				}
			}
			monitor.capturedHtml = clone.innerHTML.trim();
		}

		monitor.observer.disconnect();
	}, RESPONSE_MONITOR_KEY).catch(() => null);
}

/**
 * Returns the HTML captured during disposeResponseMonitor — scored with the same
 * formula as readResponseProbe, while elements were still connected and timestamps
 * were fresh. Falls back to empty string so callers can use selector-based extraction.
 */
export async function extractResponseHtml(page: Page): Promise<string> {
	return await page.evaluate((monitorKey: string) => {
		const globalWindow = window as typeof window & {
			[key: string]: BrowserMonitor | undefined;
		};
		return globalWindow[monitorKey]?.capturedHtml ?? "";
	}, RESPONSE_MONITOR_KEY).catch(() => "");
}
