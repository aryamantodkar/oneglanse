import type { Provider } from "@oneglanse/types";
import type { Locator, Page } from "playwright";
import { findLastAssistantBox } from "../response/findElement.js";

const MAX_SOURCE_BUTTON_DISTANCE_PX = 320;

function getSourceButtonCandidates(page: Page): Locator[] {
	return [
		page.locator("button").filter({ hasText: /\d+\s+sources?/i }),
		page.locator('[role="button"]').filter({ hasText: /\d+\s+sources?/i }),
		page.locator("button").filter({ hasText: /\d+\s+citations?/i }),
		page.locator('[role="button"]').filter({ hasText: /\d+\s+citations?/i }),
	];
}

function horizontalOverlapRatio(
	a: { x: number; width: number },
	b: { x: number; width: number },
): number {
	const left = Math.max(a.x, b.x);
	const right = Math.min(a.x + a.width, b.x + b.width);
	const overlap = Math.max(0, right - left);
	return overlap / Math.max(1, Math.min(a.width, b.width));
}

export async function findSourcesButton(
	page: Page,
	provider: Provider,
): Promise<Locator | null> {
	const assistantBox = await findLastAssistantBox(page, provider);
	if (!assistantBox) return null;

	let sourcesButton: Locator | null = null;
	let minDistance = Number.POSITIVE_INFINITY;

	for (const buttons of getSourceButtonCandidates(page)) {
		const count = await buttons.count();

		for (let i = 0; i < count; i++) {
			const btn = buttons.nth(i);

			if (!(await btn.isVisible().catch(() => false))) continue;

			const box = await btn.boundingBox();
			if (!box) continue;

			// Must be visually below assistant message
			const deltaY = box.y - (assistantBox.y + assistantBox.height);
			if (deltaY < -8) continue;
			if (deltaY > MAX_SOURCE_BUTTON_DISTANCE_PX) continue;

			// Must materially overlap the latest response horizontally so we do
			// not drift to source/citation buttons belonging to another card.
			if (horizontalOverlapRatio(box, assistantBox) < 0.25) continue;

			if (deltaY < minDistance) {
				minDistance = deltaY;
				sourcesButton = btn;
			}
		}
	}

	return sourcesButton;
}
