import { NotFoundError } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import type { Locator, Page } from "playwright";
import { findResolvedEditorCandidate } from "../../selectors/index.js";

export type EditorCandidate = {
	locator: Locator;
	selector: string;
};

export async function findActiveEditorCandidateFromSelectors(
	page: Page,
	selectors: string[],
): Promise<EditorCandidate> {
	for (const selector of selectors) {
		const nodes = page.locator(selector);

		const count = await nodes.count();
		for (let i = 0; i < count; i++) {
			const el = nodes.nth(i);

			try {
				const visible = await el.isVisible().catch(() => false);
				if (!visible) {
					continue;
				}

				const state = await el.getEditableState().catch(() => null);
				if (
					!(
						state?.connected &&
						state.visible &&
						state.editable &&
						state.enabled &&
						state.acceptsTextInput
					)
				) {
					continue;
				}

				const box = await el.boundingBox().catch(() => null);
				if (!box || box.width < 8 || box.height < 8) {
					continue;
				}

				await el.focus().catch(() => {});
				return { locator: el, selector };
			} catch (_error) {}
		}
	}

	throw new NotFoundError("active prompt editor");
}

export async function findActiveEditorFromSelectors(
	page: Page,
	selectors: string[],
): Promise<Locator> {
	const candidate = await findActiveEditorCandidateFromSelectors(
		page,
		selectors,
	);
	return candidate.locator;
}

export async function findActiveEditor(
	page: Page,
	provider?: Provider,
): Promise<Locator> {
	const candidate = await findActiveEditorCandidate(page, provider);
	return candidate.locator;
}

export async function findActiveEditorCandidate(
	page: Page,
	provider?: Provider,
): Promise<EditorCandidate> {
	const resolved = provider
		? await findResolvedEditorCandidate(page, provider)
		: null;
	if (resolved) {
		return resolved;
	}

	throw new NotFoundError(`editor${provider ? ` for ${provider}` : ""}`);
}
