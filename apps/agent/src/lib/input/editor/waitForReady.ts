import type { Provider } from "@onescope/types";
import type { Locator, Page } from "playwright";
import { findActiveEditor } from "./findEditor.js";

export async function waitForEditorReady(
	page: Page,
	provider: Provider,
): Promise<Locator> {
	const start = Date.now();
	const TIMEOUT = 30000;

	while (Date.now() - start < TIMEOUT) {
		const input = await findActiveEditor(page, provider).catch(() => null);
		if (!input) {
			await page.waitForTimeout(200);
			continue;
		}

		const ready = await input
			.evaluate((el) => {
				if (!(el instanceof HTMLElement)) return false;
				if (!el.isConnected) return false;

				const rect = el.getBoundingClientRect();
				if (rect.width === 0 || rect.height === 0) return false;

				// Native inputs are inherently editable — skip the contenteditable check
				if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return true;

				if (el.getAttribute("contenteditable") !== "true") return false;

				// Can we actually mutate it?
				const before = el.innerText;
				el.innerText = "█";
				const ok = el.innerText.includes("█");
				el.innerText = before;

				return ok;
			})
			.catch(() => false);

		if (ready) return input;

		await page.waitForTimeout(200);
	}

	throw new Error(`Editor not ready for ${provider}`);
}
