import { ExternalServiceError } from "@oneglanse/errors";
import type { Page } from "playwright";
import { clickLocatorLikeUser } from "../../../lib/browser/humanBehavior.js";
import { extractAssistantMarkdown } from "../../../lib/input/markdown/toMarkdown.js";
import { waitForAssistantToFinish } from "../../../lib/input/response/waitForFinish.js";
import { GOOGLE_CONSENT_SELECTOR } from "../_shared/google.js";
import type { ProviderConfig } from "../types.js";

async function handleConsentPage(page: Page): Promise<void> {
	const url = page.url();
	if (!url.includes("consent.google.com")) return;

	// Consent page detected — try to dismiss it
	const consentBtn = page.locator(GOOGLE_CONSENT_SELECTOR).first();
	const visible = await consentBtn.isVisible({ timeout: 3000 }).catch(() => false);
	if (visible) {
		await clickLocatorLikeUser(page, consentBtn, { timeout: 4000 }).catch(() => {});
		await page.waitForTimeout(1000);
		// Confirm we navigated away from consent
		if (!page.url().includes("consent.google.com")) return;
	}

	// Could not dismiss consent — treat as bot detection so the proxy is rotated
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

async function waitForGeminiAppUrl(
	page: Parameters<ProviderConfig["waitForResponse"]>[0],
	preSubmitUrl: string,
): Promise<boolean | undefined> {
	if (isGeminiAppUrl(preSubmitUrl)) {
		return undefined;
	}

	const deadline = Date.now() + 8000;
	while (Date.now() < deadline) {
		if (isGeminiAppUrl(await page.getUrl().catch(() => page.url()))) {
			return true;
		}
		await page.waitForTimeout(100);
	}

	return false;
}

export const geminiConfig: ProviderConfig = {
	url: "https://gemini.google.com/",
	label: "Gemini",
	displayName: "Gemini",
// Detect consent pages before attempting to locate the editor.
	// consent.google.com has no Gemini composer, so without this check
	// waitForEditorReady times out and misclassifies it as "no_editor".
	postNavigationHook: async (page) => {
		await handleConsentPage(page);
	},
	beforePromptHook: async (page) => {
		await handleConsentPage(page);
	},
	checkSubmitSuccess: async (page, { preSubmitUrl }) =>
		waitForGeminiAppUrl(page, preSubmitUrl),
	waitForResponse: (page) => waitForAssistantToFinish(page, "gemini"),
	extractResponse: (page) => extractAssistantMarkdown(page, "gemini"),
	// No reset between prompts — session is reused in the same conversation.
	// Navigating back to gemini.google.com on each prompt adds unnecessary
	// round-trips and increases detection surface.
};
