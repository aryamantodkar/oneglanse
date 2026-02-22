import { SOURCES_SELECTORS } from "@onescope/utils";
import type { Locator, Page } from "playwright";
import { findLastAssistantBox } from "../response/findElement.js";

export async function findSourcesButton(page: Page): Promise<Locator | null> {
	const assistantBox = await findLastAssistantBox(page);
	if (!assistantBox) return null;

	let sourcesButton: Locator | null = null;
	let minDistance = Number.POSITIVE_INFINITY;

	for (const selector of SOURCES_SELECTORS) {
		const buttons = page.locator(selector);
		const count = await buttons.count();

		for (let i = 0; i < count; i++) {
			const btn = buttons.nth(i);

			if (!(await btn.isVisible().catch(() => false))) continue;

			const box = await btn.boundingBox();
			if (!box) continue;

			// Must be visually below assistant message
			const deltaY = box.y - (assistantBox.y + assistantBox.height);
			if (deltaY < -8) continue;

			if (deltaY < minDistance) {
				minDistance = deltaY;
				sourcesButton = btn;
			}
		}
	}

	return sourcesButton;
}
