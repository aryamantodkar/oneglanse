import type { Provider } from "@onescope/types";
import {
	MODEL_RESPONSE_SELECTORS,
	RESPONSE_GENERATION_SELECTORS,
} from "@onescope/utils";
import type { Locator, Page } from "playwright";

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

				if (!fetchingResponses) {
					text = await el.evaluate((el) => {
						if (!(el instanceof HTMLElement)) return "";
						return el.innerText?.trim() || el.textContent?.trim() || "";
					});
				} else {
					text = await el.evaluate((root, provider) => {
						if (!(root instanceof HTMLElement)) return "";

						if (provider === "anthropic") {
							// Find all standard-markdown blocks
							const blocks = Array.from(
								root.querySelectorAll<HTMLElement>(".standard-markdown"),
							);

							// Filter to only visible blocks (not inside collapsed/hidden containers)
							const visibleBlocks = blocks.filter((block) => {
								// Check if block is inside a hidden overflow container
								let parent = block.parentElement;
								while (parent && parent !== root) {
									const style = window.getComputedStyle(parent);

									// Skip if parent is hidden
									if (
										style.opacity === "0" ||
										style.height === "0px" ||
										style.display === "none" ||
										(parent.classList.contains("overflow-hidden") &&
											parent.style.height === "0px")
									) {
										return false;
									}

									parent = parent.parentElement;
								}
								return true;
							});

							// Return the text from visible blocks only
							return visibleBlocks
								.map((b) => b.innerText?.trim() || b.textContent?.trim() || "")
								.filter(Boolean)
								.join("\n\n");
						}

						return root.innerText?.trim() || root.textContent?.trim() || "";
					}, provider);
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
