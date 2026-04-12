import { ExternalServiceError } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import type { Locator, Page } from "playwright";

type BlockerCheck = {
	blocked: boolean;
	reason: string | null;
};

async function detectEditorBlocker(
	page: Page,
	input: Locator,
): Promise<BlockerCheck> {
	const box = await input.boundingBox().catch(() => null);
	if (!box || box.width < 8 || box.height < 8) {
		return { blocked: false, reason: null };
	}

	const insetX = Math.max(6, Math.min(24, box.width * 0.12));
	const insetY = Math.max(6, Math.min(18, box.height * 0.2));
	const points = [
		{ x: box.x + box.width / 2, y: box.y + box.height / 2 },
		{ x: box.x + insetX, y: box.y + insetY },
		{ x: box.x + box.width - insetX, y: box.y + insetY },
	];

	return await page.evaluate((samples) => {
		const isEditorLike = (element: Element | null): boolean =>
			Boolean(
				element?.closest(
					'[contenteditable="true"], textarea, input, [role="textbox"], [role="combobox"]',
				),
			);

		for (const sample of samples) {
			const top = document.elementFromPoint(sample.x, sample.y);
			if (!top) continue;
			if (isEditorLike(top)) continue;

			const blocker =
				top.closest(
					'[role="dialog"], [aria-modal="true"], [popover], [data-state="open"]',
				) || top;
			if (!(blocker instanceof HTMLElement)) continue;

			const style = window.getComputedStyle(blocker);
			if (
				style.display === "none" ||
				style.visibility === "hidden" ||
				style.pointerEvents === "none"
			) {
				continue;
			}

			const rect = blocker.getBoundingClientRect();
			if (rect.width < 120 || rect.height < 40) continue;

			const text = (blocker.textContent || "").replace(/\s+/g, " ").trim();
			const label =
				blocker.getAttribute("aria-label") ||
				blocker.getAttribute("role") ||
				blocker.tagName.toLowerCase();

			return {
				blocked: true,
				reason: `${label}:${text.slice(0, 120)}`,
			};
		}

		return { blocked: false, reason: null };
	}, points);
}

export async function ensureEditorNotBlocked(
	page: Page,
	input: Locator,
	provider: Provider,
): Promise<void> {
	const result = await detectEditorBlocker(page, input);
	if (!result.blocked) return;

	throw new ExternalServiceError(
		provider,
		`Editor blocked by overlay: ${result.reason ?? "unknown blocker"}`,
	);
}
