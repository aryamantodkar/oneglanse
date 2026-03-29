import type { BrowserContext, Locator, Page } from "playwright";

export function bindContextDisplay(
	_context: BrowserContext,
	_display: string,
): void {
	// Camoufox owns the browser/runtime fingerprint surface; do not add an
	// extra OS-level event shim on top of it.
}

export function unbindContextDisplay(_context: BrowserContext): void {
	// See bindContextDisplay().
}

export function canUseOsLevelInput(_page: Page): boolean {
	return false;
}

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

function randomBetween(min: number, max: number): number {
	return min + Math.floor(Math.random() * (max - min + 1));
}

const graphemeSegmenter =
	typeof Intl !== "undefined" && "Segmenter" in Intl
		? new Intl.Segmenter(undefined, { granularity: "grapheme" })
		: null;

const QWERTY_NEIGHBORS: Record<string, string[]> = {
	q: ["w", "a"],
	w: ["q", "e", "s", "a"],
	e: ["w", "r", "d", "s"],
	r: ["e", "t", "f", "d"],
	t: ["r", "y", "g", "f"],
	y: ["t", "u", "h", "g"],
	u: ["y", "i", "j", "h"],
	i: ["u", "o", "k", "j"],
	o: ["i", "p", "l", "k"],
	p: ["o", "l"],
	a: ["q", "w", "s", "z"],
	s: ["a", "w", "e", "d", "z", "x"],
	d: ["s", "e", "r", "f", "x", "c"],
	f: ["d", "r", "t", "g", "c", "v"],
	g: ["f", "t", "y", "h", "v", "b"],
	h: ["g", "y", "u", "j", "b", "n"],
	j: ["h", "u", "i", "k", "n", "m"],
	k: ["j", "i", "o", "l", "m"],
	l: ["k", "o", "p"],
	z: ["a", "s", "x"],
	x: ["z", "s", "d", "c"],
	c: ["x", "d", "f", "v"],
	v: ["c", "f", "g", "b"],
	b: ["v", "g", "h", "n"],
	n: ["b", "h", "j", "m"],
	m: ["n", "j", "k"],
};

function bezierPoint(
	t: number,
	p0: number,
	p1: number,
	p2: number,
	p3: number,
): number {
	const u = 1 - t;
	return (
		u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
	);
}

export async function moveMouseToElement(
	page: Page,
	target: Locator,
): Promise<void> {
	const box = await target.boundingBox().catch(() => null);
	if (!box) return;

	const viewport = page.viewportSize() ?? { width: 1920, height: 1080 };
	const startX = randomBetween(viewport.width * 0.1, viewport.width * 0.9);
	const startY = randomBetween(viewport.height * 0.1, viewport.height * 0.9);
	const endX = box.x + box.width * (0.3 + Math.random() * 0.4);
	const endY = box.y + box.height * (0.3 + Math.random() * 0.4);

	const cp1x = startX + (endX - startX) * (0.2 + Math.random() * 0.3);
	const cp1y = startY + (Math.random() - 0.5) * 100;
	const cp2x = endX - (endX - startX) * (0.2 + Math.random() * 0.3);
	const cp2y = endY + (Math.random() - 0.5) * 100;

	const steps = randomBetween(6, 12);

	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		const x = bezierPoint(t, startX, cp1x, cp2x, endX);
		const y = bezierPoint(t, startY, cp1y, cp2y, endY);
		await page.mouse.move(x, y);
		await page.waitForTimeout(randomBetween(3, 12));
	}
}

export async function preInteractionIdle(page: Page): Promise<void> {
	await page.waitForTimeout(randomBetween(300, 700));
}

export async function smallScroll(page: Page): Promise<void> {
	const amount = randomBetween(50, 200);
	await page.mouse.wheel(0, amount);
	await page.waitForTimeout(randomBetween(200, 600));
}

export async function randomMouseJitter(page: Page): Promise<void> {
	const viewport = page.viewportSize() ?? { width: 1920, height: 1080 };
	const x = randomBetween(100, viewport.width - 100);
	const y = randomBetween(100, viewport.height - 100);
	await page.mouse.move(x, y, { steps: randomBetween(5, 12) });
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

export async function humanType(page: Page, text: string): Promise<void> {
	let charsSinceLastPause = 0;
	const pauseThreshold = randomBetween(10, 20);

	for (let i = 0; i < text.length; i++) {
		const char = text.at(i);
		if (!char) continue;

		if (char === "\n") {
			await page.keyboard.down("Shift");
			await page.keyboard.press("Enter");
			await page.keyboard.up("Shift");
		} else {
			const qwertyNeighbor = QWERTY_NEIGHBORS[char.toLowerCase()];
			if (
				qwertyNeighbor &&
				Math.random() < 0.03 &&
				i > 0 &&
				i < text.length - 1
			) {
				const typoChar = qwertyNeighbor.at(
					Math.floor(Math.random() * qwertyNeighbor.length),
				);
				if (typoChar) {
					await page.keyboard.type(typoChar);
					await page.waitForTimeout(randomBetween(50, 150));
					await page.keyboard.press("Backspace");
					await page.waitForTimeout(randomBetween(40, 120));
				}
			}

			await page.keyboard.type(char);
		}

		charsSinceLastPause += 1;
		await page.waitForTimeout(randomBetween(25, 85));

		if (charsSinceLastPause >= pauseThreshold) {
			charsSinceLastPause = 0;
			await page.waitForTimeout(randomBetween(120, 320));
		}
	}
}
