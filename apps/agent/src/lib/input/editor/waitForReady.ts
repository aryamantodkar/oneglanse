import { NotFoundError } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import { PROVIDER_EDITOR_SELECTORS } from "@oneglanse/utils";
import type { Locator, Page } from "playwright";
import { detectBotPage } from "../response/detectBotPage.js";
import {
	findActiveEditor,
	findActiveEditorFromSelectors,
} from "./findEditor.js";

// Check for bot/login wall every N polls instead of every poll to avoid overhead.
const BOT_CHECK_EVERY_N_POLLS = 10; // ~2s intervals at 200ms per poll
const EDITOR_READY_TIMEOUT_MS = 10_000;
const PRIMARY_SELECTOR_GRACE_MS = 2_500;
const STABLE_POLLS_REQUIRED = 2;
const POLL_INTERVAL_MS = 200;

async function waitForInitialDomSettle(page: Page): Promise<void> {
	await page
		.waitForLoadState("domcontentloaded", { timeout: 4_000 })
		.catch(() => {});
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
	resolveCandidate: () => Promise<Locator | null>,
): Promise<Locator | null> {
	let stablePolls = 0;
	let lastLocator: Locator | null = null;

	while (stablePolls < STABLE_POLLS_REQUIRED) {
		const candidate = await resolveCandidate();
		if (!candidate) {
			stablePolls = 0;
			lastLocator = null;
			return null;
		}

		const ready = await isEditorReady(candidate);
		if (!ready) {
			stablePolls = 0;
			lastLocator = null;
			return null;
		}

		lastLocator = candidate;
		stablePolls += 1;
		if (stablePolls >= STABLE_POLLS_REQUIRED) {
			return lastLocator;
		}

		await page.waitForTimeout(POLL_INTERVAL_MS);
	}

	return lastLocator;
}

export async function waitForEditorReady(
	page: Page,
	provider: Provider,
): Promise<Locator> {
	await waitForInitialDomSettle(page);

	const start = Date.now();
	const primarySelector = PROVIDER_EDITOR_SELECTORS[provider]?.[0];
	let polls = 0;

	while (Date.now() - start < EDITOR_READY_TIMEOUT_MS) {
		const elapsedMs = Date.now() - start;
		const input =
			primarySelector && elapsedMs < PRIMARY_SELECTOR_GRACE_MS
				? await waitForStableEditorCandidate(page, () =>
						findActiveEditorFromSelectors(page, [primarySelector]).catch(
							() => null,
						),
					)
				: await waitForStableEditorCandidate(page, () =>
						findActiveEditor(page, provider).catch(() => null),
					);

		if (!input) {
			polls += 1;
			// Periodically check for login wall / bot page so we surface a clear
			// error instead of timing out with a generic "editor not found".
			if (polls % BOT_CHECK_EVERY_N_POLLS === 0) {
				await detectBotPage(page, provider);
			}
			await page.waitForTimeout(POLL_INTERVAL_MS);
			continue;
		}

		return input;
	}

	// Final bot/login check before throwing — gives a better error message than
	// "editor not found" when the real cause is session expiry.
	await detectBotPage(page, provider);
	throw new NotFoundError(`editor for ${provider}`);
}
