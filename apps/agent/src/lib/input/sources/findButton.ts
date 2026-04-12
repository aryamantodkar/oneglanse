import type { Provider } from "@oneglanse/types";
import type { Locator, Page } from "playwright";

export async function findSourcesButton(
	page: Page,
	_provider?: Provider,
): Promise<Locator | null> {
	const buttonCount = await page.locator("button, [role='button']").count();
	if (buttonCount === 0) return null;

	const bestIndex = await page.evaluate((_unused) => {
		const normalize = (text: string | null | undefined) =>
			text?.toLowerCase().replace(/\s+/g, " ").trim() || "";
		type ScoredMatch = { index: number; score: number };

		const getVisibleText = (el: HTMLElement) =>
			normalize(
				Array.from(el.querySelectorAll("*"))
					.map((child) => child.textContent || "")
					.join(" "),
			);

		return Array.from(
			document.querySelectorAll("button, [role='button'], [role='tab']"),
		)
			.map((el, index) => {
				if (!(el instanceof HTMLElement)) {
					return null;
				}

				const role = el.getAttribute("role");
				if (
					role === "tab" ||
					el.hasAttribute("aria-controls") ||
					el.id?.includes("trigger")
				) {
					return null;
				}

				const isAction = el.tagName === "BUTTON" || role === "button";
				if (!isAction) return null;

				const style = window.getComputedStyle(el);
				if (style.display === "none" || style.visibility === "hidden") {
					return null;
				}

				const text = getVisibleText(el);
				const aria = normalize(el.getAttribute("aria-label"));

				let score = 0;
				if (/\b\d+\s*sources?\b/.test(text)) score += 120;
				if (aria.includes("sources")) score += 90;
				if (text === "sources") score += 80;
				if (text.includes("sources")) score += 50;
				if (score <= 0) return null;
				score += index * 0.001;

				return { index, score };
			})
			.filter((match): match is ScoredMatch => match !== null)
			.sort((a, b) => b.score - a.score || b.index - a.index)
			[0]?.index ?? -1;
	}, null);

	return bestIndex >= 0
		? page.locator("button, [role='button']").nth(bestIndex)
		: null;
}
