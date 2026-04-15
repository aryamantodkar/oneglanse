import { logger } from "@oneglanse/utils";
import type { Page } from "playwright";

const AI_OVERVIEW_SOURCE_ROOT_SELECTOR = '[data-container-id="rhs-col"]';
const AI_OVERVIEW_BUTTON_SELECTOR = '[role="button"], button';

function shouldClickSourceExpansionButton(text: string, aria: string): boolean {
	const t = `${text} ${aria}`.toLowerCase();

	if (t.includes("videos")) return false;
	if (t.includes("more")) return true;
	if (t.includes("all")) return true;
	if (t.includes("expand")) return true;
	return false;
}

export async function expandAIOverviewSources(page: Page): Promise<void> {
	const matches = await page.evaluate(
		({
			rootSelector,
			buttonSelector,
		}: {
			rootSelector: string;
			buttonSelector: string;
		}) => {
			const root = document.querySelector(rootSelector);
			if (!(root instanceof HTMLElement)) return [];

			return Array.from(root.querySelectorAll(buttonSelector))
				.map((button, index) => {
					if (!(button instanceof HTMLElement)) {
						return null;
					}

					const style = window.getComputedStyle(button);
					const rect = button.getBoundingClientRect();
					const visible =
						button.isConnected &&
						style.display !== "none" &&
						style.visibility !== "hidden" &&
						style.opacity !== "0" &&
						rect.width > 0 &&
						rect.height > 0;
					if (!visible) return null;

					return {
						index,
						text: (button.textContent || "").trim(),
						aria: button.getAttribute("aria-label")?.trim() || "",
					};
				})
				.filter(
					(
						match,
					): match is {
						index: number;
						text: string;
						aria: string;
					} => match !== null,
				);
		},
		{
			rootSelector: AI_OVERVIEW_SOURCE_ROOT_SELECTOR,
			buttonSelector: AI_OVERVIEW_BUTTON_SELECTOR,
		},
	);

	for (const match of matches) {
		if (!shouldClickSourceExpansionButton(match.text, match.aria)) {
			continue;
		}

		const button = page
			.locator(`${AI_OVERVIEW_SOURCE_ROOT_SELECTOR} ${AI_OVERVIEW_BUTTON_SELECTOR}`)
			.nth(match.index);
		const visible = await button.isVisible().catch(() => false);
		if (!visible) continue;

		logger.debug(
			`[ai-overview] expanding sources text="${match.text}" aria="${match.aria}"`,
		);
		await button.click({ timeout: 5_000 }).catch(() => {});
		await page.waitForTimeout(700);
	}
}
