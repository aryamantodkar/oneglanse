import type { Locator, Page } from "playwright";

export async function findSourcesButton(page: Page): Promise<Locator | null> {
	const buttonCount = await page.locator("button").count();
	if (buttonCount === 0) return null;

	const lastMatchIndex = await page.evaluate((_count) =>
		Array.from(document.querySelectorAll("button"))
			.map((button, index) => ({ button, index }))
			.filter(({ button }) =>
				button.offsetParent !== null &&
				(button.textContent || "").trim().toLowerCase() === "sources",
			)
			.pop()?.index ?? -1,
	buttonCount);

	return lastMatchIndex >= 0 ? page.locator("button").nth(lastMatchIndex) : null;
}
