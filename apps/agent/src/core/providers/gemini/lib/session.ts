import { ExternalServiceError } from "@oneglanse/errors";
import type { Page } from "playwright";
import { clickLocatorLikeUser } from "../../../../lib/browser/humanBehavior.js";

const GEMINI_CONSENT_SELECTOR =
	"button#L2AGLb, button#W0wltc, form[action*='consent.google.com'] button";

export async function handleGeminiConsentPage(page: Page): Promise<void> {
	const url = page.url();
	if (!url.includes("consent.google.com")) return;

	const consentBtn = page.locator(GEMINI_CONSENT_SELECTOR).first();
	const visible = await consentBtn.isVisible({ timeout: 3000 }).catch(() => false);
	if (visible) {
		await clickLocatorLikeUser(page, consentBtn, { timeout: 4000 }).catch(() => {});
		await page.waitForTimeout(1000);
		if (!page.url().includes("consent.google.com")) return;
	}

	throw new ExternalServiceError(
		"gemini",
		"Google consent page not dismissible — proxy IP requires Google consent",
		429,
	);
}

function isGeminiAppUrl(rawUrl: string): boolean {
	try {
		const url = new URL(rawUrl);
		return (
			url.hostname === "gemini.google.com" &&
			url.pathname.startsWith("/app/") &&
			url.pathname.length > "/app/".length
		);
	} catch {
		return false;
	}
}

export async function waitForGeminiConversationUrl(
	page: Page,
	preSubmitUrl: string,
): Promise<boolean | undefined> {
	if (isGeminiAppUrl(preSubmitUrl)) {
		return undefined;
	}

	const deadline = Date.now() + 4000;
	while (Date.now() < deadline) {
		if (isGeminiAppUrl(await page.getUrl().catch(() => page.url()))) {
			return true;
		}
		await page.waitForTimeout(100);
	}

	return false;
}
