import type { SelectorProfile } from "@oneglanse/types";

export const SELECTOR_PROFILE_VERSION = 1;
export const SELECTOR_MODEL = "gpt-4.1";
export const MAX_SELECTORS_PER_FIELD = 5;
export const SELECTOR_MODEL_RATE_LIMIT_TTL_MS = 15 * 60_000;
export const MAX_SELECTOR_MODEL_CALLS_PER_PROCESS = 30;
// Profiles older than this trigger a fresh LLM resolution even when the cached
// selectors still match — ensures UI changes are picked up within a bounded window.
export const SELECTOR_PROFILE_MAX_AGE_MS = 7 * 24 * 60 * 60_000; // 7 days

export const pendingResolutions = new Map<string, Promise<SelectorProfile | null>>();

export const selectorModelState = {
	callsThisProcess: 0,
	disabledUntil: 0,
	budgetLogged: false,
	rateLimitLogged: false,
};
