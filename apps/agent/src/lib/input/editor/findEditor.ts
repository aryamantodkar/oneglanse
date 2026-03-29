import { NotFoundError } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import { logger, PROVIDER_EDITOR_SELECTORS } from "@oneglanse/utils";
import type { Locator, Page } from "playwright";

type EditorCandidate = {
	locator: Locator;
	score: number;
};

function scoreSelector(selector: string): number {
	let score = 0;
	if (selector.includes("#")) score += 5;
	if (selector.includes("[aria-label")) score += 4;
	if (selector.includes("[data-lexical-editor")) score += 4;
	if (selector.includes("textarea")) score += 3;
	if (selector.includes("rich-textarea")) score += 3;
	if (selector.includes("ql-editor")) score += 3;
	if (selector.includes('[role="textbox"]')) score -= 2;
	if (selector.includes("div[contenteditable")) score -= 3;
	return score;
}

async function scoreEditorCandidate(
	el: Locator,
	selector: string,
): Promise<number | null> {
	try {
		const visible = await el.isVisible().catch(() => false);
		if (!visible) return null;

		const state = await el.getEditableState().catch(() => null);
		if (!(state?.connected && state.visible && state.editable)) {
			return null;
		}

		const box = await el.boundingBox().catch(() => null);
		if (!box || box.width < 8 || box.height < 8) {
			return null;
		}

		const rawValue = await el.readInputValue().catch(() => "");
		let score = scoreSelector(selector);
		score += Math.min(rawValue.length, 40) > 0 ? 1 : 0;
		score += box.width >= 40 ? 1 : 0;
		score += box.height >= 20 ? 1 : 0;
		return score;
	} catch {
		return null;
	}
}

export async function findActiveEditor(
	page: Page,
	provider?: Provider,
): Promise<Locator> {
	const fallbackSelectors = [
		...new Set(Object.values(PROVIDER_EDITOR_SELECTORS).flat()),
	];
	const selectors = provider
		? PROVIDER_EDITOR_SELECTORS[provider] || fallbackSelectors
		: fallbackSelectors;

	for (const selector of selectors) {
		const nodes = page.locator(selector);

		const count = await nodes.count();
		let bestCandidate: EditorCandidate | null = null;
		for (let i = 0; i < count; i++) {
			const el = nodes.nth(i);

			try {
				const score = await scoreEditorCandidate(el, selector);
				if (score === null) {
					continue;
				}

				if (!bestCandidate || score > bestCandidate.score) {
					bestCandidate = { locator: el, score };
				}
			} catch {
				logger.debug(`found but hidden: ${selector}`);
			}
		}

		if (bestCandidate) {
			await bestCandidate.locator.focus().catch(() => {});
			logger.debug(`found editor: ${selector}`);
			return bestCandidate.locator;
		}
	}

	throw new NotFoundError("active prompt editor");
}
