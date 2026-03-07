import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { access } from "node:fs/promises";
import { createServer } from "node:net";
import { chromium } from "playwright";
import { buildChromeArgs } from "./stealth.js";

const CHROMIUM_CANDIDATES = [
	"/usr/bin/chromium",
	"/usr/bin/chromium-browser",
	"/usr/bin/google-chrome",
	"/usr/bin/google-chrome-stable",
	"/usr/bin/google-chrome-unstable",
	"/snap/bin/chromium",
];
const CHROMIUM_ENV_KEYS = [
	"CHROMIUM_PATH",
	"CHROME_PATH",
	"CHROME_BIN",
	"CHROME_EXECUTABLE_PATH",
	"GOOGLE_CHROME_BIN",
	"PUPPETEER_EXECUTABLE_PATH",
	"PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH",
];
const XVFB_CANDIDATES = ["/usr/bin/Xvfb", "/usr/local/bin/Xvfb"];
const XVFB_START_TIMEOUT_MS = 5_000;

export type CDPSpawnOptions = {
	proxyServer?: string;
	windowSize?: {
		width: number;
		height: number;
	};
	display?: string;
};

export type DisplayHandle = {
	display: string;
	cleanup: () => Promise<void>;
};

function findChromiumBinary(): string {
	for (const envKey of CHROMIUM_ENV_KEYS) {
		const candidate = process.env[envKey]?.trim();
		if (candidate && existsSync(candidate)) {
			return candidate;
		}
	}

	for (const candidate of CHROMIUM_CANDIDATES) {
		if (existsSync(candidate)) {
			return candidate;
		}
	}

	return chromium.executablePath();
}

function findXvfbBinary(): string | null {
	for (const candidate of XVFB_CANDIDATES) {
		if (existsSync(candidate)) {
			return candidate;
		}
	}

	return null;
}

export function detectDisplay(): string | null {
	const display = process.env.DISPLAY?.trim();
	return display || null;
}

async function waitForDisplaySocket(
	displayNumber: number,
	child: ChildProcess,
	timeoutMs = XVFB_START_TIMEOUT_MS,
): Promise<void> {
	const socketPath = `/tmp/.X11-unix/X${displayNumber}`;
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		if (child.exitCode !== null) {
			throw new Error(`Xvfb exited before display :${displayNumber} was ready`);
		}

		try {
			await access(socketPath);
			return;
		} catch {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}

	child.kill("SIGTERM");
	throw new Error(
		`Xvfb display :${displayNumber} was not ready within ${timeoutMs}ms`,
	);
}

export async function ensureDisplay(windowSize?: {
	width: number;
	height: number;
}): Promise<DisplayHandle | null> {
	const existingDisplay = detectDisplay();
	if (existingDisplay) {
		return {
			display: existingDisplay,
			cleanup: async () => {},
		};
	}

	if (process.platform !== "linux") {
		return null;
	}

	const xvfbBinary = findXvfbBinary();
	if (!xvfbBinary) {
		return null;
	}

	const screenWidth = Math.max(3840, windowSize?.width ?? 1920);
	const screenHeight = Math.max(2160, windowSize?.height ?? 1080);
	let lastError: unknown = null;

	for (let attempt = 0; attempt < 5; attempt += 1) {
		const displayNumber = 100 + Math.floor(Math.random() * 800);
		const display = `:${displayNumber}`;
		const xvfb = spawn(
			xvfbBinary,
			[
				display,
				"-screen",
				"0",
				`${screenWidth}x${screenHeight}x24`,
				"-ac",
				"-nolisten",
				"tcp",
			],
			{
				stdio: "ignore",
				detached: false,
			},
		);

		try {
			await waitForDisplaySocket(displayNumber, xvfb);

			return {
				display,
				cleanup: async () => {
					try {
						xvfb.kill("SIGTERM");
						await new Promise((resolve) => setTimeout(resolve, 200));
						if (xvfb.exitCode === null) {
							xvfb.kill("SIGKILL");
						}
					} catch {
						// Xvfb may already be gone.
					}
				},
			};
		} catch (error) {
			lastError = error;
			try {
				xvfb.kill("SIGTERM");
			} catch {
				// Ignore failed cleanup between retries.
			}
		}
	}

	throw new Error(
		`Failed to bootstrap Xvfb after multiple attempts: ${lastError instanceof Error ? lastError.message : "unknown error"}`,
	);
}

export function getFreePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = createServer();

		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (!address || typeof address === "string") {
				server.close(() => reject(new Error("Could not get free port")));
				return;
			}

			server.close(() => resolve(address.port));
		});

		server.on("error", reject);
	});
}

export function spawnChromiumCDP(
	port: number,
	userDataDir: string,
	options?: CDPSpawnOptions,
): ChildProcess {
	const binary = findChromiumBinary();
	const display = options?.display ?? detectDisplay();
	const isHeadful = display !== null;
	const windowSize = options?.windowSize ?? { width: 1920, height: 1080 };
	const args: string[] = [
		`--remote-debugging-port=${port}`,
		"--no-sandbox",
		"--disable-setuid-sandbox",
		"--disable-blink-features=AutomationControlled",
		`--user-data-dir=${userDataDir}`,
	];

	if (options?.proxyServer) {
		args.push(`--proxy-server=${options.proxyServer}`);
	}

	if (isHeadful) {
		args.push("--use-gl=swiftshader");
	} else {
		args.push("--headless=new", "--disable-gpu");
	}

	args.push(`--window-size=${windowSize.width},${windowSize.height}`);
	args.push(...buildChromeArgs());

	const childEnv: NodeJS.ProcessEnv = { ...process.env };
	if (display) {
		childEnv.DISPLAY = display;
	}

	return spawn(binary, args, {
		stdio: ["ignore", "ignore", "pipe"],
		detached: false,
		env: childEnv,
	});
}

export async function waitForCDPEndpoint(
	port: number,
	timeoutMs = 20_000,
): Promise<string> {
	const url = `http://localhost:${port}/json/version`;
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		try {
			const response = await fetch(url);
			if (response.ok) {
				const payload = (await response.json()) as {
					webSocketDebuggerUrl?: string;
				};
				if (payload.webSocketDebuggerUrl) {
					return payload.webSocketDebuggerUrl;
				}
			}
		} catch {
			// Chromium is still starting up.
		}

		await new Promise((resolve) => setTimeout(resolve, 200));
	}

	throw new Error(
		`CDP endpoint at port ${port} not ready within ${timeoutMs}ms`,
	);
}
