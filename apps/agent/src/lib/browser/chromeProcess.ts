import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { access, chmod, copyFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "@oneglanse/utils";
import {
	ONESCOPE_EXTENSION_ID,
	ONESCOPE_EXTENSION_KEY,
	ONESCOPE_NATIVE_HOST_NAME,
	ONESCOPE_NATIVE_PORT_ENV,
} from "./native/protocol.js";

const CHROME_CANDIDATES = [
	"/usr/bin/google-chrome-stable",
	"/usr/bin/google-chrome",
	"/usr/bin/chromium",
	"/usr/bin/chromium-browser",
	"/snap/bin/chromium",
];

const CHROME_ENV_KEYS = [
	"CHROME_PATH",
	"CHROME_BIN",
	"CHROME_EXECUTABLE_PATH",
	"GOOGLE_CHROME_BIN",
];

const XVFB_CANDIDATES = ["/usr/bin/Xvfb", "/usr/local/bin/Xvfb"];
const XVFB_START_TIMEOUT_MS = 5_000;

export type DisplayHandle = {
	display: string;
	cleanup: () => Promise<void>;
};

export type ChromeLaunchAssets = {
	extensionDir: string;
	cleanup: () => Promise<void>;
};

export type ChromeSpawnOptions = {
	userDataDir: string;
	extensionDir: string;
	nativePort: number;
	windowSize: {
		width: number;
		height: number;
	};
	display?: string;
	proxyServer?: string;
	locale?: string;
};

function findChromeBinary(): string {
	for (const envKey of CHROME_ENV_KEYS) {
		const candidate = process.env[envKey]?.trim();
		if (candidate && existsSync(candidate)) {
			return candidate;
		}
	}

	for (const candidate of CHROME_CANDIDATES) {
		if (existsSync(candidate)) {
			return candidate;
		}
	}

	throw new Error(
		"Unable to find a Chrome binary. Set CHROME_PATH to a real Google Chrome installation.",
	);
}

function findXvfbBinary(): string | null {
	for (const candidate of XVFB_CANDIDATES) {
		if (existsSync(candidate)) return candidate;
	}
	return null;
}

export function detectDisplay(): string | null {
	return process.env.DISPLAY?.trim() || null;
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
		throw new Error("No DISPLAY or Xvfb available for headful Chrome.");
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
		}
	}

	throw new Error(
		`Failed to bootstrap Xvfb: ${lastError instanceof Error ? lastError.message : "unknown error"}`,
	);
}

function nativeHostInstallDir(): string {
	return join(os.homedir(), ".config", "google-chrome", "NativeMessagingHosts");
}

async function ensureNativeHostInstalled(): Promise<void> {
	const installDir = nativeHostInstallDir();
	mkdirSync(installDir, { recursive: true });

	const runtimeDir = join(os.homedir(), ".onescope-native-host");
	mkdirSync(runtimeDir, { recursive: true });

	const wrapperPath = join(runtimeDir, "host.sh");
	const manifestPath = join(installDir, `${ONESCOPE_NATIVE_HOST_NAME}.json`);
	const hostScriptPath = fileURLToPath(new URL("./native/host.js", import.meta.url));

	await writeFile(
		wrapperPath,
		`#!/bin/sh\nexec "${process.execPath}" "${hostScriptPath}"\n`,
	);
	await chmod(wrapperPath, 0o755);

	await writeFile(
		manifestPath,
		JSON.stringify(
			{
				name: ONESCOPE_NATIVE_HOST_NAME,
				description: "Onescope Chrome native host",
				path: wrapperPath,
				type: "stdio",
				allowed_origins: [`chrome-extension://${ONESCOPE_EXTENSION_ID}/`],
			},
			null,
			2,
		),
	);
}

export async function materializeChromeExtension(): Promise<ChromeLaunchAssets> {
	await ensureNativeHostInstalled();
	const extensionDir = await mkdtemp(join(os.tmpdir(), "onescope-extension-"));

	const backgroundSource = fileURLToPath(
		new URL("./extension/background.js", import.meta.url),
	);
	const contentSource = fileURLToPath(
		new URL("./extension/contentScript.js", import.meta.url),
	);

	await copyFile(backgroundSource, join(extensionDir, "background.js"));
	await copyFile(contentSource, join(extensionDir, "contentScript.js"));
	await writeFile(
		join(extensionDir, "manifest.json"),
		JSON.stringify(
			{
				manifest_version: 3,
				name: "Onescope Browser Bridge",
				version: "1.0.0",
				key: ONESCOPE_EXTENSION_KEY,
				permissions: ["tabs", "nativeMessaging", "webNavigation"],
				host_permissions: [
					"https://chatgpt.com/*",
					"https://*.perplexity.ai/*",
					"https://gemini.google.com/*",
					"https://www.google.com/*",
					"https://claude.ai/*",
					],
					background: {
						service_worker: "background.js",
						type: "module",
					},
					content_scripts: [
					{
						matches: [
							"https://chatgpt.com/*",
							"https://*.perplexity.ai/*",
							"https://gemini.google.com/*",
							"https://www.google.com/*",
							"https://claude.ai/*",
						],
						js: ["contentScript.js"],
						run_at: "document_idle",
					},
				],
			},
			null,
			2,
		),
	);

	return {
		extensionDir,
		cleanup: async () => {
			await rm(extensionDir, { recursive: true, force: true }).catch(() => null);
		},
	};
}

export function spawnChromeProcess(options: ChromeSpawnOptions): ChildProcess {
	const binary = findChromeBinary();
	const display = options.display ?? detectDisplay() ?? undefined;
	const args = [
		`--user-data-dir=${options.userDataDir}`,
		`--load-extension=${options.extensionDir}`,
		"--no-first-run",
		"--no-default-browser-check",
		`--window-size=${options.windowSize.width},${options.windowSize.height}`,
		"about:blank",
	];

	// Containers often run the worker as root. Chrome refuses to start there
	// unless sandboxing is disabled explicitly.
	if (typeof process.getuid === "function" && process.getuid() === 0) {
		args.unshift("--disable-setuid-sandbox");
		args.unshift("--no-sandbox");
	}

	if (options.proxyServer) {
		args.push(`--proxy-server=${options.proxyServer}`);
		args.push("--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1");
	}

	if (options.locale) {
		args.push(`--lang=${options.locale}`);
	}

	const childEnv: NodeJS.ProcessEnv = {
		...process.env,
		[ONESCOPE_NATIVE_PORT_ENV]: String(options.nativePort),
	};
	if (display) {
		childEnv.DISPLAY = display;
	}

	logger.log(
		`launching Chrome via extension bridge${display ? " [headful/Xvfb]" : ""}`,
	);

	return spawn(binary, args, {
		stdio: ["ignore", "ignore", "pipe"],
		env: childEnv,
	});
}

export async function readChromeVersion(binary?: string): Promise<string> {
	const executable = binary || findChromeBinary();
	const child = spawn(executable, ["--version"], {
		stdio: ["ignore", "pipe", "ignore"],
	});

	const stdout = await new Promise<string>((resolve, reject) => {
		let output = "";
		child.stdout?.setEncoding("utf8");
		child.stdout?.on("data", (chunk: string) => {
			output += chunk;
		});
		child.once("error", reject);
		child.once("close", (code) => {
			if (code === 0) {
				resolve(output.trim());
				return;
			}
			reject(new Error(`chrome --version exited with code ${code}`));
		});
	});

	return stdout || "Google Chrome";
}
