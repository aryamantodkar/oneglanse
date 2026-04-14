import { ExternalServiceError } from "@oneglanse/errors";
import { logger } from "@oneglanse/utils";
import type { Page } from "playwright";
import { navigateWithRetry } from "../../../../lib/browser/navigate.js";

const GOOGLE_CONSENT_SELECTOR =
	"button#L2AGLb, button#W0wltc, form[action*='consent.google.com'] button";
const SEARCH_RESULTS_WAIT_MS = 8_000;

const warmedPages = new WeakSet<Page>();

export async function dismissGoogleConsentDialog(page: Page): Promise<void> {
	const consentBtn = page.locator(GOOGLE_CONSENT_SELECTOR).first();
	const visible = await consentBtn.isVisible({ timeout: 2500 }).catch(() => false);
	if (!visible) return;

	await consentBtn.click({ timeout: 4000 }).catch(() => {});
	await page.waitForTimeout(1000);
}

export function assertAIOverviewPageNotBlocked(page: Page): void {
	const url = page.url();
	if (url.includes("/sorry/")) {
		throw new ExternalServiceError(
			"ai-overview",
			"Google bot detection triggered (sorry page) — proxy IP blocked",
			429,
		);
	}

	if (url.includes("accounts.google.com")) {
		throw new ExternalServiceError(
			"ai-overview",
			"Google redirected to login page — session cookie missing or expired",
			401,
		);
	}
}

export async function ensureAIOverviewGoogleSession(page: Page): Promise<void> {
	if (warmedPages.has(page)) return;

	logger.log("[ai-overview] warming up Google cookies");
	await navigateWithRetry(page, "https://www.google.com/", {
		waitUntil: "domcontentloaded",
		timeout: 30000,
	});
	assertAIOverviewPageNotBlocked(page);
	await dismissGoogleConsentDialog(page);
	warmedPages.add(page);
}

export async function waitForAIOverviewSearchResults(
	page: Page,
): Promise<void> {
	const deadline = Date.now() + SEARCH_RESULTS_WAIT_MS;

	while (Date.now() < deadline) {
		if (page.url().includes("/search?")) {
			return;
		}

		assertAIOverviewPageNotBlocked(page);
		await page.waitForTimeout(150);
	}

	throw new ExternalServiceError(
		"ai-overview",
		`Not on search results page after submission (url: ${page.url()})`,
	);
}
