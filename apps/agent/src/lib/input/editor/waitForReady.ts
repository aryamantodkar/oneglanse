import { NotFoundError } from "@oneglanse/errors";
import { resolveAppMode, type Provider } from "@oneglanse/types";
import { logger } from "@oneglanse/utils";
import type { Locator, Page } from "playwright";
import { env } from "../../../env.js";
import { primeSelectorProfile } from "../../selectors/index.js";
import { detectBotPage } from "../response/detectBotPage.js";
import {
	type EditorCandidate,
	findActiveEditorCandidate,
} from "./findEditor.js";

// Check for bot/login wall every N polls instead of every poll to avoid overhead.
const BOT_CHECK_EVERY_N_POLLS = 10; // ~2s intervals at 200ms per poll
const DEFAULT_EDITOR_READY_TIMEOUT_MS = 18_000;
// In local mode the user may need to complete an OAuth login flow before the
// editor appears. Give them up to 5 minutes rather than killing the browser.
const LOCAL_EDITOR_READY_TIMEOUT_MS = 5 * 60 * 1_000;
const EDITOR_READY_TIMEOUT_MS: Partial<Record<Provider, number>> = {
	gemini: 20_000,
};

const isLocalMode = resolveAppMode(env.ONEGLANSE_APP_MODE) === "local";
const STABLE_POLLS_REQUIRED = 2;
const POLL_INTERVAL_MS = 200;

async function waitForInitialDomSettle(page: Page): Promise<void> {
	await page
		.waitForLoadState("domcontentloaded", { timeout: 4_000 })
		.catch(() => {});
	await page.waitForLoadState("networkidle", { timeout: 2_500 }).catch(() => {});
	await page.waitForTimeout(150);
}

async function isEditorReady(input: Locator): Promise<boolean> {
	const state = await input.getEditableState().catch(() => null);
	return Boolean(
		state?.connected &&
			state.visible &&
			state.editable &&
			state.enabled &&
			state.acceptsTextInput,
	);
}

async function waitForStableEditorCandidate(
	page: Page,
	resolveCandidate: () => Promise<EditorCandidate | null>,
): Promise<EditorCandidate | null> {
	let stablePolls = 0;
	let lastCandidate: EditorCandidate | null = null;

	while (stablePolls < STABLE_POLLS_REQUIRED) {
		const candidate = await resolveCandidate();
		if (!candidate) {
			stablePolls = 0;
			lastCandidate = null;
			return null;
		}

		const ready = await isEditorReady(candidate.locator);
		if (!ready) {
			stablePolls = 0;
			lastCandidate = null;
			return null;
		}

		lastCandidate = candidate;
		stablePolls += 1;
		if (stablePolls >= STABLE_POLLS_REQUIRED) {
			return lastCandidate;
		}

		await page.waitForTimeout(POLL_INTERVAL_MS);
	}

	return lastCandidate;
}

export async function waitForEditorReady(
	page: Page,
	provider: Provider,
): Promise<Locator> {
	await waitForInitialDomSettle(page);

	const start = Date.now();
	const readyTimeoutMs = isLocalMode
		? LOCAL_EDITOR_READY_TIMEOUT_MS
		: (EDITOR_READY_TIMEOUT_MS[provider] ?? DEFAULT_EDITOR_READY_TIMEOUT_MS);
	let polls = 0;
	let primedComposeSelectors = false;

	while (Date.now() - start < readyTimeoutMs) {
		if (!primedComposeSelectors) {
			primedComposeSelectors = true;
			void primeSelectorProfile(page, provider, "compose");
		}

		const input = await waitForStableEditorCandidate(page, () =>
			findActiveEditorCandidate(page, provider).catch(() => null),
		);

		if (!input) {
			polls += 1;
			// Skip bot/login detection in local mode — the user may be on an OAuth
			// page (accounts.google.com etc.) intentionally. Firing detectBotPage
			// there misclassifies it as a session error and triggers a browser restart.
			if (!isLocalMode && polls % BOT_CHECK_EVERY_N_POLLS === 0) {
				await detectBotPage(page, provider);
			}
			await page.waitForTimeout(POLL_INTERVAL_MS);
			continue;
		}

		logger.debug(`found editor: ${input.selector}`);
		return input.locator;
	}

	// Final bot/login check before throwing — skipped in local mode since the
	// user may legitimately be on an OAuth page.
	if (!isLocalMode) {
		await detectBotPage(page, provider);
	}
	throw new NotFoundError(`editor for ${provider}`);
}
