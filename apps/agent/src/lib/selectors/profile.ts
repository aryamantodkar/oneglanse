import path from "node:path";
import { unlink, rm } from "node:fs/promises";
import type {
	Provider,
	SelectorField,
	SelectorProfile,
	SelectorSnapshot,
	SelectorStage,
} from "@oneglanse/types";
import { NotFoundError, toErrorMessage } from "@oneglanse/errors";
import {
	DEFAULT_MIN_RESPONSE_CHARS,
	PROVIDER_MIN_RESPONSE_CHARS,
	logger,
} from "@oneglanse/utils";
import type { Locator, Page } from "playwright";
import {
	FAILED_RESOLUTION_TTL_MS,
	PAGE_FAILED_RESOLUTION_TTL_MS,
	failedResolutions,
	failedPageResolutions,
	pendingByProviderStage,
	pendingResolutions,
	selectorModelState,
	SELECTOR_MODEL_RATE_LIMIT_TTL_MS,
	MAX_SELECTOR_MODEL_CALLS_PER_PROCESS,
} from "./constants.js";
import {
	buildPageKey,
	buildSnapshotStateKey,
	defaultSelectorRecord,
	hasRequiredSelectors,
	normalizePageKey,
} from "./utils.js";
import {
	cacheKey,
	deleteCachedProfile,
	getPageFailureCooldown,
	getProfileCacheFile,
	getSelectorCacheDir,
	markPageFailureCooldown,
	pageFailureKey,
	readCachedProfile,
	writeCachedProfile,
	writeProviderCache,
	readProviderCache,
} from "./cache.js";
import { captureStableSelectorSnapshot } from "./snapshot.js";
import {
	isSelectorModelErrorRateLimit,
	isSelectorModelRateLimited,
	resolveProfileWithModel,
	shouldSkipSelectorModelForBudget,
} from "./model.js";

export async function validateVisibleSelectors(
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

export async function validateProfile(
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

export function isSnapshotReady(snapshot: SelectorSnapshot): boolean {
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

export async function invalidateSelectorProfilesForPageKey(
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
		if (!selectorModelState.rateLimitLogged) {
			logger.warn(
				`selector model temporarily disabled after rate limit/quota response — using cache only for ${Math.ceil((selectorModelState.disabledUntil - Date.now()) / 60000)} more minute(s)`,
			);
			selectorModelState.rateLimitLogged = true;
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
			selectorModelState.callsThisProcess += 1;
			logger.debug(
				`[selector:${provider}/${stage}] calling selector model (call ${selectorModelState.callsThisProcess}/${MAX_SELECTOR_MODEL_CALLS_PER_PROCESS}) pageKey=${snapshot.pageKey} fingerprint=${snapshot.fingerprint.slice(0, 12)}`,
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
				selectorModelState.disabledUntil =
					Date.now() + SELECTOR_MODEL_RATE_LIMIT_TTL_MS;
				selectorModelState.rateLimitLogged = false;
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
