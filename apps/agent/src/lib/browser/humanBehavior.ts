import type { Locator, Page } from "playwright";

export async function clickLocatorLikeUser(
	_page: Page,
	target: Locator,
	options?: {
		timeout?: number;
		delay?: number;
		force?: boolean;
	},
): Promise<boolean> {
	await target.click({
		timeout: options?.timeout,
		delay: options?.delay,
		force: options?.force,
	});
	return true;
}

export async function pressKeyLikeUser(
	page: Page,
	key: string,
	options?: {
		delay?: number;
	},
): Promise<boolean> {
	await page.keyboard.press(key, { delay: options?.delay });
	return true;
}

export async function getBrowserPrimaryModifier(
	page: Page,
): Promise<"Meta" | "Control"> {
	try {
		const platform = await page.runDomOp<string>("platform-name");
		return platform.includes("mac") ? "Meta" : "Control";
	} catch {
		return "Control";
	}
}

export function randomBetween(min: number, max: number): number {
	return min + Math.floor(Math.random() * (max - min + 1));
}

const graphemeSegmenter =
	typeof Intl !== "undefined" && "Segmenter" in Intl
		? new Intl.Segmenter(undefined, { granularity: "grapheme" })
		: null;

export async function preInteractionIdle(page: Page): Promise<void> {
	await page.waitForTimeout(randomBetween(80, 180));
}

async function typeTextWithCadence(page: Page, text: string): Promise<number> {
	const units = graphemeSegmenter
		? Array.from(graphemeSegmenter.segment(text), (segment) => segment.segment)
		: Array.from(text);

	for (const unit of units) {
		await page.keyboard.type(unit);
		await page.waitForTimeout(randomBetween(12, 28));
	}

	return units.length;
}

/**
 * Inserts prompt text with a faster human-like cadence than full per-character
 * simulation. Text is typed in short grapheme chunks with small irregular
 * pauses so the input does not appear as a single DOM burst.
 */
export async function pastePrompt(page: Page, text: string): Promise<void> {
	const segments = graphemeSegmenter
		? Array.from(graphemeSegmenter.segment(text), (segment) => segment.segment)
		: Array.from(text);
	let cursor = 0;
	let charsSinceLongPause = 0;

	while (cursor < segments.length) {
		const nextChunkSize = randomBetween(3, 8);
		const chunk = segments.slice(cursor, cursor + nextChunkSize).join("");
		cursor += nextChunkSize;

		if (chunk === "\n") {
			await page.keyboard.press("Shift+Enter");
			charsSinceLongPause = 0;
			await page.waitForTimeout(randomBetween(60, 140));
			continue;
		}

		if (chunk.includes("\n")) {
			const parts = chunk.split("\n");
			for (let i = 0; i < parts.length; i++) {
				const part = parts[i];
				if (part) {
					charsSinceLongPause += await typeTextWithCadence(page, part);
				}
				if (i < parts.length - 1) {
					await page.keyboard.press("Shift+Enter");
					charsSinceLongPause = 0;
					await page.waitForTimeout(randomBetween(70, 160));
				}
			}
		} else {
			charsSinceLongPause += await typeTextWithCadence(page, chunk);
		}

		await page.waitForTimeout(randomBetween(35, 110));

		if (charsSinceLongPause >= randomBetween(22, 40)) {
			charsSinceLongPause = 0;
			await page.waitForTimeout(randomBetween(120, 260));
		}
	}
}
