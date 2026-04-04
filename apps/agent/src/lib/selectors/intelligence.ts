import { createHash } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { readFile, readdir, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
	ExternalServiceError,
	NotFoundError,
	toErrorMessage,
} from "@oneglanse/errors";
import { chatgpt } from "@oneglanse/services";
import type { Provider, Source } from "@oneglanse/types";
import {
	DEFAULT_MIN_RESPONSE_CHARS,
	PROVIDER_MIN_RESPONSE_CHARS,
	getDomain,
	getFaviconUrls,
	logger,
} from "@oneglanse/utils";
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

type ProviderSelectorCache = {
	version: number;
	provider: Provider;
	updatedAt: string;
	profiles: SelectorProfile[];
};

type RawSource = {
	rawHref: string;
	title: string;
	citedText: string;
	imgSrc: string | null;
};

type PageFailureCooldown = {
	expiresAt: number;
	stateKey: string;
};

type ModelCandidate = Pick<
	SnapshotCandidate,
	| "selector"
	| "tag"
	| "role"
	| "type"
	| "top"
	| "height"
	| "depth"
	| "text"
	| "textLength"
	| "name"
	| "ariaLabel"
	| "placeholder"
	| "linkCount"
	| "buttonCount"
	| "inputLike"
	| "buttonLike"
	| "contentEditable"
	| "disabled"
	| "groupCount"
	| "sampleItems"
	| "fingerprint"
>;

const SELECTOR_PROFILE_VERSION = 1;
const SELECTOR_MODEL = "gpt-4.1";
const MAX_SELECTORS_PER_FIELD = 5;
const FAILED_RESOLUTION_TTL_MS = 2_000;
const PAGE_FAILED_RESOLUTION_TTL_MS = 5_000;
const SELECTOR_MODEL_RATE_LIMIT_TTL_MS = 15 * 60_000;
const MAX_SELECTOR_MODEL_CALLS_PER_PROCESS = 30;
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

const pendingResolutions = new Map<string, Promise<SelectorProfile | null>>();
// Tracks provider:stage pairs where an LLM resolution is currently in-flight.
// Checked before captureStableSelectorSnapshot() to skip expensive DOM work.
const pendingByProviderStage = new Set<string>();
const failedResolutions = new Map<string, number>();
const failedPageResolutions = new Map<string, PageFailureCooldown>();
let selectorModelCallsThisProcess = 0;
let selectorModelDisabledUntil = 0;
let selectorModelBudgetLogged = false;
let selectorModelRateLimitLogged = false;

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

function resolveMonorepoRoot(startDir = process.cwd()): string {
	let current = path.resolve(startDir);

	while (true) {
		if (existsSync(path.join(current, "pnpm-workspace.yaml"))) {
			return current;
		}

		const parent = path.dirname(current);
		if (parent === current) {
			return path.resolve(startDir);
		}
		current = parent;
	}
}

function getSelectorCacheDir(): string {
	return path.join(resolveMonorepoRoot(), "apps/agent/selector-cache");
}

function ensureSelectorCacheDir(): void {
	mkdirSync(getSelectorCacheDir(), { recursive: true });
}

function hashValue(input: string): string {
	return createHash("sha256").update(input).digest("hex");
}

function sanitizeFilename(input: string): string {
	return (
		input.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "root"
	);
}

function normalizePageKeySegment(segment: string): string {
	if (/^[0-9a-f-]{16,}$/i.test(segment)) {
		return ":id";
	}

	if (segment.length >= 24) {
		const parts = segment.split(/[-_.]+/).filter(Boolean);
		const hasDynamicShape = parts.some(
			(part) =>
				part.includes(":") ||
				/\d/.test(part) ||
				/[A-Z]/.test(part) ||
				/^[0-9a-f]{6,}$/i.test(part),
		);
		if (parts.length >= 3 && hasDynamicShape) {
			return ":id";
		}
	}

	return segment.replace(/\d+/g, ":n");
}

function normalizePageKey(pageKey: string): string {
	const [host, ...segments] = pageKey.split("/").filter(Boolean);
	if (!host) {
		return "unknown";
	}

	const normalizedSegments = segments
		.slice(0, 2)
		.map((segment) => normalizePageKeySegment(segment));

	return [host, ...normalizedSegments].join("/");
}

function cacheKey(
	provider: Provider,
	stage: SelectorStage,
	fingerprint: string,
): string {
	return `${provider}:${stage}:${fingerprint}`;
}

function pageFailureKey(
	provider: Provider,
	stage: SelectorStage,
	pageKey: string,
): string {
	return `${provider}:${stage}:${pageKey}`;
}

function getPageFailureCooldown(key: string): PageFailureCooldown | null {
	const cooldown = failedPageResolutions.get(key);
	if (!cooldown) {
		return null;
	}
	if (Date.now() >= cooldown.expiresAt) {
		failedPageResolutions.delete(key);
		return null;
	}
	return cooldown;
}

function markPageFailureCooldown(
	key: string,
	stateKey: string,
	ttlMs: number,
): void {
	failedPageResolutions.set(key, {
		expiresAt: Date.now() + ttlMs,
		stateKey,
	});
}

function isSelectorModelRateLimited(): boolean {
	if (Date.now() >= selectorModelDisabledUntil) {
		selectorModelDisabledUntil = 0;
		selectorModelRateLimitLogged = false;
		return false;
	}
	return true;
}

function isSelectorModelErrorRateLimit(error: unknown): boolean {
	const message = toErrorMessage(error).toLowerCase();
	return /429|quota|insufficient_quota|rate.?limit|billing/.test(message);
}

function shouldSkipSelectorModelForBudget(): boolean {
	if (selectorModelCallsThisProcess < MAX_SELECTOR_MODEL_CALLS_PER_PROCESS) {
		return false;
	}
	if (!selectorModelBudgetLogged) {
		logger.warn(
			`selector model budget exhausted (${MAX_SELECTOR_MODEL_CALLS_PER_PROCESS} calls this process) — using cache only until restart`,
		);
		selectorModelBudgetLogged = true;
	}
	return true;
}

function getProfileCacheFile(cacheDir: string, provider: Provider): string {
	return path.join(cacheDir, `${provider}.json`);
}

function dedupeProfiles(profiles: SelectorProfile[]): SelectorProfile[] {
	const latestByStagePageKey = new Map<string, SelectorProfile>();

	for (const profile of profiles) {
		const normalizedPageKey = normalizePageKey(profile.pageKey);
		const normalizedProfile = {
			...profile,
			pageKey: normalizedPageKey,
		};
		const key = `${normalizedProfile.stage}:${normalizedPageKey}`;
		const existing = latestByStagePageKey.get(key);
		if (
			!existing ||
			normalizedProfile.createdAt.localeCompare(existing.createdAt) > 0
		) {
			latestByStagePageKey.set(key, normalizedProfile);
		}
	}

	return [...latestByStagePageKey.values()].sort((left, right) =>
		left.stage === right.stage
			? left.pageKey.localeCompare(right.pageKey)
			: left.stage.localeCompare(right.stage),
	);
}

async function readLegacyProviderProfiles(
	provider: Provider,
): Promise<SelectorProfile[]> {
	const providerDir = path.join(getSelectorCacheDir(), provider);
	const profiles: SelectorProfile[] = [];

	if (!existsSync(providerDir)) {
		return [];
	}

	for (const stage of await readdir(providerDir).catch(() => [])) {
		const stageDir = path.join(providerDir, stage);
		for (const file of await readdir(stageDir).catch(() => [])) {
			if (!file.endsWith(".json")) {
				continue;
			}
			const parsed = await readSelectorProfileFile(
				path.join(stageDir, file),
				provider,
				stage as SelectorStage,
			);
			if (parsed) {
				profiles.push(parsed);
			}
		}
	}

	return dedupeProfiles(profiles);
}

async function readSelectorProfileFile(
	cacheFile: string,
	provider: Provider,
	stage: SelectorStage,
	pageKey?: string,
): Promise<SelectorProfile | null> {
	if (!existsSync(cacheFile)) {
		return null;
	}

	try {
		const parsed = JSON.parse(
			await readFile(cacheFile, "utf8"),
		) as SelectorProfile;
		const normalizedPageKey = normalizePageKey(parsed.pageKey);
		if (
			parsed.version !== SELECTOR_PROFILE_VERSION ||
			parsed.provider !== provider ||
			parsed.stage !== stage ||
			(pageKey !== undefined && normalizedPageKey !== normalizePageKey(pageKey))
		) {
			return null;
		}
		return {
			...parsed,
			pageKey: normalizedPageKey,
		};
	} catch {
		return null;
	}
}

async function readProviderCache(
	provider: Provider,
): Promise<ProviderSelectorCache | null> {
	const cacheFile = getProfileCacheFile(getSelectorCacheDir(), provider);
	if (existsSync(cacheFile)) {
		try {
			const parsed = JSON.parse(
				await readFile(cacheFile, "utf8"),
			) as ProviderSelectorCache;
			if (
				parsed.version !== SELECTOR_PROFILE_VERSION ||
				parsed.provider !== provider ||
				!Array.isArray(parsed.profiles)
			) {
				return null;
			}
			return {
				...parsed,
				profiles: dedupeProfiles(parsed.profiles),
			};
		} catch {
			return null;
		}
	}

	const legacyProfiles = await readLegacyProviderProfiles(provider);
	if (legacyProfiles.length === 0) {
		return null;
	}

	return {
		version: SELECTOR_PROFILE_VERSION,
		provider,
		updatedAt:
			legacyProfiles
				.map((profile) => profile.createdAt)
				.sort()
				.at(-1) ?? new Date().toISOString(),
		profiles: legacyProfiles,
	};
}

async function writeProviderCache(cache: ProviderSelectorCache): Promise<void> {
	ensureSelectorCacheDir();
	const normalizedCache: ProviderSelectorCache = {
		...cache,
		profiles: dedupeProfiles(cache.profiles),
		updatedAt: new Date().toISOString(),
	};
	const cacheFile = getProfileCacheFile(
		getSelectorCacheDir(),
		normalizedCache.provider,
	);
	await writeFile(
		`${cacheFile}`,
		`${JSON.stringify(normalizedCache, null, 2)}\n`,
	).catch(() => {});
	await rm(path.join(getSelectorCacheDir(), normalizedCache.provider), {
		force: true,
		recursive: true,
	}).catch(() => {});
}

async function readCachedProfile(
	provider: Provider,
	stage: SelectorStage,
	pageKey: string,
): Promise<SelectorProfile | null> {
	const cache = await readProviderCache(provider);
	if (!cache) {
		return null;
	}

	const normalizedPageKey = normalizePageKey(pageKey);
	return (
		cache.profiles.find(
			(profile) =>
				profile.stage === stage &&
				normalizePageKey(profile.pageKey) === normalizedPageKey,
		) ?? null
	);
}

async function writeCachedProfile(profile: SelectorProfile): Promise<void> {
	const normalizedProfile = {
		...profile,
		pageKey: normalizePageKey(profile.pageKey),
	};
	const cache = (await readProviderCache(normalizedProfile.provider)) ?? {
		version: SELECTOR_PROFILE_VERSION,
		provider: normalizedProfile.provider,
		updatedAt: new Date().toISOString(),
		profiles: [],
	};
	cache.profiles = [
		...cache.profiles.filter(
			(entry) =>
				!(
					entry.stage === normalizedProfile.stage &&
					normalizePageKey(entry.pageKey) === normalizedProfile.pageKey
				),
		),
		normalizedProfile,
	];
	await writeProviderCache(cache);
}

async function deleteCachedProfile(profile: SelectorProfile): Promise<void> {
	const key = cacheKey(profile.provider, profile.stage, profile.fingerprint);
	failedResolutions.delete(key);
	const normalizedPageKey = normalizePageKey(profile.pageKey);
	const cache = await readProviderCache(profile.provider);
	if (!cache) {
		return;
	}
	cache.profiles = cache.profiles.filter(
		(entry) =>
			!(
				entry.stage === profile.stage &&
				normalizePageKey(entry.pageKey) === normalizedPageKey
			),
	);
	if (cache.profiles.length === 0) {
		await unlink(
			getProfileCacheFile(getSelectorCacheDir(), profile.provider),
		).catch(() => {});
		await rm(path.join(getSelectorCacheDir(), profile.provider), {
			force: true,
			recursive: true,
		}).catch(() => {});
		return;
	}
	await writeProviderCache(cache);
}

function compactSelectors(
	input: z.infer<typeof SelectorProfileSchema>,
): Record<SelectorField, string[]> {
	const base = defaultSelectorRecord();
	for (const field of Object.keys(base) as SelectorField[]) {
		let values = (input[field] ?? [])
			.map((value) => value.trim())
			.filter(Boolean);

		// Strip :nth-of-type(N) from response selectors. The fingerprint already
		// normalizes these numbers so the same fingerprint is reused across prompts,
		// but keeping the ordinal in the actual selector makes it permanently point
		// to the first response container. extractResponsePayload uses .at(-1) to
		// get the latest match, so an unanchored selector works correctly.
		if (field === "response") {
			values = values.map((value) =>
				value.replace(/:nth-of-type\(\d+\)/g, "").trim(),
			);
		}

		base[field] = [...new Set(values)].slice(0, MAX_SELECTORS_PER_FIELD);
	}
	return base;
}

function buildPageKey(rawUrl: string): string {
	try {
		const url = new URL(rawUrl);
		const segments = url.pathname.split("/").filter(Boolean).slice(0, 2);
		return normalizePageKey(`${url.hostname}/${segments.join("/")}`);
	} catch {
		return "unknown";
	}
}

function normalizeSelectorForState(selector: string): string {
	return selector.replace(/:nth-of-type\(\d+\)/g, ":nth-of-type");
}

function buildSnapshotStateKey(snapshot: SelectorSnapshot): string {
	return hashValue(
		JSON.stringify({
			stage: snapshot.stage,
			pageKey: snapshot.pageKey,
			editables: snapshot.editables.slice(0, 2).map((item) => ({
				selector: normalizeSelectorForState(item.selector),
				fingerprint: item.fingerprint,
			})),
			buttons: snapshot.buttons.slice(0, 8).map((item) => ({
				selector: normalizeSelectorForState(item.selector),
				ariaLabel: item.ariaLabel,
				text: item.text.slice(0, 60),
				fingerprint: item.fingerprint,
			})),
			content: snapshot.content.slice(0, 8).map((item) => ({
				selector: normalizeSelectorForState(item.selector),
				lengthBucket: Math.min(12, Math.floor(item.textLength / 250)),
				linkCount: item.linkCount,
				buttonCount: item.buttonCount,
				fingerprint: item.fingerprint,
			})),
			groups: snapshot.groups.slice(0, 6).map((item) => ({
				selector: normalizeSelectorForState(item.selector),
				groupCount: item.groupCount ?? 0,
				linkCount: item.linkCount,
				buttonCount: item.buttonCount,
				fingerprint: item.fingerprint,
			})),
		}),
	);
}

function hasRequiredSelectors(
	stage: SelectorStage,
	selectors: Record<SelectorField, string[]>,
	requiredFields?: readonly SelectorField[],
): boolean {
	if (requiredFields && requiredFields.length > 0) {
		return requiredFields.every((field) => selectors[field].length > 0);
	}

	if (stage === "response") {
		return selectors.response.length > 0;
	}

	if (stage === "sources") {
		// Both sourcePanel and sourceItem are required. Without sourcePanel the
		// extraction falls back to querying the whole document, which picks up
		// wrong elements from anywhere on the page.
		return selectors.sourceItem.length > 0 && selectors.sourcePanel.length > 0;
	}

	return STAGE_REQUIRED_FIELDS[stage].every(
		(field) => selectors[field].length > 0,
	);
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

		function stableClassTokens(element: Element): string[] {
			return Array.from(element.classList)
				.map((token) => token.trim())
				.filter(
					(token) =>
						token &&
						token.length <= 40 &&
						!/^(active|selected|disabled|hover|focus|open|show|hide)$/i.test(
							token,
						) &&
						!/^\d+$/.test(token) &&
						!/__[a-z0-9]{5,}$/i.test(token) &&
						// Reject build-tool hash tokens: mixed case, short, no separator
						!(
							token.length <= 8 &&
							/[A-Z]/.test(token) &&
							/[a-z]/.test(token) &&
							!/[-_]/.test(token)
						),
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
		// Mixed-case short tokens like "APjFqb" are auto-generated by build tools
		// and will break whenever the app is recompiled. Stable IDs have hyphens,
		// underscores, or are all-lowercase and at least 4 chars.
		function isStableId(id: string): boolean {
			if (!id) return false;
			if (id.includes("-") || id.includes("_")) return true;
			if (id === id.toLowerCase() && id.length >= 4) return true;
			return false;
		}

		function buildSelector(element: Element): string {
			const tag = element.tagName.toLowerCase();

			// 1. Semantic attributes — stable across builds; encode meaning not layout.
			//    Tried before #id because ids are frequently auto-generated and break
			//    on every recompile (e.g. Closure Compiler tokens like "APjFqb").
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

			// 6. Positional path (last resort). Ancestor ids (stable or not) are used
			//    for anchoring even if fragile — the scope helps narrow the selector.
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

		const minContentTextLength = currentStage === "compose" ? 40 : 12;
		const content = limitAndDedupe(
			visibleElements
				.filter((element) => {
					const text = elementText(element);
					if (text.length < minContentTextLength || text.length > 8000) {
						return false;
					}
					if (isInputLike(element) || isButtonLike(element)) return false;
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
			currentStage === "compose" ? 12 : 30,
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
			normalizeSelectorForState(item.selector),
			item.linkCount,
			item.buttonCount,
			Math.min(6, Math.floor(item.textLength / 80)),
		]),
		groups: snapshot.groups.map((item) => [
			normalizeSelectorForState(item.selector),
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

function buildSystemPrompt(stage: SelectorStage): string {
	// Shared rules applied to every stage.
	// Keep this tight — every extra sentence costs tokens and dilutes strict rules.
	const shared =
		"You receive a DOM snapshot and output CSS selectors. Return only JSON. " +
		"STRICT RULES: " +
		"(1) Copy selector values EXACTLY as they appear in each candidate's selector field — never modify or synthesize one. " +
		"(2) Return [] for any field you cannot identify with certainty — never guess. " +
		"(3) Selector stability order (prefer the highest available): " +
		"name/aria-label/placeholder > data-testid/data-test/data-qa > role/contenteditable > id > classes > positional. " +
		"NEVER use an id selector where the id contains mixed upper and lower-case letters with no hyphen or underscore (e.g. #APjFqb, #jloFI) — these are build-tool auto-generated and change on every recompile. Only accept an id selector if it is all-lowercase, or contains a hyphen or underscore. " +
		"(4) Never choose broad page wrappers, historical conversation turns, or elements that span multiple responses.";

	if (stage === "compose") {
		return `${shared} Task: identify editor only. Choose the single element a real user types their prompt into. Reject: search bars, filters, sidebars, settings, hidden inputs, read-only areas.`;
	}

	if (stage === "submit") {
		return `${shared} Task: identify submitButton only. Text is already typed. Choose the visible button that sends the current prompt. Reject: voice, attach, model-picker, stop, regenerate, navigation buttons. If only Enter submits and no button exists, return [].`;
	}

	if (stage === "response") {
		return `${shared} Task: identify response, generationIndicator, and sourcesButton. response: the outermost container of the LATEST model answer only — not a child paragraph, code block, or whole-page wrapper. Must contain the full answer text, must be absent for prior turns, must persist after streaming ends. Reject any candidate that contains editable elements, user input, or multiple historical answers. generationIndicator: a small UI element (stop button, spinner, live-region) that is ONLY visible while the answer is streaming and disappears when complete. Must not contain the answer body. Return [] if no such element is visible. sourcesButton: the control that opens citations/sources for this latest answer only. Return [] if absent.`;
	}

	return `${shared} Task: identify sourcePanel and sourceItem. The sources UI is already open. sourcePanel: the smallest stable container that holds only the source list for the latest answer — not sidebars, nav, or the full document. sourceItem: the repeating element (card, row, anchor) for each individual source inside that panel. If panel and items are nested, choose the repeated items for sourceItem and their direct container for sourcePanel.`;
}

function toModelCandidate(candidate: SnapshotCandidate): ModelCandidate {
	return {
		selector: candidate.selector,
		tag: candidate.tag,
		role: candidate.role,
		type: candidate.type,
		top: candidate.top,
		height: candidate.height,
		depth: candidate.depth,
		text: candidate.text.slice(0, 180),
		textLength: candidate.textLength,
		name: candidate.name,
		ariaLabel: candidate.ariaLabel,
		placeholder: candidate.placeholder,
		linkCount: candidate.linkCount,
		buttonCount: candidate.buttonCount,
		inputLike: candidate.inputLike,
		buttonLike: candidate.buttonLike,
		contentEditable: candidate.contentEditable,
		disabled: candidate.disabled,
		groupCount: candidate.groupCount,
		sampleItems: candidate.sampleItems?.slice(0, 2).map((item) => ({
			text: item.text.slice(0, 120),
			linkCount: item.linkCount,
			buttonCount: item.buttonCount,
		})),
		fingerprint: candidate.fingerprint,
	};
}

function buildModelSnapshotPayload(
	stage: SelectorStage,
	snapshot: SelectorSnapshot,
): {
	providerUrl: string;
	title: string;
	editables: ModelCandidate[];
	buttons: ModelCandidate[];
	content: ModelCandidate[];
	groups: ModelCandidate[];
	requiredFields: SelectorField[];
} {
	const limits: Record<
		SelectorStage,
		{ editables: number; buttons: number; content: number; groups: number }
	> = {
		compose: { editables: 10, buttons: 6, content: 4, groups: 4 },
		submit: { editables: 6, buttons: 15, content: 6, groups: 4 },
		response: { editables: 4, buttons: 12, content: 14, groups: 10 },
		sources: { editables: 2, buttons: 6, content: 10, groups: 10 },
	};
	const limit = limits[stage];

	return {
		providerUrl: snapshot.url,
		title: snapshot.title,
		editables: snapshot.editables
			.slice(0, limit.editables)
			.map(toModelCandidate),
		buttons: snapshot.buttons.slice(0, limit.buttons).map(toModelCandidate),
		content: snapshot.content.slice(0, limit.content).map(toModelCandidate),
		groups: snapshot.groups.slice(0, limit.groups).map(toModelCandidate),
		requiredFields: STAGE_REQUIRED_FIELDS[stage],
	};
}

export async function debugCaptureSelectorSnapshot(
	page: Page,
	stage: SelectorStage,
): Promise<SelectorSnapshot> {
	return captureStableSelectorSnapshot(page, stage);
}

export function debugBuildModelSnapshotPayload(
	stage: SelectorStage,
	snapshot: SelectorSnapshot,
): {
	providerUrl: string;
	title: string;
	editables: ModelCandidate[];
	buttons: ModelCandidate[];
	content: ModelCandidate[];
	groups: ModelCandidate[];
	requiredFields: SelectorField[];
} {
	return buildModelSnapshotPayload(stage, snapshot);
}

async function resolveProfileWithModel(
	provider: Provider,
	stage: SelectorStage,
	snapshot: SelectorSnapshot,
): Promise<SelectorProfile | null> {
	const modelPayload = buildModelSnapshotPayload(stage, snapshot);
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
					...modelPayload,
				}),
			},
		],
		text: {
			format: {
				type: "json_schema",
				name: `selector_profile_${stage.replace(/[^a-z0-9_-]/gi, "_")}`,
				strict: true,
				schema: {
					type: "object",
					additionalProperties: false,
					properties: {
						editor: {
							type: "array",
							items: { type: "string" },
						},
						submitButton: {
							type: "array",
							items: { type: "string" },
						},
						response: {
							type: "array",
							items: { type: "string" },
						},
						generationIndicator: {
							type: "array",
							items: { type: "string" },
						},
						sourcesButton: {
							type: "array",
							items: { type: "string" },
						},
						sourcePanel: {
							type: "array",
							items: { type: "string" },
						},
						sourceItem: {
							type: "array",
							items: { type: "string" },
						},
					},
					required: [
						"editor",
						"submitButton",
						"response",
						"generationIndicator",
						"sourcesButton",
						"sourcePanel",
						"sourceItem",
					],
				},
			},
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
		label?: string;
		requireEditable?: boolean;
		requireEnabled?: boolean;
		minTextLength?: number;
		maxTextLength?: number;
		minHeight?: number;
		disallowEditableDescendant?: boolean;
	},
): Promise<string[]> {
	const valid: string[] = [];

	for (const selector of selectors) {
		const locator = page.locator(selector);
		const count = await locator.count().catch(() => 0);
		if (count === 0) {
			continue;
		}
		for (let index = 0; index < count; index += 1) {
			const candidate = locator.nth(index);
			const visible = await candidate.isVisible().catch(() => false);
			if (!visible) {
				continue;
			}
			if (options?.minHeight && options.minHeight > 0) {
				const box = await candidate.boundingBox().catch(() => null);
				if (!box || box.height < options.minHeight) {
					continue;
				}
			}
			if (options?.requireEnabled) {
				const enabled = await candidate.isEnabled().catch(() => false);
				if (!enabled) {
					continue;
				}
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
			if (
				(options?.minTextLength && options.minTextLength > 0) ||
				(options?.maxTextLength && options.maxTextLength >= 0)
			) {
				const textLength = await page
					.evaluate(
						({
							candidateSelector,
							candidateIndex,
						}: {
							candidateSelector: string;
							candidateIndex: number;
						}) => {
							try {
								const matches = Array.from(
									document.querySelectorAll(candidateSelector),
								);
								const node = matches[candidateIndex];
								if (!(node instanceof HTMLElement)) {
									return 0;
								}
								return (node.innerText || node.textContent || "")
									.replace(/\s+/g, " ")
									.trim().length;
							} catch {
								return 0;
							}
						},
						{
							candidateSelector: selector,
							candidateIndex: index,
						},
					)
					.catch(() => 0);
				if (options?.minTextLength && textLength < options.minTextLength) {
					continue;
				}
				if (options?.maxTextLength && textLength > options.maxTextLength) {
					continue;
				}
			}
			if (options?.disallowEditableDescendant) {
				const hasEditableDescendant = await page
					.evaluate(
						({
							candidateSelector,
							candidateIndex,
						}: {
							candidateSelector: string;
							candidateIndex: number;
						}) => {
							try {
								const matches = Array.from(
									document.querySelectorAll(candidateSelector),
								);
								const node = matches[candidateIndex];
								if (!(node instanceof HTMLElement)) {
									return false;
								}
								return Boolean(
									node.querySelector(
										'textarea, input:not([type="hidden"]), [contenteditable="true"], [role="textbox"]',
									),
								);
							} catch {
								return false;
							}
						},
						{
							candidateSelector: selector,
							candidateIndex: index,
						},
					)
					.catch(() => false);
				if (hasEditableDescendant) {
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
	requiredFields?: readonly SelectorField[],
): Promise<SelectorProfile | null> {
	const selectors = defaultSelectorRecord();

	selectors.editor = await validateVisibleSelectors(
		page,
		profile.selectors.editor,
		{
			label: `${profile.provider}/${profile.stage}/editor`,
			requireEditable: true,
		},
	);
	selectors.submitButton = await validateVisibleSelectors(
		page,
		profile.selectors.submitButton,
		{
			label: `${profile.provider}/${profile.stage}/submitButton`,
			requireEnabled: true,
		},
	);
	// Selector validation only confirms the element has content — response quality
	// is enforced later by validateResponse(). Cap at 50 so partially-streamed
	// responses are not rejected mid-generation, and derive from the same per-provider
	// minimums used by validateResponse() so there is one source of truth.
	const providerResponseMin =
		PROVIDER_MIN_RESPONSE_CHARS[profile.provider] ?? DEFAULT_MIN_RESPONSE_CHARS;
	const responseMinTextLength =
		profile.stage === "response" ? Math.min(providerResponseMin, 50) : 0;
	selectors.response = await validateVisibleSelectors(
		page,
		profile.selectors.response,
		{
			label: `${profile.provider}/${profile.stage}/response`,
			minTextLength: responseMinTextLength,
			minHeight: profile.stage === "response" ? 80 : 0,
			disallowEditableDescendant: profile.stage === "response",
		},
	);
	selectors.generationIndicator = await validateVisibleSelectors(
		page,
		profile.selectors.generationIndicator,
		{
			label: `${profile.provider}/${profile.stage}/generationIndicator`,
			maxTextLength: 160,
		},
	);
	selectors.sourcesButton = await validateVisibleSelectors(
		page,
		profile.selectors.sourcesButton,
		{
			label: `${profile.provider}/${profile.stage}/sourcesButton`,
		},
	);
	selectors.sourcePanel = await validateVisibleSelectors(
		page,
		profile.selectors.sourcePanel,
		{
			label: `${profile.provider}/${profile.stage}/sourcePanel`,
		},
	);
	selectors.sourceItem = await validateVisibleSelectors(
		page,
		profile.selectors.sourceItem,
		{
			label: `${profile.provider}/${profile.stage}/sourceItem`,
		},
	);

	if (
		profile.stage === "response" &&
		selectors.generationIndicator.length > 0
	) {
		const responseSet = new Set(selectors.response);
		selectors.generationIndicator = selectors.generationIndicator.filter(
			(selector) => !responseSet.has(selector),
		);
	}

	if (!hasRequiredSelectors(profile.stage, selectors, requiredFields)) {
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

	// For the response stage, require actual content elements (not just buttons).
	// The stop-generation button appears immediately after submit and would
	// otherwise trigger a premature LLM call before any response content exists,
	// causing validateProfile to fail and a 30s failedResolutions cooldown block.
	const longestContent = snapshot.content.reduce(
		(max, item) => Math.max(max, item.textLength),
		0,
	);
	const longestGroup = snapshot.groups.reduce(
		(max, item) => Math.max(max, item.textLength),
		0,
	);
	return longestContent >= 40 || longestGroup >= 40;
}

async function invalidateSelectorProfilesForPageKey(
	provider: Provider,
	stage: SelectorStage,
	pageKey: string,
): Promise<void> {
	const normalizedPageKey = normalizePageKey(pageKey);
	const cache = await readProviderCache(provider);
	if (!cache) {
		return;
	}

	cache.profiles = cache.profiles.filter(
		(profile) =>
			!(
				profile.stage === stage &&
				normalizePageKey(profile.pageKey) === normalizedPageKey
			),
	);
	if (cache.profiles.length === 0) {
		await unlink(getProfileCacheFile(getSelectorCacheDir(), provider)).catch(
			() => {},
		);
		await rm(path.join(getSelectorCacheDir(), provider), {
			force: true,
			recursive: true,
		}).catch(() => {});
		return;
	}

	await writeProviderCache(cache);
}

export async function invalidateSelectorProfileForPage(
	page: Page,
	provider: Provider,
	stage: SelectorStage,
): Promise<void> {
	try {
		const pageKey = buildPageKey(page.url());
		await invalidateSelectorProfilesForPageKey(provider, stage, pageKey);
		logger.debug(
			`invalidated ${provider}/${stage} selector profiles for ${pageKey}`,
		);
	} catch {
		// Best-effort — don't let invalidation errors surface to the caller
	}
}

export async function getSelectorProfile(
	page: Page,
	provider: Provider,
	stage: SelectorStage,
	options?: {
		allowModel?: boolean;
		forceRefresh?: boolean;
		requiredFields?: readonly SelectorField[];
	},
): Promise<SelectorProfile | null> {
	const psKey = `${provider}:${stage}`;
	let invalidatedCachedProfile = false;
	let initialPageKey: string | null = null;

	if (!options?.forceRefresh) {
		const pageKey = buildPageKey(page.url());
		initialPageKey = pageKey;
		const cached = (await readCachedProfile(provider, stage, pageKey)) ?? null;
		if (cached) {
			const valid = await validateProfile(
				page,
				cached,
				options?.requiredFields,
			);
			if (valid) {
				return valid;
			}
			const baselineValid = options?.requiredFields?.length
				? await validateProfile(page, cached)
				: null;
			if (!baselineValid) {
				await deleteCachedProfile(cached);
				invalidatedCachedProfile = true;
			}
		}
	}

	// Skip the expensive DOM scan while an LLM call is already in-flight for
	// this provider+stage. The caller retries on the next poll when it settles.
	if (pendingByProviderStage.has(psKey)) {
		return null;
	}

	const snapshot = await captureStableSelectorSnapshot(page, stage);
	const key = cacheKey(provider, stage, snapshot.fingerprint);
	const pageKeyCooldownKey = pageFailureKey(provider, stage, snapshot.pageKey);
	const snapshotStateKey = buildSnapshotStateKey(snapshot);

	if (invalidatedCachedProfile && initialPageKey === snapshot.pageKey) {
		failedPageResolutions.delete(pageKeyCooldownKey);
		failedResolutions.delete(key);
	}

	if (!options?.forceRefresh) {
		const cached =
			(await readCachedProfile(provider, stage, snapshot.pageKey)) ?? null;
		if (cached) {
			const valid = await validateProfile(
				page,
				cached,
				options?.requiredFields,
			);
			if (valid) {
				if (valid.fingerprint !== snapshot.fingerprint) {
					const rebased: SelectorProfile = {
						...valid,
						fingerprint: snapshot.fingerprint,
						createdAt: new Date().toISOString(),
					};
					await writeCachedProfile(rebased);
					return rebased;
				}
				return valid;
			}
			const baselineValid = options?.requiredFields?.length
				? await validateProfile(page, cached)
				: null;
			if (!baselineValid) {
				await deleteCachedProfile(cached);
			}
		}
	}

	if (!isSnapshotReady(snapshot)) {
		return null;
	}

	const lastFailure = failedResolutions.get(key);
	if (
		!invalidatedCachedProfile &&
		!options?.forceRefresh &&
		lastFailure &&
		Date.now() - lastFailure < FAILED_RESOLUTION_TTL_MS
	) {
		return null;
	}

	if (
		!invalidatedCachedProfile &&
		!options?.forceRefresh &&
		getPageFailureCooldown(pageKeyCooldownKey)?.stateKey === snapshotStateKey
	) {
		return null;
	}

	if (options?.allowModel === false) {
		return null;
	}

	if (isSelectorModelRateLimited()) {
		if (!selectorModelRateLimitLogged) {
			logger.warn(
				`selector model temporarily disabled after rate limit/quota response — using cache only for ${Math.ceil((selectorModelDisabledUntil - Date.now()) / 60000)} more minute(s)`,
			);
			selectorModelRateLimitLogged = true;
		}
		return null;
	}

	if (shouldSkipSelectorModelForBudget()) {
		return null;
	}

	const pending = pendingResolutions.get(key);
	if (pending) {
		return pending;
	}

	pendingByProviderStage.add(psKey);
	const resolution = (async () => {
		try {
			selectorModelCallsThisProcess += 1;
			logger.debug(
				`[selector:${provider}/${stage}] calling selector model (call ${selectorModelCallsThisProcess}/${MAX_SELECTOR_MODEL_CALLS_PER_PROCESS}) pageKey=${snapshot.pageKey} fingerprint=${snapshot.fingerprint.slice(0, 12)}`,
			);
			const generated = await resolveProfileWithModel(
				provider,
				stage,
				snapshot,
			);
			if (!generated) {
				markPageFailureCooldown(
					pageKeyCooldownKey,
					snapshotStateKey,
					PAGE_FAILED_RESOLUTION_TTL_MS,
				);
				return null;
			}

			const validated = await validateProfile(
				page,
				generated,
				options?.requiredFields,
			);
			if (!validated) {
				failedResolutions.set(key, Date.now());
				markPageFailureCooldown(
					pageKeyCooldownKey,
					snapshotStateKey,
					PAGE_FAILED_RESOLUTION_TTL_MS,
				);
				return null;
			}

			await writeCachedProfile(validated);
			return validated;
		} catch (error) {
			failedResolutions.set(key, Date.now());
			markPageFailureCooldown(
				pageKeyCooldownKey,
				snapshotStateKey,
				PAGE_FAILED_RESOLUTION_TTL_MS,
			);
			if (isSelectorModelErrorRateLimit(error)) {
				selectorModelDisabledUntil =
					Date.now() + SELECTOR_MODEL_RATE_LIMIT_TTL_MS;
				selectorModelRateLimitLogged = false;
			}
			logger.warn(
				`selector resolution failed (${provider}/${stage}): ${toErrorMessage(error)}`,
			);
			return null;
		} finally {
			pendingByProviderStage.delete(psKey);
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
	options?: {
		requiredFields?: readonly SelectorField[];
	},
): Promise<SelectorProfile> {
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		const profile = await getSelectorProfile(page, provider, stage, {
			requiredFields: options?.requiredFields,
		});
		if (profile) {
			return profile;
		}

		await page.waitForTimeout(600);
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

			function hasEditableDescendant(element: Element): boolean {
				return Boolean(
					element.querySelector(
						'textarea, input:not([type="hidden"]), [contenteditable="true"], [role="textbox"]',
					),
				);
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

async function findSourcesButtonLocator(
	page: Page,
	responseSelectors: string[],
	selectors: string[],
): Promise<{ locator: Locator; selector: string; index: number } | null> {
	const match = await page
		.evaluate(
			({
				responseSelectors: responseCandidateSelectors,
				buttonSelectors,
			}: {
				responseSelectors: string[];
				buttonSelectors: string[];
			}) => {
				type ButtonMatch = {
					selector: string;
					index: number;
					score: number;
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

				function lastVisible<T extends Element>(elements: T[]): T | null {
					for (let index = elements.length - 1; index >= 0; index -= 1) {
						const element = elements[index];
						if (element && isVisible(element)) {
							return element;
						}
					}
					return null;
				}

				function resolveLatestResponse(): HTMLElement | null {
					for (const selector of responseCandidateSelectors) {
						try {
							const response = lastVisible(
								Array.from(
									document.querySelectorAll(selector),
								) as HTMLElement[],
							);
							if (response) {
								return response;
							}
						} catch {}
					}
					return null;
				}

				function sharedAncestorScore(
					response: HTMLElement,
					button: HTMLElement,
				): number {
					let current: HTMLElement | null = button.parentElement;
					let depth = 1;
					while (current && depth <= 6) {
						if (current.contains(response)) {
							return 4_000 - depth * 150;
						}
						current = current.parentElement;
						depth += 1;
					}
					return 0;
				}

				const latestResponse = resolveLatestResponse();
				if (!latestResponse) {
					return null;
				}
				const responseRect = latestResponse.getBoundingClientRect();
				let best: ButtonMatch | null = null;

				for (const selector of buttonSelectors) {
					let matches: HTMLElement[] = [];
					try {
						matches = Array.from(document.querySelectorAll(selector)).filter(
							isVisible,
						) as HTMLElement[];
					} catch {
						continue;
					}

					for (const [index, button] of matches.entries()) {
						const rect = button.getBoundingClientRect();
						const verticalDistance = Math.abs(rect.top - responseRect.bottom);
						const insideResponse = latestResponse.contains(button);
						const nearResponse =
							rect.top >= responseRect.top - 120 &&
							rect.top <= responseRect.bottom + 240;
						let score = -verticalDistance;

						if (insideResponse) {
							score += 10_000;
						}
						if (nearResponse) {
							score += 1_000;
						}
						score += sharedAncestorScore(latestResponse, button);
						score += rect.top / 100;

						if (!best || score > best.score) {
							best = { selector, index, score };
						}
					}
				}

				return best;
			},
			{
				responseSelectors,
				buttonSelectors: selectors,
			},
		)
		.catch(() => null);

	if (!match) {
		return null;
	}

	const locator = page.locator(match.selector).nth(match.index);
	await locator.scrollIntoViewIfNeeded().catch(() => {});
	const visible = await locator.isVisible().catch(() => false);
	if (!visible) {
		return null;
	}

	return {
		locator,
		selector: match.selector,
		index: match.index,
	};
}

function toAttributeSelector(id: string): string {
	return `[id="${id.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
}

async function resolveControlledPanelSelector(
	page: Page,
	buttonMatch: { selector: string; index: number },
): Promise<string | null> {
	const panelId = await page
		.evaluate(
			({
				selector,
				index,
			}: {
				selector: string;
				index: number;
			}) => {
				try {
					const matches = Array.from(document.querySelectorAll(selector));
					const element = matches[index];
					if (!(element instanceof HTMLElement)) {
						return null;
					}
					return (
						(
							element.getAttribute("aria-controls") ??
							element.getAttribute("aria-owns")
						)?.trim() ?? null
					);
				} catch {
					return null;
				}
			},
			buttonMatch,
		)
		.catch(() => null);
	if (!panelId) {
		return null;
	}

	return toAttributeSelector(panelId);
}

async function openSourcesPanelIfNeeded(
	page: Page,
	responseSelectors: string[],
	sourceButtonSelectors: string[],
): Promise<{ opened: boolean; controlledPanelSelector: string | null }> {
	const buttonMatch = await findSourcesButtonLocator(
		page,
		responseSelectors,
		sourceButtonSelectors,
	);
	if (!buttonMatch) {
		return {
			opened: false,
			controlledPanelSelector: null,
		};
	}

	await buttonMatch.locator.scrollIntoViewIfNeeded().catch(() => {});
	const controlledPanelSelector = await resolveControlledPanelSelector(
		page,
		buttonMatch,
	);
	const clicked = await buttonMatch.locator
		.click({ timeout: 3000 })
		.then(() => true)
		.catch(() => false);
	if (!clicked) {
		await buttonMatch.locator.dispatchClick().catch(() => {});
	}
	await page.waitForTimeout(1500);
	return {
		opened: true,
		controlledPanelSelector,
	};
}

async function resolveResponseProfileForSources(
	page: Page,
	provider: Provider,
): Promise<SelectorProfile | null> {
	const baseProfile = await getSelectorProfile(page, provider, "response", {
		allowModel: false,
		requiredFields: ["response"],
	}).catch(() => null);

	if (!baseProfile) {
		return null;
	}

	if (baseProfile.selectors.sourcesButton.length > 0) {
		return baseProfile;
	}

	return (
		(await getSelectorProfile(page, provider, "response", {
			forceRefresh: true,
			requiredFields: ["response", "sourcesButton"],
		}).catch(() => null)) ?? baseProfile
	);
}

async function extractRawSourcesWithSelectors(
	page: Page,
	sourcePanelSelectors: string[],
	sourceItemSelectors: string[],
	rootSelector?: string | null,
): Promise<RawSource[]> {
	return await page.evaluate(
		({
			panels,
			items,
			rootSelector,
		}: {
			panels: string[];
			items: string[];
			rootSelector?: string | null;
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

			function resolveRoot(): HTMLElement | null {
				if (rootSelector) {
					try {
						const controlledPanel = lastVisible(
							Array.from(
								document.querySelectorAll(rootSelector),
							) as HTMLElement[],
						);
						if (controlledPanel) {
							return controlledPanel;
						}
					} catch {}
				}

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
				// Do NOT fall back to document — querying the whole page with
				// sourceItem selectors picks up wrong elements (nav links, footers,
				// search result cards). Return null so the caller returns [] instead.
				return null;
			}

			const root = resolveRoot();
			if (!root) return [];
			const rawItems: Element[] = [];
			for (const selector of items) {
				try {
					rawItems.push(...Array.from(root.querySelectorAll(selector)));
				} catch {}
			}

			let dedupedItems = Array.from(new Set(rawItems)).filter(isVisible);
			if (dedupedItems.length <= 1) {
				const anchorItems = Array.from(root.querySelectorAll("a[href]")).filter(
					isVisible,
				);
				if (anchorItems.length > dedupedItems.length) {
					dedupedItems = anchorItems;
				}
			}
			const results: RawSource[] = [];

			for (const item of dedupedItems) {
				const anchor =
					lastVisible(
						Array.from(item.querySelectorAll("a[href]")) as HTMLAnchorElement[],
					) || (item instanceof HTMLAnchorElement ? item : null);
				if (!anchor?.href) continue;

				let url = "";
				try {
					url =
						new URL(anchor.href, window.location.origin)
							.toString()
							.split("#")[0] || "";
				} catch {
					continue;
				}
				if (!url) continue;

				const title =
					item
						.querySelector("h1,h2,h3,h4,strong,b,[title]")
						?.textContent?.trim() ||
					anchor.getAttribute("title")?.trim() ||
					anchor.textContent?.trim() ||
					url;

				const snippetCandidates = Array.from(
					item.querySelectorAll("p, span, div, small"),
				)
					.map((element) => textOf(element))
					.filter(
						(text) => text.length > 30 && text !== title && !text.includes(url),
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
		{
			panels: sourcePanelSelectors,
			items: sourceItemSelectors,
			rootSelector,
		},
	);
}

export async function extractResolvedSources(
	page: Page,
	provider: Provider,
): Promise<Source[]> {
	const responseProfile = await resolveResponseProfileForSources(
		page,
		provider,
	);
	if (!responseProfile?.selectors.sourcesButton.length) {
		return [];
	}

	logger.log(`[${provider}] opening sources panel`);
	const { opened, controlledPanelSelector } = await openSourcesPanelIfNeeded(
		page,
		responseProfile.selectors.response,
		responseProfile.selectors.sourcesButton,
	);
	if (!opened) {
		throw new ExternalServiceError(
			provider,
			"Sources button was resolved but the sources panel could not be opened",
		);
	}
	logger.log(`[${provider}] sources panel opened`);

	const sourceProfile =
		(await waitForSelectorProfile(page, provider, "sources", 8_000, {
			requiredFields: ["sourcePanel", "sourceItem"],
		}).catch(() => null)) ??
		(await getSelectorProfile(page, provider, "sources", {
			allowModel: false,
		}).catch(() => null));
	const rawSources = await extractRawSourcesWithSelectors(
		page,
		sourceProfile?.selectors.sourcePanel ?? [],
		sourceProfile?.selectors.sourceItem ?? [],
		controlledPanelSelector,
	);

	if (rawSources.length === 0) {
		throw new ExternalServiceError(
			provider,
			"Sources button was present and opened, but no sources were extracted",
		);
	}

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
