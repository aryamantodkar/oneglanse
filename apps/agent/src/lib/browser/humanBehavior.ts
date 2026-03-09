import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { BrowserContext, Locator, Page } from "playwright";

const execFileAsync = promisify(execFile);
const contextDisplayMap = new WeakMap<BrowserContext, string>();

// ─── xdotool coordinate translation infrastructure ───────────────────────────
//
// CDP Input.dispatchMouseEvent produces viewport-relative screenX/Y (<100px),
// which Cloudflare Turnstile detects since ~Feb 2025. Worse, CDP mouse events
// have empty getCoalescedEvents() arrays — a binary signal that cannot be
// spoofed because it's the *absence* of data. Mixing CDP moves with xdotool
// clicks makes the coalesced-event pattern inconsistent.
//
// Fix: route ALL mouse input (move, click, scroll) through xdotool on
// Linux/Xvfb. xdotool uses the X11 XTEST extension so Chrome's real input
// pipeline produces proper screenX/Y and CoalescedEvents.

type WindowGeometry = { x: number; y: number };
type BrowserDims = { chromeH: number; chromePad: number };

const geometryCache = new Map<string, { geom: WindowGeometry; ts: number }>();
const dimsCache = new Map<string, { dims: BrowserDims; ts: number }>();
const GEOMETRY_TTL_MS = 30_000;
const DIMS_TTL_MS = 60_000;

function getActiveDisplay(page?: Page): string | null {
	if (process.platform !== "linux") return null;
	return (
		(page ? contextDisplayMap.get(page.context()) : null) ??
		process.env.DISPLAY?.trim() ??
		null
	);
}

export function bindContextDisplay(
	context: BrowserContext,
	display: string,
): void {
	contextDisplayMap.set(context, display);
}

export function unbindContextDisplay(context: BrowserContext): void {
	contextDisplayMap.delete(context);
}

export function canUseOsLevelInput(page: Page): boolean {
	return getActiveDisplay(page) !== null;
}

async function runXdotool(page: Page, args: string[]): Promise<boolean> {
	const display = getActiveDisplay(page);
	if (!display) return false;

	try {
		const env = { ...process.env, DISPLAY: display };
		await execFileAsync("xdotool", args, { env });
		return true;
	} catch {
		return false;
	}
}

async function getWindowScreenOffset(
	display: string,
): Promise<WindowGeometry | null> {
	const cached = geometryCache.get(display);
	if (cached && Date.now() - cached.ts < GEOMETRY_TTL_MS) {
		return cached.geom;
	}

	try {
		const env = { ...process.env, DISPLAY: display };

		// Try Chromium first, fall back to Google Chrome class name.
		const searchResult = await execFileAsync(
			"xdotool",
			["search", "--onlyvisible", "--class", "chromium"],
			{ env },
		).catch(() =>
			execFileAsync(
				"xdotool",
				["search", "--onlyvisible", "--class", "google-chrome"],
				{ env },
			),
		);

		const wids = searchResult.stdout.trim().split("\n").filter(Boolean);
		if (wids.length === 0) return null;
		const windowId = wids[0];
		if (!windowId) return null;

		const geomResult = await execFileAsync(
			"xdotool",
			["getwindowgeometry", windowId],
			{ env },
		);

		// Output: "Position: X,Y (window manager)"
		const match = geomResult.stdout.match(/Position:\s*(\d+),(\d+)/);
		if (!match) return null;
		const x = match[1];
		const y = match[2];
		if (!x || !y) return null;

		const geom: WindowGeometry = {
			x: Number.parseInt(x, 10),
			y: Number.parseInt(y, 10),
		};
		geometryCache.set(display, { geom, ts: Date.now() });
		return geom;
	} catch {
		return null;
	}
}

async function getBrowserDims(
	page: Page,
	display: string,
): Promise<BrowserDims | null> {
	const cached = dimsCache.get(display);
	if (cached && Date.now() - cached.ts < DIMS_TTL_MS) {
		return cached.dims;
	}

	try {
		const [oh, ih, ow, iw] = await Promise.all([
			page.evaluate(() => window.outerHeight).catch(() => 0),
			page.evaluate(() => window.innerHeight).catch(() => 0),
			page.evaluate(() => window.outerWidth).catch(() => 0),
			page.evaluate(() => window.innerWidth).catch(() => 0),
		]);

		const dims: BrowserDims = {
			chromeH: Math.max(0, oh - ih),
			chromePad: Math.max(0, Math.floor((ow - iw) / 2)),
		};
		dimsCache.set(display, { dims, ts: Date.now() });
		return dims;
	} catch {
		return null;
	}
}

async function toScreenCoords(
	page: Page,
	display: string,
	viewportX: number,
	viewportY: number,
): Promise<{ x: number; y: number } | null> {
	const [winOffset, dims] = await Promise.all([
		getWindowScreenOffset(display),
		getBrowserDims(page, display),
	]);

	if (!winOffset || !dims) return null;

	return {
		x: winOffset.x + dims.chromePad + Math.round(viewportX),
		y: winOffset.y + dims.chromeH + Math.round(viewportY),
	};
}

/**
 * Dispatches a real OS-level mouse click via xdotool.
 * Returns false when xdotool is unavailable (macOS, no DISPLAY) so the
 * caller can fall back to page.mouse.click().
 */
export async function xdotoolClick(
	page: Page,
	viewportX: number,
	viewportY: number,
): Promise<boolean> {
	const display = getActiveDisplay(page);
	if (!display) return false;

	try {
		const sc = await toScreenCoords(page, display, viewportX, viewportY);
		if (!sc) return false;

		const env = { ...process.env, DISPLAY: display };
		await execFileAsync(
			"xdotool",
			["mousemove", "--sync", String(sc.x), String(sc.y)],
			{ env },
		);
		await execFileAsync("xdotool", ["click", "--clearmodifiers", "1"], { env });
		return true;
	} catch {
		return false;
	}
}

/**
 * Moves the mouse to a viewport position via xdotool (OS-level XTEST event).
 * This produces real CoalescedEvents unlike CDP Input.dispatchMouseEvent.
 * Returns false when xdotool is unavailable so caller can fall back.
 */
export async function xdotoolMouseMove(
	page: Page,
	viewportX: number,
	viewportY: number,
): Promise<boolean> {
	const display = getActiveDisplay(page);
	if (!display) return false;

	try {
		const sc = await toScreenCoords(page, display, viewportX, viewportY);
		if (!sc) return false;

		const env = { ...process.env, DISPLAY: display };
		await execFileAsync(
			"xdotool",
			["mousemove", "--sync", String(sc.x), String(sc.y)],
			{ env },
		);
		return true;
	} catch {
		return false;
	}
}

/**
 * Scrolls via xdotool button 4 (up) / 5 (down) at the given viewport position.
 * One button click ≈ 30–40px of scroll. Returns false on non-Linux/no DISPLAY.
 */
export async function xdotoolScroll(
	page: Page,
	viewportX: number,
	viewportY: number,
	deltaY: number,
): Promise<boolean> {
	const display = getActiveDisplay(page);
	if (!display) return false;

	try {
		const sc = await toScreenCoords(page, display, viewportX, viewportY);
		if (!sc) return false;

		const env = { ...process.env, DISPLAY: display };
		// Move to the scroll target position first.
		await execFileAsync(
			"xdotool",
			["mousemove", "--sync", String(sc.x), String(sc.y)],
			{ env },
		);

		// button 5 = scroll down, button 4 = scroll up; ~35px per click.
		const button = deltaY > 0 ? "5" : "4";
		const clicks = Math.max(1, Math.round(Math.abs(deltaY) / 35));
		for (let i = 0; i < clicks; i++) {
			await execFileAsync("xdotool", ["click", "--clearmodifiers", button], {
				env,
			});
		}
		return true;
	} catch {
		return false;
	}
}

export async function xdotoolKey(page: Page, combo: string): Promise<boolean> {
	return runXdotool(page, ["key", "--clearmodifiers", combo]);
}

export async function xdotoolTypeText(
	page: Page,
	text: string,
	delayMs = 12,
): Promise<boolean> {
	if (!text) return true;
	return runXdotool(page, [
		"type",
		"--clearmodifiers",
		"--delay",
		String(delayMs),
		"--",
		text,
	]);
}

function mapLogicalKeyToXdotool(key: string): string | null {
	switch (key) {
		case "Enter":
			return "Return";
		case "Escape":
			return "Escape";
		case "Backspace":
			return "BackSpace";
		case "Shift+Enter":
			return "shift+Return";
		case "Control+A":
			return "ctrl+a";
		case "Meta+A":
			return "Super+a";
		default:
			return null;
	}
}

export async function xdotoolClickLocator(
	page: Page,
	target: Locator,
): Promise<boolean> {
	const box = await target.boundingBox().catch(() => null);
	if (!box) return false;

	const x = box.x + box.width * (0.35 + Math.random() * 0.3);
	const y = box.y + box.height * (0.35 + Math.random() * 0.3);

	const moved = await xdotoolMouseMove(page, x, y);
	if (!moved) return false;
	await page.waitForTimeout(randomBetween(35, 110));
	return runXdotool(page, ["click", "--clearmodifiers", "1"]);
}

export async function clickLocatorLikeUser(
	page: Page,
	target: Locator,
	options?: {
		timeout?: number;
		delay?: number;
		force?: boolean;
	},
): Promise<boolean> {
	const clicked = await xdotoolClickLocator(page, target);
	if (clicked) {
		return true;
	}
	if (canUseOsLevelInput(page)) {
		return false;
	}

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
	const xdotoolKeyName = mapLogicalKeyToXdotool(key);
	if (xdotoolKeyName) {
		const pressed = await xdotoolKey(page, xdotoolKeyName);
		if (pressed) {
			return true;
		}
	}
	if (canUseOsLevelInput(page)) {
		return false;
	}

	await page.keyboard.press(key, { delay: options?.delay });
	return true;
}

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

	// Bezier control points for a natural curve
	const cp1x = startX + (endX - startX) * (0.2 + Math.random() * 0.3);
	const cp1y = startY + (Math.random() - 0.5) * 100;
	const cp2x = endX - (endX - startX) * (0.2 + Math.random() * 0.3);
	const cp2y = endY + (Math.random() - 0.5) * 100;

	const steps = randomBetween(6, 12);
	const useOsInput = canUseOsLevelInput(page);

	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		const x = bezierPoint(t, startX, cp1x, cp2x, endX);
		const y = bezierPoint(t, startY, cp1y, cp2y, endY);
		if (useOsInput) {
			await xdotoolMouseMove(page, x, y);
		} else {
			await page.mouse.move(x, y);
		}
		await page.waitForTimeout(randomBetween(3, 12));
	}
}

export async function preInteractionIdle(page: Page): Promise<void> {
	await page.waitForTimeout(randomBetween(300, 700));
}

export async function smallScroll(page: Page): Promise<void> {
	const amount = randomBetween(50, 200);
	const viewport = page.viewportSize() ?? { width: 1920, height: 1080 };
	const x = randomBetween(100, viewport.width - 100);
	const y = randomBetween(100, viewport.height - 100);
	const scrolled = await xdotoolScroll(page, x, y, amount);
	if (!scrolled) {
		await page.mouse.wheel(0, amount);
	}
	await page.waitForTimeout(randomBetween(200, 600));
}

export async function randomMouseJitter(page: Page): Promise<void> {
	const viewport = page.viewportSize() ?? { width: 1920, height: 1080 };
	const x = randomBetween(100, viewport.width - 100);
	const y = randomBetween(100, viewport.height - 100);
	const moved = await xdotoolMouseMove(page, x, y);
	if (!moved) {
		await page.mouse.move(x, y, { steps: randomBetween(5, 12) });
	}
}

export async function humanType(page: Page, text: string): Promise<void> {
	const useOsInput = canUseOsLevelInput(page);
	let charsSinceLastPause = 0;
	const pauseThreshold = randomBetween(10, 20);

	for (let i = 0; i < text.length; i++) {
		const char = text.at(i);
		if (!char) continue;

		if (char === "\n") {
			if (useOsInput) {
				await xdotoolKey(page, "shift+Return");
			} else {
				await page.keyboard.down("Shift");
				await page.keyboard.press("Enter");
				await page.keyboard.up("Shift");
			}
		} else {
			// Rare typo + correction (~3% of word characters, QWERTY-neighbor only)
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
					if (useOsInput) {
						await xdotoolTypeText(page, typoChar, randomBetween(8, 18));
					} else {
						await page.keyboard.type(typoChar);
					}
					await page.waitForTimeout(randomBetween(50, 150));
					if (useOsInput) {
						await xdotoolKey(page, "BackSpace");
					} else {
						await page.keyboard.press("Backspace");
					}
					await page.waitForTimeout(randomBetween(80, 200));
				}
			}

			if (useOsInput) {
				await xdotoolTypeText(page, char, randomBetween(8, 18));
			} else {
				await page.keyboard.type(char);
			}
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
