import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { access } from "node:fs/promises";
import { release } from "node:os";

const XVFB_CANDIDATES = ["/usr/bin/Xvfb", "/usr/local/bin/Xvfb"];
const XVFB_START_TIMEOUT_MS = 5_000;
const DEFAULT_SCREEN_WIDTH = 1920;
const DEFAULT_SCREEN_HEIGHT = 1080;
const DEFAULT_SCREEN_DEPTH = 24;
const DEFAULT_CAMOUFOX_HEADLESS_MODE = "virtual";

export type DisplayHandle = {
	display: string;
	cleanup: () => Promise<void>;
};

function findXvfbBinary(): string | null {
	for (const candidate of XVFB_CANDIDATES) {
		if (existsSync(candidate)) return candidate;
	}
	return null;
}

export function detectDisplay(): string | null {
	return process.env.DISPLAY?.trim() || null;
}

export function isWsl(): boolean {
	if (process.platform !== "linux") return false;
	const kernelRelease = release().toLowerCase();
	return kernelRelease.includes("microsoft") || kernelRelease.includes("wsl");
}

function parseScreenSpec(): { width: number; height: number; depth: number } {
	const raw = process.env.CAMOUFOX_XVFB_SCREEN?.trim();
	if (!raw) {
		return {
			width: DEFAULT_SCREEN_WIDTH,
			height: DEFAULT_SCREEN_HEIGHT,
			depth: DEFAULT_SCREEN_DEPTH,
		};
	}

	const match = raw.match(/^(\d+)x(\d+)x(\d+)$/i);
	if (!match) {
		throw new Error(
			"CAMOUFOX_XVFB_SCREEN must use WIDTHxHEIGHTxDEPTH, for example 1920x1080x24.",
		);
	}

	return {
		width: Number(match[1]),
		height: Number(match[2]),
		depth: Number(match[3]),
	};
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

export async function ensureDisplay(options?: {
	allowExistingDisplay?: boolean;
}): Promise<DisplayHandle | null> {
	if (
		(process.env.CAMOUFOX_HEADLESS_MODE ?? DEFAULT_CAMOUFOX_HEADLESS_MODE) ===
		"headless"
	) {
		return null;
	}

	const existingDisplay = detectDisplay();
	if ((options?.allowExistingDisplay ?? true) && existingDisplay) {
		return {
			display: existingDisplay,
			cleanup: async () => {},
		};
	}

	if (process.platform !== "linux") {
		return null;
	}

	if (
		(process.env.CAMOUFOX_HEADLESS_MODE ?? DEFAULT_CAMOUFOX_HEADLESS_MODE) ===
		"headful"
	) {
		throw new Error(
			"CAMOUFOX_HEADLESS_MODE=headful requires DISPLAY to already be set.",
		);
	}

	const xvfbBinary = findXvfbBinary();
	if (!xvfbBinary) {
		throw new Error("No DISPLAY or Xvfb available for headful Camoufox.");
	}

	let lastError: unknown = null;
	const preferredDisplay = process.env.CAMOUFOX_XVFB_DISPLAY?.trim() || null;
	const screen = parseScreenSpec();

	for (let attempt = 0; attempt < 5; attempt += 1) {
		const display =
			preferredDisplay ?? `:${100 + Math.floor(Math.random() * 800)}`;
		const displayNumber = Number(display.replace(/^:/, ""));
		if (!Number.isInteger(displayNumber)) {
			throw new Error(
				`Invalid CAMOUFOX_XVFB_DISPLAY value "${display}". Expected format like :99.`,
			);
		}
		const xvfb = spawn(
			xvfbBinary,
			[
				display,
				"-screen",
				"0",
				`${screen.width}x${screen.height}x${screen.depth}`,
				"-ac",
				"-nolisten",
				"tcp",
			],
			{ stdio: "ignore" },
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
						// Xvfb already exited.
					}
				},
			};
		} catch (error) {
			lastError = error;
			try {
				xvfb.kill("SIGTERM");
			} catch {
				// Ignore cleanup errors between attempts.
			}
			if (preferredDisplay) {
				break;
			}
		}
	}

	throw new Error(
		`Failed to bootstrap Xvfb: ${lastError instanceof Error ? lastError.message : "unknown error"}`,
	);
}
