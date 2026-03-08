import type { Locator, Page } from "playwright";

function randomBetween(min: number, max: number): number {
	return min + Math.floor(Math.random() * (max - min + 1));
}

// Adjacent QWERTY keys for realistic typo simulation.
// Only lowercase letters are mapped; skip chars with no neighbors.
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
	return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
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

	// Bezier control points for a natural curve
	const cp1x = startX + (endX - startX) * (0.2 + Math.random() * 0.3);
	const cp1y = startY + (Math.random() - 0.5) * 100;
	const cp2x = endX - (endX - startX) * (0.2 + Math.random() * 0.3);
	const cp2y = endY + (Math.random() - 0.5) * 100;

	const steps = randomBetween(15, 30);

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

export async function humanType(
	page: Page,
	text: string,
): Promise<void> {
	let charsSinceLastPause = 0;
	const pauseThreshold = randomBetween(10, 20);

	for (let i = 0; i < text.length; i++) {
		const char = text[i]!;

		if (char === "\n") {
			await page.keyboard.down("Shift");
			await page.keyboard.press("Enter");
			await page.keyboard.up("Shift");
		} else {
			// Rare typo + correction (~3% of word characters, QWERTY-neighbor only)
			const qwertyNeighbor = QWERTY_NEIGHBORS[char.toLowerCase()];
			if (
				qwertyNeighbor &&
				Math.random() < 0.03 &&
				i > 0 &&
				i < text.length - 1
			) {
				const typoChar =
					qwertyNeighbor[Math.floor(Math.random() * qwertyNeighbor.length)]!;
				await page.keyboard.type(typoChar);
				await page.waitForTimeout(randomBetween(50, 150));
				await page.keyboard.press("Backspace");
				await page.waitForTimeout(randomBetween(80, 200));
			}

			await page.keyboard.type(char);
		}

		// Typing delays
		if (char === " ") {
			// Between words: longer pause
			await page.waitForTimeout(randomBetween(50, 120));
		} else {
			// Within word: fast burst
			await page.waitForTimeout(randomBetween(15, 40));
		}

		charsSinceLastPause++;
		// Occasional "thinking" pause
		if (charsSinceLastPause >= pauseThreshold) {
			await page.waitForTimeout(randomBetween(150, 500));
			charsSinceLastPause = 0;
		}
	}
}
