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
const WARMUP_TOTAL_TIMEOUT_MS = 20_000;

export async function warmUpProfile(page: Page, provider?: Provider): Promise<void> {
	logger.log("warming up browser profile...");
	let successCount = 0;

	// ai-overview: visit YouTube + gemini.google.com to establish .google.com cookies
	// (NID, SOCS, 1P_JAR) that google.com search reads.
	// gemini: visit YouTube only — establishes Google session rep for the proxy IP.
	// Other providers: one neutral site to simulate natural browsing history.
	const shuffledNeutral = [...NEUTRAL_WARMUP_SITES].sort(() => Math.random() - 0.5);
	let toVisit: string[];

	if (provider === "ai-overview") {
		toVisit = [...GOOGLE_WARMUP_SITES];
	} else if (provider === "gemini") {
		toVisit = ["https://www.youtube.com"];
	} else {
		// One neutral site — provides browsing history without the Google detour
		toVisit = [shuffledNeutral[0]!];
	}

	const deadline = Date.now() + WARMUP_TOTAL_TIMEOUT_MS;

	for (const url of toVisit) {
		if (Date.now() >= deadline) break;
		try {
			logger.log(`[warmup] visiting ${url}`);
			// Math.max(1, ...) prevents a negative or zero value when the deadline
			// has drifted past — Playwright treats timeout ≤ 0 as "no timeout",
			// which would let this navigation hang indefinitely.
			await page.goto(url, {
				waitUntil: "domcontentloaded",
				timeout: Math.max(1, Math.min(WARMUP_NAV_TIMEOUT_MS, deadline - Date.now())),
			});

			// Dwell + micro-interactions — only run if there is budget remaining.
			const remaining = deadline - Date.now();
			if (remaining > 0) {
				await page.waitForTimeout(Math.min(randomBetween(800, 1500), remaining));
				if (Date.now() < deadline) await randomMouseMove(page);
				if (Date.now() < deadline) await randomScroll(page);
				const remaining2 = deadline - Date.now();
				if (remaining2 > 0) {
					await page.waitForTimeout(Math.min(randomBetween(300, 800), remaining2));
				}
			}

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
