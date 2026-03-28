import { NotFoundError } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import type { Locator, Page } from "playwright";
import { detectBotPage } from "../response/detectBotPage.js";
import { findActiveEditor } from "./findEditor.js";

// Check for bot/login wall every N polls instead of every poll to avoid overhead.
const BOT_CHECK_EVERY_N_POLLS = 10; // ~2s intervals at 200ms per poll

export async function waitForEditorReady(
	page: Page,
	provider: Provider,
): Promise<Locator> {
	const start = Date.now();
	const TIMEOUT = 10000;
	let polls = 0;

	while (Date.now() - start < TIMEOUT) {
		const input = await findActiveEditor(page, provider).catch(() => null);
		if (!input) {
			polls += 1;
			// Periodically check for login wall / bot page so we surface a clear
			// error instead of timing out with a generic "editor not found".
			if (polls % BOT_CHECK_EVERY_N_POLLS === 0) {
				await detectBotPage(page, provider);
			}
			await page.waitForTimeout(200);
			continue;
		}

		const state = await input.getEditableState().catch(() => null);
		const ready = Boolean(state?.connected && state.visible && state.editable);

		if (ready) return input;

		await page.waitForTimeout(200);
	}

	// Final bot/login check before throwing — gives a better error message than
	// "editor not found" when the real cause is session expiry.
	await detectBotPage(page, provider);
	throw new NotFoundError(`editor for ${provider}`);
}
