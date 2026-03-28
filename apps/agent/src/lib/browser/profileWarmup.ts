import { logger } from "@oneglanse/utils";
import type { Provider } from "@oneglanse/types";
import type { Page } from "playwright";
import { clickLocatorLikeUser } from "./humanBehavior.js";

// Visited first for every profile — shares .google.com cookies (NID, SOCS, 1P_JAR)
// with google.com search. YouTube is the safest first visit: highest-traffic Google
// property, completely natural, establishes Google rep for the proxy IP.
const GOOGLE_WARMUP_SITES = [
	"https://www.youtube.com",
	"https://gemini.google.com",
];

// Neutral sites visited after Google properties to simulate natural browsing
const NEUTRAL_WARMUP_SITES = [
	"https://en.wikipedia.org",
	"https://www.reddit.com",
];

const GOOGLE_PROVIDERS = new Set<Provider>(["ai-overview", "gemini"]);

function randomBetween(min: number, max: number): number {
	return min + Math.floor(Math.random() * (max - min + 1));
}

async function randomScroll(page: Page): Promise<void> {
	const scrollAmount = randomBetween(100, 400);
	const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
	const x = randomBetween(
		Math.round(viewport.width * 0.2),
		Math.round(viewport.width * 0.8),
	);
	const y = randomBetween(
		Math.round(viewport.height * 0.2),
		Math.round(viewport.height * 0.8),
	);
	void x;
	void y;
	await page.mouse.wheel(0, scrollAmount);
	await page.waitForTimeout(randomBetween(300, 800));
}

async function randomMouseMove(page: Page): Promise<void> {
	const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
	const x = randomBetween(
		Math.round(viewport.width * 0.05),
		Math.round(viewport.width * 0.95),
	);
	const y = randomBetween(
		Math.round(viewport.height * 0.05),
		Math.round(viewport.height * 0.95),
	);
	await page.mouse.move(x, y, { steps: randomBetween(10, 25) });
	await page.waitForTimeout(randomBetween(200, 500));
}

const WARMUP_NAV_TIMEOUT_MS = 8_000;
const WARMUP_TOTAL_TIMEOUT_MS = 30_000;

export async function warmUpProfile(page: Page, provider?: Provider): Promise<void> {
	logger.log("warming up browser profile...");
	let successCount = 0;

	// Always visit YouTube first — establishes .google.com cookies for every proxy IP.
	// For Google-destined providers also visit gemini.google.com for deeper session signals.
	const guaranteedGoogle = provider && GOOGLE_PROVIDERS.has(provider)
		? [...GOOGLE_WARMUP_SITES]   // youtube + gemini
		: [GOOGLE_WARMUP_SITES[0]!]; // youtube only

	// Shuffle neutral sites and pick 0–1 of them
	const shuffledNeutral = [...NEUTRAL_WARMUP_SITES].sort(() => Math.random() - 0.5);
	const neutralCount = Math.floor(Math.random() * 2); // 0 or 1
	const toVisit = [...guaranteedGoogle, ...shuffledNeutral.slice(0, neutralCount)];

	const deadline = Date.now() + WARMUP_TOTAL_TIMEOUT_MS;

	for (const url of toVisit) {
		if (Date.now() >= deadline) break;
		try {
			logger.log(`[warmup] visiting ${url}`);
			await page.goto(url, {
				waitUntil: "domcontentloaded",
				timeout: Math.min(WARMUP_NAV_TIMEOUT_MS, deadline - Date.now()),
			});
			await page.waitForTimeout(randomBetween(800, 1500));
			await randomMouseMove(page);
			await randomScroll(page);
			await page.waitForTimeout(randomBetween(300, 800));
			successCount += 1;
		} catch {
			// Non-critical — skip failed warmup sites
		}
	}

	// Accept Google cookies if consent dialog appears
	try {
		const acceptButton = page.locator(
			'button:has-text("Accept all"), button:has-text("Accept"), button:has-text("I agree")',
		);
		if (
			await acceptButton
				.first()
				.isVisible({ timeout: 2000 })
				.catch(() => false)
		) {
			const clicked = await clickLocatorLikeUser(page, acceptButton.first(), {
				timeout: 3000,
			}).catch(() => false);
			if (!clicked) {
				throw new Error("failed to click warmup consent button");
			}
			await page.waitForTimeout(randomBetween(500, 1000));
		}
	} catch {
		// No consent dialog — fine
	}

	if (successCount === 0) {
		throw new Error("all profile warmup sites failed to load");
	}

	logger.log("profile warmup complete");
}
