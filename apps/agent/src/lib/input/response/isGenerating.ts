import type { Provider } from "@oneglanse/types";
import {
	PROVIDER_MODEL_RESPONSE_SELECTORS,
	PROVIDER_RESPONSE_GENERATION_SELECTORS,
} from "@oneglanse/utils";
import type { Page } from "playwright";

export async function getGenerationStateSignature(
	page: Page,
	provider: Provider,
) : Promise<string> {
	return await page.evaluate((selectors) =>
		(selectors || [])
			.map((selector) => {
				const parts = Array.from(document.querySelectorAll(selector)).map((node) => {
					const element = node as HTMLElement;
					const style = window.getComputedStyle(element);
					const visible =
						element.offsetParent !== null &&
						style.visibility !== "hidden" &&
						style.display !== "none";
					const text = (element.textContent || "").trim();
					const ariaLabel = element.getAttribute("aria-label") || "";
					const disabled = element.getAttribute("disabled") ? "1" : "0";
					return `${visible ? 1 : 0}:${text}:${ariaLabel}:${disabled}`;
				});
				return `${selector}=>${parts.join("|")}`;
			})
			.join("||"),
		PROVIDER_RESPONSE_GENERATION_SELECTORS[provider] || [],
	);
}

export async function hasVisibleGenerationIndicator(
	page: Page,
	provider: Provider,
): Promise<boolean> {
	return await page.evaluate((selectors) =>
		(selectors || []).some((selector) =>
			Array.from(document.querySelectorAll(selector)).some((node) => {
				const element = node as HTMLElement;
				const style = window.getComputedStyle(element);
				return (
					element.offsetParent !== null &&
					style.visibility !== "hidden" &&
					style.display !== "none"
				);
			}),
		),
		PROVIDER_RESPONSE_GENERATION_SELECTORS[provider] || [],
	);
}

export async function getResponseStateSignature(
	page: Page,
	provider: Provider,
): Promise<{ signature: string; textLength: number }> {
	return await page.evaluate((selectors) => {
		const visible = (element: Element | null): element is HTMLElement => {
			if (!(element instanceof HTMLElement)) return false;
			const style = window.getComputedStyle(element);
			return (
				element.offsetParent !== null &&
				style.visibility !== "hidden" &&
				style.display !== "none"
			);
		};

		const elements = (selectors || [])
			.flatMap((selector) => Array.from(document.querySelectorAll(selector)))
			.filter(
				(el): el is HTMLElement =>
					visible(el) && (el.innerText || "").trim().length > 0,
			);

		const latest = elements.at(-1) ?? null;
		if (!latest) {
			return { signature: "", textLength: 0 };
		}

		const text = (latest.innerText || "").replace(/\s+/g, " ").trim();
		return {
			signature: `${text.length}:${latest.innerHTML.length}:${latest.childElementCount}:${text.slice(-120)}`,
			textLength: text.length,
		};
	}, PROVIDER_MODEL_RESPONSE_SELECTORS[provider] || []);
}
