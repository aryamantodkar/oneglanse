import type { Page } from "playwright";
import { pageHealthCheck } from "../../../lib/browser/healthCheck.js";

export async function isPerplexityAuthenticated(
	page: Page,
	skipHealthCheck = false,
): Promise<boolean> {
	if (!page.url().startsWith("https://www.perplexity.ai")) return false;

	// Wait for the page to be interactive
	await page
		.waitForLoadState("networkidle", { timeout: 10000 })
		.catch(() => {});

	// Check for UI elements with retry logic
	let hasProfileUI = false;
	for (let i = 0; i < 3; i++) {
		hasProfileUI = await page.evaluate(() => {
			// User avatar (strongest signal)
			if (document.querySelector('img[alt="User avatar"]')) {
				return true;
			}

			// Account dropdown trigger
			if (
				document.querySelector('[aria-haspopup="menu"][data-state]') &&
				document.querySelector("button img")
			) {
				return true;
			}

			// Account label under avatar
			const accountLabel = Array.from(document.querySelectorAll("div")).some(
				(el) => el.textContent?.trim() === "Account",
			);

			return accountLabel;
		});

		if (hasProfileUI) break;

		// Wait a bit before retrying
		await page.waitForTimeout(2000);
	}

	if (!hasProfileUI) return false;

	// Skip health check during local auth flow
	if (skipHealthCheck) {
		return true;
	}

	// Deep page health check — catches bot detection, CAPTCHAs, rate limits
	const health = await pageHealthCheck(page, "perplexity");
	return health.healthy;
}
