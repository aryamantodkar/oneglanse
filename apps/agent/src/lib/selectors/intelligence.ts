import { createHash } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NotFoundError, toErrorMessage } from "@oneglanse/errors";
import { chatgpt, getAgentAuthRootDir } from "@oneglanse/services";
import type { Provider, Source } from "@oneglanse/types";
import { getDomain, getFaviconUrls, logger } from "@oneglanse/utils";
import type { Locator, Page } from "playwright";
import { z } from "zod";

type SelectorStage = "compose" | "submit" | "response" | "sources";
type SelectorField =
	| "editor"
	| "submitButton"
	| "response"
	| "generationIndicator"
	| "sourcesButton"
	| "sourcePanel"
	| "sourceItem";

type SnapshotCandidate = {
	selector: string;
	tag: string;
	role: string | null;
	type: string | null;
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

type SelectorSnapshot = {
	stage: SelectorStage;
	url: string;
	title: string;
	pageKey: string;
	fingerprint: string;
	editables: SnapshotCandidate[];
	buttons: SnapshotCandidate[];
	content: SnapshotCandidate[];
	groups: SnapshotCandidate[];
};

type SelectorProfile = {
	version: number;
	provider: Provider;
	stage: SelectorStage;
	pageKey: string;
	fingerprint: string;
	model: string;
	createdAt: string;
	selectors: Record<SelectorField, string[]>;
};

type RawSource = {
	rawHref: string;
	title: string;
	citedText: string;
	imgSrc: string | null;
};

const SELECTOR_PROFILE_VERSION = 1;
const SELECTOR_MODEL = "gpt-4.1";
const MAX_SELECTORS_PER_FIELD = 5;
const FAILED_RESOLUTION_TTL_MS = 30_000;
const SNAPSHOT_STABILITY_POLL_MS = 250;
const SNAPSHOT_STABLE_POLLS_REQUIRED = 2;
const SNAPSHOT_STABILITY_TIMEOUT_MS: Record<SelectorStage, number> = {
	compose: 3_000,
	submit: 3_000,
	response: 8_000,
	sources: 5_000,
};
const STAGE_REQUIRED_FIELDS: Record<SelectorStage, SelectorField[]> = {
	compose: ["editor"],
	submit: ["submitButton"],
	response: ["response", "generationIndicator", "sourcesButton"],
	sources: ["sourcePanel", "sourceItem"],
};

const SelectorProfileSchema = z.object({
	editor: z.array(z.string()).default([]),
	submitButton: z.array(z.string()).default([]),
	response: z.array(z.string()).default([]),
	generationIndicator: z.array(z.string()).default([]),
	sourcesButton: z.array(z.string()).default([]),
	sourcePanel: z.array(z.string()).default([]),
	sourceItem: z.array(z.string()).default([]),
});

const profileCache = new Map<string, SelectorProfile>();
const pendingResolutions = new Map<string, Promise<SelectorProfile | null>>();
const failedResolutions = new Map<string, number>();

function defaultSelectorRecord(): Record<SelectorField, string[]> {
	return {
		editor: [],
		submitButton: [],
		response: [],
		generationIndicator: [],
		sourcesButton: [],
		sourcePanel: [],
		sourceItem: [],
	};
}

function getSelectorCacheDir(): string {
	return path.join(getAgentAuthRootDir(), "selector-cache");
}

function ensureSelectorCacheDir(): void {
	mkdirSync(getSelectorCacheDir(), { recursive: true });
}

function hashValue(input: string): string {
	return createHash("sha256").update(input).digest("hex");
}

function sanitizeFilename(input: string): string {
	return input.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "root";
}

function cacheKey(provider: Provider, stage: SelectorStage, fingerprint: string): string {
	return `${provider}:${stage}:${fingerprint}`;
}

function getProfileCacheFile(
	provider: Provider,
	stage: SelectorStage,
	pageKey: string,
	fingerprint: string,
): string {
	return path.join(
		getSelectorCacheDir(),
		provider,
		stage,
		`${sanitizeFilename(pageKey)}-${fingerprint}.json`,
	);
}

async function readCachedProfile(
	provider: Provider,
	stage: SelectorStage,
	pageKey: string,
	fingerprint: string,
): Promise<SelectorProfile | null> {
	const key = cacheKey(provider, stage, fingerprint);
	const memoized = profileCache.get(key);
	if (memoized) {
		return memoized;
	}

	const cacheFile = getProfileCacheFile(provider, stage, pageKey, fingerprint);
	if (!existsSync(cacheFile)) {
		return null;
	}

	try {
		const parsed = JSON.parse(await readFile(cacheFile, "utf8")) as SelectorProfile;
		if (
			parsed.version !== SELECTOR_PROFILE_VERSION ||
			parsed.provider !== provider ||
			parsed.stage !== stage
		) {
			return null;
		}
		profileCache.set(key, parsed);
		return parsed;
	} catch {
		return null;
	}
}

async function writeCachedProfile(profile: SelectorProfile): Promise<void> {
	ensureSelectorCacheDir();
	const key = cacheKey(profile.provider, profile.stage, profile.fingerprint);
	const cacheFile = getProfileCacheFile(
		profile.provider,
		profile.stage,
		profile.pageKey,
		profile.fingerprint,
	);
	mkdirSync(path.dirname(cacheFile), { recursive: true });
	await writeFile(cacheFile, JSON.stringify(profile, null, 2));
	profileCache.set(key, profile);
}

function compactSelectors(input: z.infer<typeof SelectorProfileSchema>): Record<SelectorField, string[]> {
	const base = defaultSelectorRecord();
	for (const field of Object.keys(base) as SelectorField[]) {
		base[field] = [...new Set((input[field] ?? []).map((value) => value.trim()).filter(Boolean))].slice(
			0,
			MAX_SELECTORS_PER_FIELD,
		);
	}
	return base;
}

function buildPageKey(rawUrl: string): string {
	try {
		const url = new URL(rawUrl);
		const segments = url.pathname
			.split("/")
			.filter(Boolean)
			.slice(0, 2)
			.map((segment) =>
				segment
					.replace(/[0-9a-f]{8,}/gi, ":id")
					.replace(/\d+/g, ":n"),
			);
		return `${url.hostname}/${segments.join("/")}`.replace(/\/$/, "");
	} catch {
		return "unknown";
	}
}

function hasRequiredSelectors(
	stage: SelectorStage,
	selectors: Record<SelectorField, string[]>,
): boolean {
	if (stage === "response") {
		return selectors.response.length > 0;
	}

	if (stage === "sources") {
		return selectors.sourceItem.length > 0;
	}

	return STAGE_REQUIRED_FIELDS[stage].every((field) => selectors[field].length > 0);
}

async function captureSelectorSnapshot(
	page: Page,
	stage: SelectorStage,
): Promise<SelectorSnapshot> {
	const snapshot = await page.evaluate((currentStage: SelectorStage) => {
		type Candidate = {
			selector: string;
			tag: string;
			role: string | null;
			type: string | null;
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

		function stableClassTokens(element: Element): string[] {
			return Array.from(element.classList)
				.map((token) => token.trim())
				.filter(
					(token) =>
						token &&
						token.length <= 40 &&
						!/^(active|selected|disabled|hover|focus|open|show|hide)$/i.test(token) &&
						!/^\d+$/.test(token) &&
						!/__[a-z0-9]{5,}$/i.test(token),
				)
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
			if (element instanceof HTMLButtonElement || element instanceof HTMLInputElement) {
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

		function buildSelector(element: Element): string {
			const tag = element.tagName.toLowerCase();
			const id = element.getAttribute("id")?.trim();
			if (id) {
				const selector = `#${escapeCss(id)}`;
				if (queryCount(document, selector) === 1) return selector;
			}

			for (const attr of [
				"data-testid",
				"data-test-id",
				"data-test",
				"data-qa",
				"data-cy",
				"name",
				"aria-label",
				"placeholder",
			] as const) {
				const value = element.getAttribute(attr)?.trim();
				if (!value) continue;
				const selector = `${tag}[${attr}="${value.replace(/"/g, '\\"')}"]`;
				if (queryCount(document, selector) === 1) return selector;
			}

			const role = element.getAttribute("role")?.trim();
			if (role) {
				const selector = `${tag}[role="${role.replace(/"/g, '\\"')}"]`;
				if (queryCount(document, selector) === 1) return selector;
			}

			if (
				element instanceof HTMLElement &&
				(element.isContentEditable ||
					element.getAttribute("contenteditable") === "true")
			) {
				const selector = `${tag}[contenteditable="true"]`;
				if (queryCount(document, selector) === 1) return selector;
			}

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

			const segments: string[] = [];
			let current: Element | null = element;
			for (let depth = 0; current && depth < 5; depth += 1) {
				const currentTag = current.tagName.toLowerCase();
				const currentId = current.getAttribute("id")?.trim();
				if (currentId) {
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

		function toCandidate(element: Element, extra?: Partial<Candidate>): Candidate {
			const text = elementText(element).slice(0, 280);
			const classes = stableClassTokens(element);
			return {
				selector: buildSelector(element),
				tag: element.tagName.toLowerCase(),
				role: element.getAttribute("role"),
				type:
					element instanceof HTMLInputElement
						? element.type || null
						: element.getAttribute("type"),
				text,
				textLength: text.length,
				name: element.getAttribute("name"),
				ariaLabel: element.getAttribute("aria-label"),
				placeholder: element.getAttribute("placeholder"),
				linkCount: element.querySelectorAll('a[href]').length,
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
					element.querySelectorAll('a[href]').length > 0 ? "links" : "",
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

		const visibleElements = Array.from(document.querySelectorAll("*")).filter(isVisible);

		const editables = limitAndDedupe(
			visibleElements
				.filter((element) => isInputLike(element))
				.map((element) => toCandidate(element))
				.sort((left, right) => Number(right.contentEditable) - Number(left.contentEditable)),
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

		const minContentTextLength = currentStage === "compose" ? 40 : 12;
		const content = limitAndDedupe(
			visibleElements
				.filter((element) => {
					const text = elementText(element);
					if (text.length < minContentTextLength || text.length > 8000) {
						return false;
					}
					if (isInputLike(element) || isButtonLike(element)) return false;
					if (element.querySelector('[contenteditable="true"], textarea, input, [role="textbox"]')) {
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
			currentStage === "compose" ? 12 : 30,
		);

		const groups: Candidate[] = [];
		for (const parent of visibleElements) {
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
					linkCount: item.querySelectorAll('a[href]').length,
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
				.sort((left, right) => (right.groupCount ?? 0) - (left.groupCount ?? 0)),
			currentStage === "response" ? 20 : 12,
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
		editables: snapshot.editables.map((item) => item.fingerprint),
		buttons: snapshot.buttons.map((item) => item.fingerprint),
		content: snapshot.content.map((item) => [
			item.selector.replace(/:nth-of-type\(\d+\)/g, ":nth-of-type"),
			item.linkCount,
			item.buttonCount,
			Math.min(6, Math.floor(item.textLength / 80)),
		]),
		groups: snapshot.groups.map((item) => [
			item.selector.replace(/:nth-of-type\(\d+\)/g, ":nth-of-type"),
			item.groupCount ?? 0,
			item.linkCount,
			item.buttonCount,
		]),
	};

	return {
		...snapshot,
		pageKey,
		fingerprint: hashValue(JSON.stringify(fingerprintPayload)),
	};
}

function buildSnapshotStabilityKey(snapshot: SelectorSnapshot): string {
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

async function captureStableSelectorSnapshot(
	page: Page,
	stage: SelectorStage,
): Promise<SelectorSnapshot> {
	const deadline = Date.now() + SNAPSHOT_STABILITY_TIMEOUT_MS[stage];
	let latest = await captureSelectorSnapshot(page, stage);
	let stableKey = buildSnapshotStabilityKey(latest);
	let stablePolls = 1;

	while (Date.now() < deadline && stablePolls < SNAPSHOT_STABLE_POLLS_REQUIRED) {
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

function buildSystemPrompt(stage: SelectorStage): string {
	const shared =
		"You map DOM candidates to durable CSS selectors. " +
		"Return only JSON. " +
		"Use only selectors already present in the snapshot. " +
		"Return empty arrays for fields that are not visible yet. " +
		"Never invent selectors or explain your answer. " +
		"Prefer id, data-testid, name, aria-label, role, contenteditable, or stable classes. " +
		"Avoid positional selectors unless necessary.";

	if (stage === "compose") {
		return (
			shared +
			" Return editor only. " +
			"Choose the main chat composer, not search, sidebar, or settings controls."
		);
	}

	if (stage === "submit") {
		return (
			shared +
			" Return submitButton only. " +
			"Assume text has already been typed. " +
			"Choose the visible control that submits the current prompt."
		);
	}

	if (stage === "response") {
		return (
			shared +
			" Return response, generationIndicator, and sourcesButton. " +
			"response must target the latest model answer container, not page wrappers. " +
			"generationIndicator must target the visible streaming, stop, or in-progress UI that disappears when the answer is complete. " +
			"If no live generation UI is visible, return an empty array for generationIndicator. " +
			"sourcesButton must target the citations or sources control for that answer, or be empty if unavailable."
		);
	}

	return (
		shared +
		" Return sourcePanel and sourceItem. " +
		"Assume the sources UI is already open. " +
		"sourcePanel should target the visible citations container when one exists. " +
		"sourceItem should target the repeated source cards, rows, or anchors inside that UI."
	);
}

async function resolveProfileWithModel(
	provider: Provider,
	stage: SelectorStage,
	snapshot: SelectorSnapshot,
): Promise<SelectorProfile | null> {
	const response = await chatgpt.responses.create({
		model: SELECTOR_MODEL,
		temperature: 0,
		input: [
			{
				role: "system",
				content: buildSystemPrompt(stage),
			},
			{
				role: "user",
				content: JSON.stringify({
					provider,
					stage,
					url: snapshot.url,
					title: snapshot.title,
					editables: snapshot.editables,
					buttons: snapshot.buttons,
					content: snapshot.content,
					groups: snapshot.groups,
					requiredFields: STAGE_REQUIRED_FIELDS[stage],
				}),
			},
		],
		text: {
			format: { type: "json_object" },
		},
	});

	const output = response.output_text?.trim();
	if (!output) {
		return null;
	}

	const parsed = SelectorProfileSchema.safeParse(JSON.parse(output));
	if (!parsed.success) {
		throw new Error(parsed.error.message);
	}

	return {
		version: SELECTOR_PROFILE_VERSION,
		provider,
		stage,
		pageKey: snapshot.pageKey,
		fingerprint: snapshot.fingerprint,
		model: SELECTOR_MODEL,
		createdAt: new Date().toISOString(),
		selectors: compactSelectors(parsed.data),
	};
}

async function validateVisibleSelectors(
	page: Page,
	selectors: string[],
	options?: {
		requireEditable?: boolean;
		requireEnabled?: boolean;
	},
): Promise<string[]> {
	const valid: string[] = [];

	for (const selector of selectors) {
		const locator = page.locator(selector);
		const count = await locator.count().catch(() => 0);
		if (count === 0) continue;
		for (let index = 0; index < count; index += 1) {
			const candidate = locator.nth(index);
			const visible = await candidate.isVisible().catch(() => false);
			if (!visible) continue;
			if (options?.requireEnabled) {
				const enabled = await candidate.isEnabled().catch(() => false);
				if (!enabled) continue;
			}
			if (options?.requireEditable) {
				const state = await candidate.getEditableState().catch(() => null);
				if (
					!(
						state?.connected &&
						state.visible &&
						state.editable &&
						state.enabled &&
						state.acceptsTextInput
					)
				) {
					continue;
				}
			}
			valid.push(selector);
			break;
		}
	}

	return [...new Set(valid)];
}

async function validateProfile(
	page: Page,
	profile: SelectorProfile,
): Promise<SelectorProfile | null> {
	const selectors = defaultSelectorRecord();

	selectors.editor = await validateVisibleSelectors(page, profile.selectors.editor, {
		requireEditable: true,
	});
	selectors.submitButton = await validateVisibleSelectors(
		page,
		profile.selectors.submitButton,
		{ requireEnabled: true },
	);
	selectors.response = await validateVisibleSelectors(page, profile.selectors.response);
	selectors.generationIndicator = await validateVisibleSelectors(
		page,
		profile.selectors.generationIndicator,
	);
	selectors.sourcesButton = await validateVisibleSelectors(
		page,
		profile.selectors.sourcesButton,
	);
	selectors.sourcePanel = await validateVisibleSelectors(
		page,
		profile.selectors.sourcePanel,
	);
	selectors.sourceItem = await validateVisibleSelectors(
		page,
		profile.selectors.sourceItem,
	);

	if (!hasRequiredSelectors(profile.stage, selectors)) {
		return null;
	}

	return {
		...profile,
		selectors,
	};
}

function isSnapshotReady(snapshot: SelectorSnapshot): boolean {
	if (snapshot.stage === "compose") {
		return snapshot.editables.length > 0;
	}

	if (snapshot.stage === "submit") {
		return snapshot.buttons.length > 0;
	}

	if (snapshot.stage === "sources") {
		return snapshot.groups.length > 0 || snapshot.content.length > 0;
	}

	return (
		snapshot.content.length > 0 ||
		snapshot.groups.length > 0 ||
		snapshot.buttons.length > 0
	);
}

export async function getSelectorProfile(
	page: Page,
	provider: Provider,
	stage: SelectorStage,
	options?: {
		allowModel?: boolean;
		forceRefresh?: boolean;
	},
): Promise<SelectorProfile | null> {
	const snapshot = await captureStableSelectorSnapshot(page, stage);
	const key = cacheKey(provider, stage, snapshot.fingerprint);

	if (!options?.forceRefresh) {
		const cached =
			(await readCachedProfile(
				provider,
				stage,
				snapshot.pageKey,
				snapshot.fingerprint,
			)) ?? null;
		if (cached) {
			return (await validateProfile(page, cached)) ?? null;
		}
	}

	if (!isSnapshotReady(snapshot)) {
		return null;
	}

	const lastFailure = failedResolutions.get(key);
	if (
		!options?.forceRefresh &&
		lastFailure &&
		Date.now() - lastFailure < FAILED_RESOLUTION_TTL_MS
	) {
		return null;
	}

	if (options?.allowModel === false) {
		return null;
	}

	const pending = pendingResolutions.get(key);
	if (pending) {
		return pending;
	}

	const resolution = (async () => {
		try {
			const generated = await resolveProfileWithModel(provider, stage, snapshot);
			if (!generated) {
				return null;
			}

			const validated = await validateProfile(page, generated);
			if (!validated) {
				failedResolutions.set(key, Date.now());
				return null;
			}

			await writeCachedProfile(validated);
			return validated;
		} catch (error) {
			logger.warn(
				`selector resolution failed (${provider}/${stage}): ${toErrorMessage(error)}`,
			);
			failedResolutions.set(key, Date.now());
			return null;
		} finally {
			pendingResolutions.delete(key);
		}
	})();

	pendingResolutions.set(key, resolution);
	return resolution;
}

export async function waitForSelectorProfile(
	page: Page,
	provider: Provider,
	stage: SelectorStage,
	timeoutMs: number,
): Promise<SelectorProfile> {
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		const profile = await getSelectorProfile(page, provider, stage);
		if (profile) {
			return profile;
		}

		await page.waitForTimeout(250);
	}

	throw new NotFoundError(`${stage} selectors for ${provider}`);
}

export async function primeSelectorProfile(
	page: Page,
	provider: Provider,
	stage: SelectorStage,
): Promise<void> {
	await getSelectorProfile(page, provider, stage).catch(() => null);
}

export async function findResolvedEditorCandidate(
	page: Page,
	provider: Provider,
): Promise<{ locator: Locator; selector: string } | null> {
	const profile = await getSelectorProfile(page, provider, "compose").catch(
		() => null,
	);
	const selectors = profile?.selectors.editor ?? [];
	for (const selector of selectors) {
		const locator = page.locator(selector);
		const count = await locator.count().catch(() => 0);
		for (let index = 0; index < count; index += 1) {
			const candidate = locator.nth(index);
			const state = await candidate.getEditableState().catch(() => null);
			if (
				!(
					state?.connected &&
					state.visible &&
					state.editable &&
					state.enabled &&
					state.acceptsTextInput
				)
			) {
				continue;
			}
			return { locator: candidate, selector };
		}
	}
	return null;
}

export async function findResolvedSendButton(
	page: Page,
	provider: Provider,
): Promise<Locator | null> {
	const profile = await getSelectorProfile(page, provider, "submit").catch(
		() => null,
	);
	const selectors = profile?.selectors.submitButton ?? [];
	for (const selector of selectors) {
		const buttons = page.locator(selector);
		const count = await buttons.count().catch(() => 0);
		for (let index = 0; index < count; index += 1) {
			const button = buttons.nth(index);
			const visible = await button.isVisible().catch(() => false);
			const enabled = await button.isEnabled().catch(() => false);
			if (visible && enabled) {
				return button;
			}
		}
	}
	return null;
}

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

			let target: HTMLElement | null = null;
			for (const selector of selectors) {
				try {
					const matches = Array.from(document.querySelectorAll(selector)).filter(
						isVisible,
					) as HTMLElement[];
					target = matches.at(-1) ?? null;
					if (target) break;
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
			]) {
				try {
					for (const element of Array.from(clone.querySelectorAll(selector))) {
						element.remove();
					}
				} catch {}
			}

			return {
				html: clone.innerHTML.trim(),
				text: textOf(clone),
			};
		},
		{ selectors: responseSelectors, exclude: excludeSelectors },
	);
}

export async function getResolvedResponseText(
	page: Page,
	provider: Provider,
): Promise<string> {
	const profile = await getSelectorProfile(page, provider, "response", {
		allowModel: false,
	}).catch(() => null);
	const payload = await extractResponsePayload(
		page,
		profile?.selectors.response ?? [],
		[],
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
	const excludeSelectors = [
		...(profile?.selectors.sourcesButton ?? []),
		...(profile?.selectors.sourceItem ?? []),
		...(profile?.selectors.sourcePanel ?? []),
	];
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

async function findSourcesButtonLocator(
	page: Page,
	provider: Provider,
): Promise<Locator | null> {
	const profile = await getSelectorProfile(page, provider, "response", {
		allowModel: false,
	}).catch(() => null);
	for (const selector of profile?.selectors.sourcesButton ?? []) {
		const locator = page.locator(selector);
		const count = await locator.count().catch(() => 0);
		for (let index = count - 1; index >= 0; index -= 1) {
			const button = locator.nth(index);
			const visible = await button.isVisible().catch(() => false);
			if (visible) {
				return button;
			}
		}
	}
	return null;
}

async function openSourcesPanelIfNeeded(
	page: Page,
	provider: Provider,
): Promise<boolean> {
	const button = await findSourcesButtonLocator(page, provider);
	if (!button) {
		return false;
	}
	await button.scrollIntoViewIfNeeded().catch(() => {});
	const clicked = await button.click({ timeout: 3000 }).then(() => true).catch(
		() => false,
	);
	if (!clicked) {
		await button.dispatchClick().catch(() => {});
	}
	await page.waitForTimeout(500);
	return true;
}

async function extractRawSourcesWithSelectors(
	page: Page,
	sourcePanelSelectors: string[],
	sourceItemSelectors: string[],
): Promise<RawSource[]> {
	return await page.evaluate(
		({
			panels,
			items,
		}: {
			panels: string[];
			items: string[];
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

			function resolveRoot(): ParentNode {
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
				return document;
			}

			const root = resolveRoot();
			let rawItems: Element[] = [];
			for (const selector of items) {
				try {
					rawItems.push(...Array.from(root.querySelectorAll(selector)));
				} catch {}
			}

			const dedupedItems = Array.from(new Set(rawItems)).filter(isVisible);
			const results: RawSource[] = [];

			for (const item of dedupedItems) {
				const anchor =
					lastVisible(
						Array.from(item.querySelectorAll('a[href]')) as HTMLAnchorElement[],
					) ||
					(item instanceof HTMLAnchorElement ? item : null);
				if (!anchor?.href) continue;

				let url = "";
				try {
					url = new URL(anchor.href, window.location.origin).toString().split("#")[0] || "";
				} catch {
					continue;
				}
				if (!url) continue;

				const title =
					item.querySelector("h1,h2,h3,h4,strong,b,[title]")?.textContent?.trim() ||
					anchor.getAttribute("title")?.trim() ||
					anchor.textContent?.trim() ||
					url;

				const snippetCandidates = Array.from(
					item.querySelectorAll("p, span, div, small"),
				)
					.map((element) => textOf(element))
					.filter(
						(text) =>
							text.length > 30 &&
							text !== title &&
							!text.includes(url),
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
		{ panels: sourcePanelSelectors, items: sourceItemSelectors },
	);
}

export async function extractResolvedSources(
	page: Page,
	provider: Provider,
): Promise<Source[]> {
	const responseProfile = await getSelectorProfile(page, provider, "response", {
		allowModel: false,
	}).catch(() => null);
	if (!responseProfile?.selectors.sourcesButton.length) {
		return [];
	}

	const opened = await openSourcesPanelIfNeeded(page, provider);
	if (!opened) {
		return [];
	}

	const sourceProfile = await waitForSelectorProfile(
		page,
		provider,
		"sources",
		8_000,
	).catch(() => null);
	if (!sourceProfile?.selectors.sourceItem.length) {
		return [];
	}

	const rawSources = await extractRawSourcesWithSelectors(
		page,
		sourceProfile?.selectors.sourcePanel ?? [],
		sourceProfile?.selectors.sourceItem ?? [],
	);

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

export async function requireEditorCandidate(
	page: Page,
	provider: Provider,
): Promise<{ locator: Locator; selector: string }> {
	return (
		(await findResolvedEditorCandidate(page, provider)) ??
		(() => {
			throw new NotFoundError(`editor for ${provider}`);
		})()
	);
}
