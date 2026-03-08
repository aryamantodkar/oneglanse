import { logger } from "@oneglanse/utils";
import type { Page } from "playwright";

const WARMUP_SITES = [
	"https://www.google.com",
	"https://en.wikipedia.org",
	"https://www.reddit.com",
];

function randomBetween(min: number, max: number): number {
	return min + Math.floor(Math.random() * (max - min + 1));
}

async function randomScroll(page: Page): Promise<void> {
	const scrollAmount = randomBetween(100, 400);
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

export async function warmUpProfile(page: Page): Promise<void> {
	logger.log("warming up browser profile...");
	let successCount = 0;

	for (const url of WARMUP_SITES) {
		try {
			await page.goto(url, {
				waitUntil: "domcontentloaded",
				timeout: 15_000,
			});
			await page.waitForTimeout(randomBetween(1000, 2500));
			await randomMouseMove(page);
			await randomScroll(page);
			await randomMouseMove(page);
			await page.waitForTimeout(randomBetween(500, 1500));
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
			await acceptButton.first().click({ timeout: 3000 });
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
