import { createServer } from "node:net";
import { rm } from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";
import { chromium } from "playwright";
import type { AskPromptResult } from "@onescope/types";
import {
	getNextProxy,
	recordProxyResult,
} from "../../../../lib/browser/proxy/pool.js";
import { logger } from "../../../../lib/utils/logger.js";
import { turndown } from "../../../../lib/input/markdown/converter.js";
import { extractAIOverviewResponse } from "./extractResponse.js";
import { extractAIOverviewSources } from "./extractSources.js";
import {
	STEALTH_CHROME_ARGS,
	STEALTH_CONTEXT_OPTIONS,
	STEALTH_INIT_SCRIPT,
} from "../../../../lib/browser/stealth.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getFreePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (!address || typeof address === "string") {
				server.close(() => reject(new Error("Could not get free port")));
				return;
			}
			const port = address.port;
			server.close(() => resolve(port));
		});
		server.on("error", reject);
	});
}

/**
 * Spawn Chromium as a standalone process — NOT via playwright.launch().
 * Chrome never sees automation env vars or the Playwright process hierarchy.
 */
function spawnChromiumCDP(port: number, userDataDir: string): ChildProcess {
	const executablePath = chromium.executablePath();

	const args = [
		`--remote-debugging-port=${port}`,
		// Modern headless: less detectable than legacy --headless
		"--headless=new",
		// Linux VPS: no sandbox, no GPU; remove #1 automation signal at the Blink level
		"--no-sandbox",
		"--disable-setuid-sandbox",
		"--disable-blink-features=AutomationControlled",
		...STEALTH_CHROME_ARGS,
		`--user-data-dir=${userDataDir}`,
	];

	return spawn(executablePath, args, {
		stdio: "ignore",
		detached: false,
	});
}

async function waitForCDPEndpoint(
	port: number,
	timeoutMs = 15_000,
): Promise<string> {
	const url = `http://localhost:${port}/json/version`;
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		try {
			const res = await fetch(url);
			if (res.ok) {
				const json = (await res.json()) as { webSocketDebuggerUrl?: string };
				if (json.webSocketDebuggerUrl) return json.webSocketDebuggerUrl;
			}
		} catch {
			// Chrome not ready yet
		}
		await new Promise((r) => setTimeout(r, 200));
	}

	throw new Error(
		`CDP endpoint at port ${port} not ready within ${timeoutMs}ms`,
	);
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function searchGoogleAIOverview(
	userId: string,
	workspaceId: string,
	promptId: string,
	prompt: string,
): Promise<AskPromptResult> {
	const proxy = getNextProxy();
	const port = await getFreePort();
	const userDataDir = `/tmp/cdp-${port}`;

	logger.log(
		`[google-ai-overview] Searching: "${prompt.slice(0, 60)}" via port ${port}${proxy ? ` (proxy)` : " (direct)"}`,
	);

	let chromProcess: ChildProcess | null = null;

	try {
		chromProcess = spawnChromiumCDP(port, userDataDir);
		const wsEndpoint = await waitForCDPEndpoint(port);

		// connectOverCDP = Playwright as remote debugger, not launcher.
		// Chrome has no knowledge it was started for automation.
		const browser = await chromium.connectOverCDP(wsEndpoint);

		const contextOptions: Parameters<typeof browser.newContext>[0] = {
			...STEALTH_CONTEXT_OPTIONS,
			viewport: { width: 1920, height: 1080 },
			...(proxy ? { proxy: { server: proxy } } : {}),
		};

		if (!proxy) {
			logger.warn("[google-ai-overview] No proxy — using direct connection");
		}

		const context = await browser.newContext(contextOptions);

		// Inject stealth patches before ANY page JS runs
		await context.addInitScript(STEALTH_INIT_SCRIPT);

		const page = await context.newPage();

		try {
			// gl=us + pws=0: request US results, no personalisation.
			// This avoids EU cookie consent pages from proxy IPs in Europe.
			const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(prompt)}&hl=en&gl=us&pws=0`;
			await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });

			// Handle cookie/consent gate (shown when proxy IP is in a consent region)
			await page
				.locator(
					'button:has-text("Accept all"), button#L2AGLb, [jsname="b3VHJd"]',
				)
				.first()
				.click({ timeout: 3_000 })
				.catch(() => null);

			// AI Overview is not present for all queries — that's expected
			await page
				.waitForSelector('[data-container-id="model-response-placeholder"]', {
					timeout: 15_000,
				})
				.catch(() => null);

			const rawHtml = await extractAIOverviewResponse(page);
			const responseMarkdown = rawHtml ? turndown.turndown(rawHtml) : "";
			const sources = await extractAIOverviewSources(page);
			if (!responseMarkdown.trim()) {
				throw new Error("Empty AI Overview response extracted");
			}

			if (proxy) {
				recordProxyResult(proxy, true, undefined, "google-ai-overview");
			}

			logger.log(
				`[google-ai-overview] Done: ${responseMarkdown.length} chars, ${sources.length} sources`,
			);

			return { userId, workspaceId, promptId, prompt, response: responseMarkdown, sources };
		} finally {
			await context.close().catch(() => null);
			await browser.close().catch(() => null);
		}
	} catch (err: any) {
		if (proxy) {
			const isTimeout =
				err?.message?.includes("timeout") || err?.message?.includes("Timeout");
			recordProxyResult(
				proxy,
				false,
				isTimeout ? "timeout" : "connection_error",
				"google-ai-overview",
			);
		}
		logger.error(`[google-ai-overview] CDP search failed: ${err?.message ?? err}`);
		throw err;
	} finally {
		if (chromProcess) {
			try {
				chromProcess.kill("SIGTERM");
			} catch {
				// Process may have already exited
			}
		}
		// Clean up temp profile dir
		await rm(userDataDir, { recursive: true, force: true }).catch(() => null);
	}
}
