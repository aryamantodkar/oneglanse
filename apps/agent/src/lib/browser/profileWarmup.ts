import { logger } from "@oneglanse/utils";
import type { Provider } from "@oneglanse/types";
import type { Page } from "playwright";
import { clickLocatorLikeUser } from "./humanBehavior.js";

// Neutral sites for non-Google providers
const NEUTRAL_WARMUP_SITES = [
	"https://en.wikipedia.org",
	"https://www.reddit.com",
];

function randomBetween(min: number, max: number): number {
	return min + Math.floor(Math.random() * (max - min + 1));
}

const WARMUP_NAV_TIMEOUT_MS = 20_000;
const WARMUP_TOTAL_TIMEOUT_MS = 25_000;

export async function warmUpProfile(page: Page, provider?: Provider): Promise<void> {
	logger.log("warming up browser profile...");

	// Google providers (gemini, ai-overview): YouTube only — establishes Google
	// session rep for the proxy IP without the consent/login weirdness of Gemini.
	// Others: one random neutral site for browsing history.
	const isGoogleProvider = provider === "ai-overview" || provider === "gemini";
	const siteToVisit = isGoogleProvider
		? "https://www.youtube.com"
		: NEUTRAL_WARMUP_SITES[Math.floor(Math.random() * NEUTRAL_WARMUP_SITES.length)]!;

	const deadline = Date.now() + WARMUP_TOTAL_TIMEOUT_MS;

	try {
		logger.log(`[warmup] visiting ${siteToVisit}`);
		await page.goto(siteToVisit, {
			waitUntil: "domcontentloaded",
			timeout: Math.max(1, Math.min(WARMUP_NAV_TIMEOUT_MS, deadline - Date.now())),
		});

		// Brief natural dwell — no synthetic scroll/mouse interaction
		const remaining = deadline - Date.now();
		if (remaining > 0) {
			await page.waitForTimeout(Math.min(randomBetween(1000, 2000), remaining));
		}
	} catch {
		throw new Error(`warmup failed: ${siteToVisit} did not load`);
	}

	// Accept consent dialog if present
	try {
		const acceptButton = page.locator(
			'button:has-text("Accept all"), button:has-text("Accept"), button:has-text("I agree")',
		);
		if (await acceptButton.first().isVisible({ timeout: 2000 }).catch(() => false)) {
			await clickLocatorLikeUser(page, acceptButton.first(), {
				timeout: 3000,
			}).catch(() => false);
			await page.waitForTimeout(randomBetween(500, 1000));
		}
	} catch {
		// No consent dialog — fine
	}

	logger.log("profile warmup complete");
}
