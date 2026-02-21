import type { Provider } from "@onescope/types";
import {
	MODEL_RESPONSE_SELECTORS,
	RESPONSE_GENERATION_SELECTORS,
} from "@onescope/utils";
import type { Locator, Page } from "playwright";
import { extractAnthropicBlocks } from "./extractAnthropicBlocks.js";

export async function getLastAssistantText(
	page: Page,
	provider: Provider,
	fetchingResponses = false,
): Promise<string> {
	for (const selector of MODEL_RESPONSE_SELECTORS) {
		const nodes = page.locator(selector);
		const count = await nodes.count();
		if (count === 0) continue;

		for (let i = count - 1; i >= 0; i--) {
			const el = nodes.nth(i);

			try {
				if (!(await el.isVisible())) continue;

				let text = "";

				if (provider === "anthropic" && fetchingResponses) {
					text = await extractAnthropicBlocks(el, "text");
				} else {
					text = await el.evaluate((el) => {
						if (!(el instanceof HTMLElement)) return "";
						return el.innerText?.trim() || el.textContent?.trim() || "";
					});
				}

				if (text.length > 0) return text;
			} catch {}
		}
	}

	return "";
}

export async function isGenerating(page: Page): Promise<boolean> {
	for (const selector of RESPONSE_GENERATION_SELECTORS) {
		if (
			await page
				.locator(selector)
				.isVisible()
				.catch(() => false)
		) {
			return true;
		}
	}
	return false;
}

export async function findLastAssistantLocator(
	page: Page,
): Promise<Locator | null> {
	for (const selector of MODEL_RESPONSE_SELECTORS) {
		const locator = page.locator(selector);
		if ((await locator.count()) === 0) continue;
		return locator.last();
	}
	return null;
}

export async function findLastAssistantBox(page: Page) {
	const locator = await findLastAssistantLocator(page);
	return locator ? await locator.boundingBox() : null;
}
