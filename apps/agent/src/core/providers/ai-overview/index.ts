import { ExternalServiceError } from "@oneglanse/errors";
import { PROVIDER_EDITOR_SELECTORS } from "@oneglanse/utils";
import { logger } from "@oneglanse/utils";
import type { Page } from "playwright";
import { env } from "../../../env.js";
import {
	getBrowserPrimaryModifier,
	moveMouseToElement,
	pastePrompt,
} from "../../../lib/browser/humanBehavior.js";
import { navigateWithRetry } from "../../../lib/browser/navigate.js";
import { turndown } from "../../../lib/input/markdown/converter.js";
import type { ProviderConfig } from "../types.js";
import { extractAIOverviewResponse } from "./lib/extractResponse.js";
import { extractAIOverviewSources } from "./lib/extractSources.js";

function randomBetween(min: number, max: number): number {
	return min + Math.floor(Math.random() * (max - min + 1));
}

function buildFallbackSearchUrl(prompt: string): string {
	return `https://www.google.com/search?q=${encodeURIComponent(prompt)}`;
}

function normalizeSearchQuery(prompt: string): string {
	return prompt.replace(/\s+/g, " ").trim();
}

const GOOGLE_CONSENT_SELECTOR =
	"button#L2AGLb, button#W0wltc, form[action*='consent.google.com'] button";

async function findVisibleSearchInput(page: Page) {
	for (const selector of PROVIDER_EDITOR_SELECTORS["ai-overview"]) {
		const nodes = page.locator(selector);
		const count = await nodes.count().catch(() => 0);
		for (let i = 0; i < count; i++) {
			const candidate = nodes.nth(i);
			const visible = await candidate.isVisible().catch(() => false);
			if (visible) {
				logger.log(`[ai-overview] using search selector: ${selector}`);
				return candidate;
			}
		}
	}

	return null;
}

function assertNotBlockedPage(page: Page): void {
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

async function dismissConsentDialog(page: Page): Promise<void> {
	const consentBtn = page.locator(GOOGLE_CONSENT_SELECTOR).first();
	const visible = await consentBtn
		.isVisible({ timeout: 2500 })
		.catch(() => false);
	if (!visible) return;
	await consentBtn.click({ timeout: 4000 });
}

export const aiOverviewConfig: ProviderConfig = {
	url: "https://www.google.com/",
	label: "AI Overview",
	displayName: "AI Overview",
	skipInitialNavigation: true,
	navigateToPrompt: async (page, prompt) => {
		const query = normalizeSearchQuery(prompt);
		const searchInput = await findVisibleSearchInput(page);

		if (searchInput) {
			await moveMouseToElement(page, searchInput);
			await searchInput.click();
			await page.waitForTimeout(randomBetween(300, 700));
			const primaryModifier = await getBrowserPrimaryModifier(page);
			await page.keyboard
				.press(`${primaryModifier}+A`)
				.catch(() => page.keyboard.press("Control+A"));
			logger.debug(`[ai-overview] pasting ${query.length} chars…`);
			await pastePrompt(page, query);
			logger.debug("[ai-overview] paste complete");
			const inputContent = await searchInput.readInputValue().catch(() => "");
			if (inputContent.trim().length < query.length * 0.9) {
				throw new ExternalServiceError(
					"ai-overview",
					`Typing failed: input length ${inputContent.trim().length} is less than 90% of prompt length ${query.length}`,
				);
			}
			await page.waitForTimeout(randomBetween(400, 900));
			logger.debug("[ai-overview] attempting submission…");
			await page.keyboard.press("Enter");
			await page.waitForLoadState("domcontentloaded").catch(() => {});
		} else {
			logger.log(
				"[ai-overview] search box not found, falling back to direct URL",
			);
			await navigateWithRetry(page, buildFallbackSearchUrl(query), {
				waitUntil: "domcontentloaded",
				timeout: 60000,
			});
		}

		assertNotBlockedPage(page);
		await dismissConsentDialog(page);
		logger.log(`[ai-overview] search ready: ${page.url()}`);
	},
	waitForResponse: async (page) => {
		const url = page.url();
		if (url.includes("/sorry/")) {
			throw new ExternalServiceError(
				"ai-overview",
				"Google bot detection triggered (sorry page) — proxy IP blocked",
				429,
			);
		}

		await page
			.waitForSelector(
				'[data-container-id="model-response-placeholder"], [data-container-id="main-col"]',
				{ timeout: env.AI_OVERVIEW_WAIT_TIMEOUT_MS },
			)
			.catch(() => {});
	},
	extractResponse: async (page) => {
		const html = await extractAIOverviewResponse(page);
		return turndown.turndown(html);
	},
	extractSources: (page) => extractAIOverviewSources(page),
};
