import type { SelectorSnapshot, SelectorStage } from "@oneglanse/types";
import type { Page } from "playwright";
import {
	SNAPSHOT_STABILITY_POLL_MS,
	SNAPSHOT_STABILITY_TIMEOUT_MS,
	SNAPSHOT_STABLE_POLLS_REQUIRED,
} from "./constants.js";
import { buildPageKey, hashValue, normalizeSelectorForState } from "./utils.js";

export async function captureSelectorSnapshot(
	page: Page,
	stage: SelectorStage,
): Promise<SelectorSnapshot> {
	const snapshot = await page.evaluate((currentStage: SelectorStage) => {
		type Candidate = {
			selector: string;
			tag: string;
			role: string | null;
			type: string | null;
			top: number;
			height: number;
			depth: number;
			text: string;
			textLength: number;
			name: string | null;
			ariaLabel: string | null;
			placeholder: string | null;
			linkCount: number;
			buttonCount: number;
			inputLike: boolean;
			buttonLike: boolean;
			contentEditable: boolean;
			disabled: boolean;
			groupCount?: number;
			sampleItems?: Array<{
				text: string;
				linkCount: number;
				buttonCount: number;
			}>;
			fingerprint: string;
		};

		function escapeCss(value: string): string {
			if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
				return CSS.escape(value);
			}
			return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
		}

		function splitSemanticTokenSegments(token: string): string[] {
			return token
				.split(/[-_:]+/)
				.map((segment) => segment.trim())
				.filter(Boolean);
		}

		function looksLikeGeneratedSegment(segment: string): boolean {
			if (!segment) return false;
			if (/^\d+$/.test(segment)) return true;
			if (/^[a-f0-9]{8,}$/i.test(segment)) return true;
			return (
				segment.length >= 8 &&
				/[a-z]/i.test(segment) &&
				/\d/.test(segment) &&
				!/^([a-z]+|\d+|[a-z]+\d{1,2})$/i.test(segment)
			);
		}

		function hasGeneratedTokenShape(token: string): boolean {
			const segments = splitSemanticTokenSegments(token);
			if (segments.length === 0) return false;
			if (
				segments.length >= 4 &&
				segments.filter((segment) => segment.length <= 2).length >= 2
			) {
				return true;
			}
			if (segments.some((segment) => looksLikeGeneratedSegment(segment))) {
				return true;
			}
			const tail = segments.at(-1);
			return Boolean(tail && segments.length > 1 && /^\d+$/.test(tail));
		}

		function isStableSemanticToken(token: string): boolean {
			if (
				!token ||
				token.length > 40 ||
				/^(active|selected|disabled|hover|focus|open|show|hide)$/i.test(
					token,
				) ||
				/^\d+$/.test(token) ||
				/__[a-z0-9]{5,}$/i.test(token) ||
				hasGeneratedTokenShape(token)
			) {
				return false;
			}
			// Keep in sync with module-scope isStableSemanticToken in utils.ts.
			// Threshold ≤8: rejects build-hash tokens (APjFqb, jloFI) while keeping
			// library class names (CodeMirror=10, ProseMirror=11).
			if (
				/[A-Z]/.test(token) &&
				/[a-z]/.test(token) &&
				!/[-_]/.test(token) &&
				token.length <= 8
			) {
				return false;
			}
			if (token.includes("-") || token.includes("_") || token.includes(":")) {
				const segments = splitSemanticTokenSegments(token);
				return (
					segments.length > 0 &&
					segments.every(
						(segment) =>
							/^[a-z]+$/.test(segment) || /^[a-z]+\d{1,2}$/i.test(segment),
					)
				);
			}
			return /^[a-z]+$/.test(token) && token.length >= 4;
		}

		function isSemanticAttribute(attr: string): boolean {
			return /^(name|aria-label|placeholder|role|type|title)$/i.test(attr);
		}

		function isStableAttributeValue(attr: string, value: string): boolean {
			if (!value) return false;
			if (isSemanticAttribute(attr)) return true;
			if (attr === "class") {
				return value
					.split(/\s+/)
					.filter(Boolean)
					.every((token) => isStableSemanticToken(token));
			}
			if (attr === "id" || attr.startsWith("data-")) {
				return isStableSemanticToken(value);
			}
			return true;
		}

		function stableClassTokens(element: Element): string[] {
			return Array.from(element.classList)
				.map((token) => token.trim())
				.filter((token) => isStableSemanticToken(token))
				.slice(0, 4);
		}

		function elementText(element: Element): string {
			const raw =
				element instanceof HTMLElement
					? element.innerText || element.textContent || ""
					: element.textContent || "";
			return raw.replace(/\s+/g, " ").trim();
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

		function isOverlayLike(element: Element): boolean {
			if (!(element instanceof HTMLElement)) return false;
			const style = window.getComputedStyle(element);
			if (!["fixed", "sticky"].includes(style.position)) {
				return false;
			}
			const rect = element.getBoundingClientRect();
			if (rect.height <= 24 || rect.width <= 24) {
				return false;
			}
			if (
				rect.height > window.innerHeight * 0.85 &&
				rect.width > window.innerWidth * 0.85
			) {
				return true;
			}
			return (
				rect.top >= window.innerHeight * 0.6 ||
				rect.bottom <= window.innerHeight * 0.4
			);
		}

		function isInputLike(element: Element): boolean {
			return (
				element instanceof HTMLTextAreaElement ||
				(element instanceof HTMLInputElement &&
					!["hidden", "checkbox", "radio", "button", "submit"].includes(
						element.type,
					)) ||
				(element instanceof HTMLElement &&
					(element.isContentEditable ||
						element.getAttribute("contenteditable") === "true" ||
						element.getAttribute("role") === "textbox"))
			);
		}

		function isButtonLike(element: Element): boolean {
			return (
				element instanceof HTMLButtonElement ||
				(element instanceof HTMLInputElement &&
					["submit", "button"].includes(element.type)) ||
				element.getAttribute("role") === "button" ||
				element.tagName.toLowerCase() === "button"
			);
		}

		function isDisabled(element: Element): boolean {
			if (
				element instanceof HTMLButtonElement ||
				element instanceof HTMLInputElement
			) {
				return element.disabled;
			}
			return (
				element.getAttribute("aria-disabled") === "true" ||
				element.hasAttribute("disabled")
			);
		}

		function queryCount(root: ParentNode, selector: string): number {
			try {
				return root.querySelectorAll(selector).length;
			} catch {
				return Number.POSITIVE_INFINITY;
			}
		}

		// Returns true for IDs that are clearly human-authored and deployment-stable.
		// Any uppercase letter is treated as suspect here because mixed-case ids/classes
		// from modern build chains are a common source of selector churn.
		function isStableId(id: string): boolean {
			return isStableSemanticToken(id);
		}

		function buildSelector(element: Element): string {
			const tag = element.tagName.toLowerCase();

			// 1. Semantic attributes — stable across builds; encode meaning not layout.
			//    Tried before #id because ids are frequently auto-generated and break
			//    on recompiles.
			for (const attr of [
				"name",
				"aria-label",
				"placeholder",
				"data-testid",
				"data-test-id",
				"data-test",
				"data-qa",
				"data-cy",
			] as const) {
				const value = element.getAttribute(attr)?.trim();
				if (!value) continue;
				if (!isStableAttributeValue(attr, value)) continue;
				const selector = `${tag}[${attr}="${value.replace(/"/g, '\\"')}"]`;
				if (queryCount(document, selector) === 1) return selector;
			}

			// 2. role attribute
			const role = element.getAttribute("role")?.trim();
			if (role) {
				const selector = `${tag}[role="${role.replace(/"/g, '\\"')}"]`;
				if (queryCount(document, selector) === 1) return selector;
			}

			// 3. contenteditable
			if (
				element instanceof HTMLElement &&
				(element.isContentEditable ||
					element.getAttribute("contenteditable") === "true")
			) {
				const selector = `${tag}[contenteditable="true"]`;
				if (queryCount(document, selector) === 1) return selector;
			}

			// 4. #id — only when the id looks human-authored, not auto-generated.
			const id = element.getAttribute("id")?.trim();
			if (id && isStableId(id)) {
				const selector = `#${escapeCss(id)}`;
				if (queryCount(document, selector) === 1) return selector;
			}

			// 5. Stable class combination
			const classes = stableClassTokens(element);
			if (classes.length > 0) {
				for (let count = Math.min(2, classes.length); count >= 1; count -= 1) {
					const selector = `${tag}${classes
						.slice(0, count)
						.map((token) => `.${escapeCss(token)}`)
						.join("")}`;
					if (queryCount(document, selector) === 1) return selector;
				}
			}

			// 6. Positional path (last resort). Only stable ancestor ids/classes are
			//    allowed for anchoring; otherwise we fall back to plain tag segments.
			const segments: string[] = [];
			let current: Element | null = element;
			for (let depth = 0; current && depth < 5; depth += 1) {
				const currentTag = current.tagName.toLowerCase();
				const currentId = current.getAttribute("id")?.trim();
				if (currentId && isStableId(currentId)) {
					segments.unshift(`#${escapeCss(currentId)}`);
					break;
				}
				const siblings = current.parentElement
					? Array.from(current.parentElement.children).filter(
							(sibling) => sibling.tagName === current?.tagName,
						)
					: [];
				const siblingIndex =
					siblings.length > 1 ? siblings.indexOf(current) + 1 : 0;
				let segment = currentTag;
				const token = stableClassTokens(current)[0];
				if (token) {
					segment += `.${escapeCss(token)}`;
				}
				if (siblingIndex > 0) {
					segment += `:nth-of-type(${siblingIndex})`;
				}
				segments.unshift(segment);
				const selector = segments.join(" > ");
				if (queryCount(document, selector) === 1) return selector;
				current = current.parentElement;
			}

			return segments.join(" > ") || tag;
		}

		function toCandidate(
			element: Element,
			extra?: Partial<Candidate>,
		): Candidate {
			const text = elementText(element).slice(0, 280);
			const classes = stableClassTokens(element);
			const rect =
				element instanceof HTMLElement
					? element.getBoundingClientRect()
					: { top: 0, height: 0 };
			let depth = 0;
			let current: Element | null = element.parentElement;
			while (current && depth < 30) {
				depth += 1;
				current = current.parentElement;
			}
			return {
				selector: buildSelector(element),
				tag: element.tagName.toLowerCase(),
				role: element.getAttribute("role"),
				type:
					element instanceof HTMLInputElement
						? element.type || null
						: element.getAttribute("type"),
				top: Math.round(rect.top),
				height: Math.round(rect.height),
				depth,
				text,
				textLength: text.length,
				name: element.getAttribute("name"),
				ariaLabel: element.getAttribute("aria-label"),
				placeholder: element.getAttribute("placeholder"),
				linkCount: element.querySelectorAll("a[href]").length,
				buttonCount: element.querySelectorAll('button,[role="button"]').length,
				inputLike: isInputLike(element),
				buttonLike: isButtonLike(element),
				contentEditable:
					element instanceof HTMLElement &&
					(element.isContentEditable ||
						element.getAttribute("contenteditable") === "true"),
				disabled: isDisabled(element),
				fingerprint: [
					element.tagName.toLowerCase(),
					element.getAttribute("role") || "",
					element.getAttribute("type") || "",
					element.getAttribute("name") || "",
					element.getAttribute("aria-label") || "",
					element.getAttribute("placeholder") || "",
					classes.join("."),
					isInputLike(element) ? "input" : "",
					isButtonLike(element) ? "button" : "",
					element.querySelectorAll("a[href]").length > 0 ? "links" : "",
					element.querySelectorAll("img").length > 0 ? "images" : "",
				].join("|"),
				...extra,
			};
		}

		function limitAndDedupe(items: Candidate[], limit: number): Candidate[] {
			const seen = new Set<string>();
			const results: Candidate[] = [];
			for (const item of items) {
				if (seen.has(item.selector)) continue;
				seen.add(item.selector);
				results.push(item);
				if (results.length >= limit) break;
			}
			return results;
		}

		const visibleElements = Array.from(document.querySelectorAll("*")).filter(
			isVisible,
		);

		const editables = limitAndDedupe(
			visibleElements
				.filter((element) => isInputLike(element))
				.map((element) => toCandidate(element))
				.sort(
					(left, right) =>
						Number(right.contentEditable) - Number(left.contentEditable),
				),
			20,
		);

		const buttons = limitAndDedupe(
			visibleElements
				.filter((element) => isButtonLike(element))
				.map((element) => toCandidate(element))
				.sort((left, right) => {
					const leftScore =
						(left.textLength > 0 ? 3 : 0) +
						(left.ariaLabel ? 2 : 0) +
						(left.disabled ? -5 : 0);
					const rightScore =
						(right.textLength > 0 ? 3 : 0) +
						(right.ariaLabel ? 2 : 0) +
						(right.disabled ? -5 : 0);
					return rightScore - leftScore;
				}),
			40,
		);

		const minContentTextLength =
			currentStage === "compose" ? 40 : currentStage === "sources" ? 3 : 12;
		const content = limitAndDedupe(
			visibleElements
				.filter((element) => {
					const text = elementText(element);
					if (text.length < minContentTextLength || text.length > 8000) {
						return false;
					}
					if (isInputLike(element)) return false;
					if (currentStage !== "sources" && isButtonLike(element)) return false;
					if (isOverlayLike(element)) return false;
					if (
						element.querySelector(
							'[contenteditable="true"], textarea, input, [role="textbox"]',
						)
					) {
						return false;
					}
					return true;
				})
				.map((element) =>
					toCandidate(element, {
						text: elementText(element).slice(0, 400),
						textLength: elementText(element).length,
					}),
				)
				.sort((left, right) => right.textLength - left.textLength),
			currentStage === "compose" ? 12 : currentStage === "sources" ? 50 : 30,
		);

		const groups: Candidate[] = [];
		for (const parent of visibleElements) {
			if (isOverlayLike(parent)) continue;
			const children = Array.from(parent.children).filter(isVisible);
			if (children.length < 2 || children.length > 20) continue;

			const signatures = new Map<string, Element[]>();
			for (const child of children) {
				const key = [
					child.tagName.toLowerCase(),
					child.getAttribute("role") || "",
					stableClassTokens(child).slice(0, 2).join("."),
				].join("|");
				const list = signatures.get(key) ?? [];
				list.push(child);
				signatures.set(key, list);
			}

			for (const items of signatures.values()) {
				if (items.length < 2 || items.length > 12) continue;
				const sample = items[0];
				if (!sample) continue;
				const selector = buildSelector(sample);
				const parentSelector = buildSelector(parent);
				const sharedClasses = stableClassTokens(sample).slice(0, 2);
				const groupSelector =
					sharedClasses.length > 0
						? `${sample.tagName.toLowerCase()}${sharedClasses
								.map((token) => `.${escapeCss(token)}`)
								.join("")}`
						: `${parentSelector} > ${sample.tagName.toLowerCase()}`;

				const sampleItems = items.slice(0, 3).map((item) => ({
					text: elementText(item).slice(0, 180),
					linkCount: item.querySelectorAll("a[href]").length,
					buttonCount: item.querySelectorAll('button,[role="button"]').length,
				}));

				groups.push(
					toCandidate(sample, {
						selector: groupSelector,
						groupCount: items.length,
						sampleItems,
						text: sampleItems
							.map((item: { text: string }) => item.text)
							.join(" | ")
							.slice(0, 320),
						textLength: sampleItems.reduce(
							(sum: number, item: { text: string }) => sum + item.text.length,
							0,
						),
					}),
				);
			}
		}

		const dedupedGroups = limitAndDedupe(
			groups
				.filter((group) => (group.groupCount ?? 0) >= 2)
				.sort(
					(left, right) => (right.groupCount ?? 0) - (left.groupCount ?? 0),
				),
			currentStage === "response" ? 20 : currentStage === "sources" ? 20 : 12,
		);

		return {
			stage: currentStage,
			url: window.location.href,
			title: document.title || "",
			editables,
			buttons,
			content,
			groups: dedupedGroups,
		};
	}, stage);

	const pageKey = buildPageKey(snapshot.url);
	const fingerprintPayload = {
		stage,
		pageKey,
		// Deduplicated sorted sets of selector strings — the fingerprint identifies
		// WHICH selector patterns exist on this page/stage, not how many instances.
		// This keeps the fingerprint stable across prompts: turn 2 has 2 response
		// elements but the same selector as turn 1; button text changes during
		// streaming but the selector stays constant. Using sets prevents any
		// per-element or per-prompt unique value from churning the fingerprint and
		// triggering a redundant model call.
		editables: [...new Set(snapshot.editables.map((item) => normalizeSelectorForState(item.selector)))].sort(),
		buttons: [...new Set(snapshot.buttons.map((item) => normalizeSelectorForState(item.selector)))].sort(),
		content: [...new Set(snapshot.content.map((item) => normalizeSelectorForState(item.selector)))].sort(),
		groups: [...new Set(snapshot.groups.map((item) => normalizeSelectorForState(item.selector)))].sort(),
	};

	return {
		...snapshot,
		pageKey,
		fingerprint: hashValue(JSON.stringify(fingerprintPayload)),
	};
}

export function buildSnapshotStabilityKey(snapshot: SelectorSnapshot): string {
	return JSON.stringify({
		stage: snapshot.stage,
		url: snapshot.url,
		title: snapshot.title,
		pageKey: snapshot.pageKey,
		fingerprint: snapshot.fingerprint,
		editables: snapshot.editables.map((item) => item.selector),
		buttons: snapshot.buttons.map((item) => item.selector),
		content: snapshot.content.map((item) => item.selector),
		groups: snapshot.groups.map((item) => item.selector),
	});
}

export async function captureStableSelectorSnapshot(
	page: Page,
	stage: SelectorStage,
): Promise<SelectorSnapshot> {
	const deadline = Date.now() + SNAPSHOT_STABILITY_TIMEOUT_MS[stage];
	let latest = await captureSelectorSnapshot(page, stage);
	let stableKey = buildSnapshotStabilityKey(latest);
	let stablePolls = 1;

	while (
		Date.now() < deadline &&
		stablePolls < SNAPSHOT_STABLE_POLLS_REQUIRED
	) {
		await page.waitForTimeout(SNAPSHOT_STABILITY_POLL_MS);
		const next = await captureSelectorSnapshot(page, stage);
		const nextKey = buildSnapshotStabilityKey(next);
		latest = next;

		if (nextKey === stableKey) {
			stablePolls += 1;
			continue;
		}

		stableKey = nextKey;
		stablePolls = 1;
	}

	return latest;
}
