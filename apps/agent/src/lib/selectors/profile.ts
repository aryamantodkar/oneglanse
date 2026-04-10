import { NotFoundError, toErrorMessage } from "@oneglanse/errors";
import type {
	Provider,
	SelectorField,
	SelectorProfile,
	SelectorSnapshot,
	SelectorStage,
} from "@oneglanse/types";
import {
	DEFAULT_MIN_RESPONSE_CHARS,
	PROVIDER_MIN_RESPONSE_CHARS,
	logger,
} from "@oneglanse/utils";
import type { Locator, Page } from "playwright";
import {
	deleteCachedProfile,
	readCachedProfile,
	writeCachedProfile,
} from "./cache.js";
import {
	MAX_SELECTOR_MODEL_CALLS_PER_PROCESS,
	SELECTOR_MODEL_RATE_LIMIT_TTL_MS,
	SELECTOR_PROFILE_MAX_AGE_MS,
	SELECTOR_PROFILE_VALIDATION_GRACE_MS,
	pendingResolutions,
	selectorModelState,
} from "./constants.js";
import {
	isSelectorModelErrorRateLimit,
	isSelectorModelRateLimited,
	resolveProfileWithModel,
	shouldSkipSelectorModelForBudget,
} from "./model.js";
import { captureSelectorSnapshot } from "./snapshot.js";
import {
	buildPageKey,
	compactSelectors,
	defaultSelectorRecord,
	hasRequiredSelectors,
	normalizePageKey,
} from "./utils.js";

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
		requireSemanticTextIncludes?: string[];
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
				(options?.maxTextLength && options.maxTextLength >= 0) ||
				(options?.requireSemanticTextIncludes &&
					options.requireSemanticTextIncludes.length > 0)
			) {
				const textPayload = await page
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
									return {
										textLength: 0,
										semanticText: "",
									};
								}
								const visibleText = (node.innerText || node.textContent || "")
									.replace(/\s+/g, " ")
									.trim();
								const semanticText = [
									visibleText,
									node.getAttribute("aria-label") || "",
									node.getAttribute("title") || "",
								]
									.join(" ")
									.replace(/\s+/g, " ")
									.trim()
									.toLowerCase();
								return {
									textLength: visibleText.length,
									semanticText,
								};
							} catch {
								return {
									textLength: 0,
									semanticText: "",
								};
							}
						},
						{
							candidateSelector: selector,
							candidateIndex: index,
						},
					)
					.catch(() => ({
						textLength: 0,
						semanticText: "",
					}));
				if (
					options?.minTextLength &&
					textPayload.textLength < options.minTextLength
				) {
					continue;
				}
				if (
					options?.maxTextLength &&
					textPayload.textLength > options.maxTextLength
				) {
					continue;
				}
				if (
					options?.requireSemanticTextIncludes &&
					!options.requireSemanticTextIncludes.every((token) =>
						textPayload.semanticText.includes(token.toLowerCase()),
					)
				) {
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
	options?: { relaxCompose?: boolean; skipContentFilter?: boolean },
): Promise<SelectorProfile | null> {
	const sanitizedSelectors = compactSelectors(profile.selectors);
	const selectors = defaultSelectorRecord();

	selectors.editor = await validateVisibleSelectors(
		page,
		sanitizedSelectors.editor,
		{
			label: `${profile.provider}/${profile.stage}/editor`,
			requireEditable: options?.relaxCompose ? false : true,
		},
	);
	selectors.submitButton = await validateVisibleSelectors(
		page,
		sanitizedSelectors.submitButton,
		{
			label: `${profile.provider}/${profile.stage}/submitButton`,
			requireEnabled: true,
		},
	);
	const providerResponseMin =
		PROVIDER_MIN_RESPONSE_CHARS[profile.provider] ?? DEFAULT_MIN_RESPONSE_CHARS;
	const responseMinTextLength =
		profile.stage === "response" ? Math.min(providerResponseMin, 50) : 0;
	selectors.response = await validateVisibleSelectors(
		page,
		sanitizedSelectors.response,
		{
			label: `${profile.provider}/${profile.stage}/response`,
			minTextLength: responseMinTextLength,
			minHeight: profile.stage === "response" ? 80 : 0,
			disallowEditableDescendant: profile.stage === "response",
		},
	);
	if (profile.stage === "response" && selectors.response.length > 0 && !options?.skipContentFilter) {
		selectors.response = await filterAnswerLikeResponseSelectors(
			page,
			selectors.response,
		);
	}
	selectors.sourcesButton = await validateVisibleSelectors(
		page,
		sanitizedSelectors.sourcesButton,
		{
			label: `${profile.provider}/${profile.stage}/sourcesButton`,
			requireSemanticTextIncludes: ["sources"],
		},
	);
	selectors.sourcePanel = await validateVisibleSelectors(
		page,
		sanitizedSelectors.sourcePanel,
		{
			label: `${profile.provider}/${profile.stage}/sourcePanel`,
		},
	);
	selectors.sourceItem = await validateVisibleSelectors(
		page,
		sanitizedSelectors.sourceItem,
		{
			label: `${profile.provider}/${profile.stage}/sourceItem`,
		},
	);

	if (!hasRequiredSelectors(profile.stage, selectors, requiredFields)) {
		return null;
	}

	return {
		...profile,
		selectors,
	};
}

async function filterAnswerLikeResponseSelectors(
	page: Page,
	selectors: string[],
): Promise<string[]> {
	const accepted: string[] = [];

	for (const selector of selectors) {
		const looksAnswerLike = await page
			.evaluate(({ candidateSelector }) => {
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

				function textOf(element: Element | null): string {
					if (!(element instanceof HTMLElement)) return "";
					return (element.innerText || element.textContent || "")
						.replace(/\s+/g, " ")
						.trim();
				}

				function lastVisibleMatch(): HTMLElement | null {
					try {
						const matches = Array.from(
							document.querySelectorAll(candidateSelector),
						).filter(isVisible) as HTMLElement[];
						return matches.at(-1) ?? null;
					} catch {
						return null;
					}
				}

				const candidate = lastVisibleMatch();
				if (!candidate) return false;

				const text = textOf(candidate);
				// Only reject completely empty or near-empty containers — short factual
				// answers ("Paris", "Yes", "42") are valid responses. The old threshold
				// of 60 chars caused short answers to fail validation, which deleted the
				// cached selector and re-called the LLM unnecessarily.
				if (text.length < 20) return false;

				if (
					candidate.querySelector(
						'textarea, input:not([type="hidden"]), [contenteditable="true"], [role="textbox"]',
					)
				) {
					return false;
				}

				const blockCount = candidate.querySelectorAll(
					"p,li,pre,table,blockquote,h1,h2,h3,h4,h5,h6",
				).length;
				const buttons = Array.from(
					candidate.querySelectorAll("button,[role='button']"),
				).filter(isVisible).length;
				const anchors = Array.from(
					candidate.querySelectorAll("a[href]"),
				).filter(
					(element): element is HTMLAnchorElement =>
						element instanceof HTMLAnchorElement && isVisible(element),
				);

				// Removed: rejection of responses ending with "?" — Q&A format answers
				// like "What would you like to know?" are valid AI responses.
				if (buttons >= 8 && text.length < 600) return false;
				if (anchors.length >= 12 && blockCount <= 1 && text.length < 800) {
					return false;
				}

				return true;
			}, { candidateSelector: selector })
			.catch(() => false);

		if (looksAnswerLike) {
			accepted.push(selector);
		}
	}

	return accepted;
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
	const longestContent = snapshot.content.reduce(
		(max, item) => Math.max(max, item.textLength),
		0,
	);
	const longestGroup = snapshot.groups.reduce(
		(max, item) => Math.max(max, item.textLength),
		0,
	);
	return longestContent >= 80 || longestGroup >= 80;
}

/**
 * Resolves a selector profile for the given provider and stage.
 *
 * Flow:
 *  1. Check disk cache — return immediately if valid and within TTL.
 *  2. Capture a single DOM snapshot.
 *  3. Call the selector model if allowed.
 *  4. Validate the generated profile against live DOM.
 *  5. Persist to disk cache and return.
 *
 * Concurrent calls for the same provider+stage+pageKey share one in-flight
 * resolution via `pendingResolutions`.
 */
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
	const pageKey = buildPageKey(page.url());

	// 1. Check disk cache
	if (!options?.forceRefresh) {
		const cached = (await readCachedProfile(provider, stage, pageKey)) ?? null;
		if (cached) {
			const profileAge = Date.now() - new Date(cached.createdAt).getTime();
			if (profileAge <= SELECTOR_PROFILE_MAX_AGE_MS) {
				// Grace period: skip DOM re-validation for very recently generated profiles.
				// Prevents false negatives during page transitions and avoids redundant
				// page.evaluate calls for profiles written seconds ago.
				if (profileAge <= SELECTOR_PROFILE_VALIDATION_GRACE_MS) {
					if (hasRequiredSelectors(stage, cached.selectors, options?.requiredFields)) {
						return cached;
					}
				}
				const valid = await validateProfile(
					page,
					cached,
					options?.requiredFields,
					{ relaxCompose: stage === "compose", skipContentFilter: true },
				);
				if (valid) return valid;
			}
			// Cache expired or invalid — delete so it gets re-resolved
			await deleteCachedProfile(cached).catch(() => {});
		}
	}

	if (options?.allowModel === false) {
		return null;
	}

	if (isSelectorModelRateLimited()) {
		if (!selectorModelState.rateLimitLogged) {
			logger.warn(
				`selector model rate limited — using cache only for ${Math.ceil((selectorModelState.disabledUntil - Date.now()) / 60000)} more minute(s)`,
			);
			selectorModelState.rateLimitLogged = true;
		}
		return null;
	}

	if (shouldSkipSelectorModelForBudget()) {
		return null;
	}

	// Dedup concurrent calls for the same provider+stage+pageKey
	const psKey = `${provider}:${stage}:${normalizePageKey(pageKey)}`;
	const pending = pendingResolutions.get(psKey);
	if (pending) return pending;

	const resolution = (async () => {
		try {
			// 2. Single DOM snapshot — no stability polling needed for a settled page
			const snapshot = await captureSelectorSnapshot(page, stage);
			if (!isSnapshotReady(snapshot)) return null;

			selectorModelState.callsThisProcess += 1;
			logger.debug(
				`[selector:${provider}/${stage}] calling model (call ${selectorModelState.callsThisProcess}/${MAX_SELECTOR_MODEL_CALLS_PER_PROCESS}) pageKey=${snapshot.pageKey}`,
			);

			// Capture a screenshot for visual stages (response/sources). JPEG at 60%
			// quality keeps token cost low while giving the model enough fidelity to
			// distinguish the response container and sources panel from surrounding UI.
			let screenshotBase64: string | undefined;
			if (stage === "response" || stage === "sources") {
				screenshotBase64 = await page
					.screenshot({ type: "jpeg", quality: 60, fullPage: false })
					.then((buf) => buf.toString("base64"))
					.catch(() => undefined);
			}

			// 3. Selector model
			const generated = await resolveProfileWithModel(provider, stage, snapshot, screenshotBase64);
			if (!generated) return null;

			// 4. Validate against live DOM
			const validated = await validateProfile(
				page,
				generated,
				options?.requiredFields,
			);
			if (!validated) return null;

			// 5. Persist
			await writeCachedProfile(validated);
			return validated;
		} catch (error) {
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
			pendingResolutions.delete(psKey);
		}
	})();

	pendingResolutions.set(psKey, resolution);
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

export async function invalidateSelectorProfileForPage(
	page: Page,
	provider: Provider,
	stage: SelectorStage,
): Promise<void> {
	try {
		const pageKey = buildPageKey(page.url());
		const cached = await readCachedProfile(provider, stage, pageKey);
		if (cached) {
			await deleteCachedProfile(cached);
		}
		logger.debug(
			`invalidated ${provider}/${stage} selector profiles for ${pageKey}`,
		);
	} catch {
		// Best-effort
	}
}
