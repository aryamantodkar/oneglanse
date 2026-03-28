import { NotFoundError } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import type { Locator, Page } from "playwright";
import { findActiveEditor } from "./findEditor.js";

export async function waitForEditorReady(
	page: Page,
	provider: Provider,
): Promise<Locator> {
	const start = Date.now();
	const TIMEOUT = 10000;

	while (Date.now() - start < TIMEOUT) {
		const input = await findActiveEditor(page, provider).catch(() => null);
		if (!input) {
			await page.waitForTimeout(200);
			continue;
		}

		const state = await input.getEditableState().catch(() => null);
		const ready = Boolean(state?.connected && state.visible && state.editable);

		if (ready) return input;

		await page.waitForTimeout(200);
	}

	throw new NotFoundError(`editor for ${provider}`);
}
