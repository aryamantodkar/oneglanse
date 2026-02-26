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

// ── User-Agent ────────────────────────────────────────────────────────────────
// Linux UA matches the VPS platform — no navigator.platform mismatch.
// Playwright 1.57 ships Chromium 131, so the version is accurate.
const USER_AGENT =
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// ── Stealth init script ───────────────────────────────────────────────────────
// Injected via context.addInitScript() — runs BEFORE any page JS, so detection
// scripts never see the real (bot) values.
const STEALTH_INIT_SCRIPT = `(function () {
  // 1. navigator.webdriver — most critical signal
  Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined,
    configurable: true,
  });

  // 2. window.chrome — missing = instant bot flag on Google
  //    Real Chrome exposes .app, .runtime, .loadTimes, .csi
  if (!window.chrome) {
    Object.defineProperty(window, 'chrome', {
      writable: true,
      enumerable: true,
      configurable: true,
      value: {
        app: {
          isInstalled: false,
          InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
          RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
        },
        runtime: {
          id: undefined,
          connect: function() {},
          sendMessage: function() {},
        },
        loadTimes: function () { return {}; },
        csi: function () {
          return { startE: Date.now(), onloadT: Date.now(), pageT: 0, tran: 15 };
        },
      },
    });
  }

  // 3. navigator.plugins — empty list = headless signal
  const _plugins = [
    { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
    { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
    { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: '' },
    { name: 'Microsoft Edge PDF Viewer', filename: 'AcroPDF.PDF', description: '' },
    { name: 'WebKit built-in PDF', filename: 'WebKit built-in PDF', description: '' },
  ];
  Object.defineProperty(navigator, 'plugins', {
    get: () => Object.assign(
      Object.create(PluginArray.prototype),
      {
        0: _plugins[0], 1: _plugins[1], 2: _plugins[2], 3: _plugins[3], 4: _plugins[4],
        length: 5,
        item: (i) => _plugins[i] ?? null,
        namedItem: (n) => _plugins.find(p => p.name === n) ?? null,
        refresh: function() {},
        [Symbol.iterator]: function* () { for (let i = 0; i < 5; i++) yield _plugins[i]; },
      }
    ),
    configurable: true,
  });

  // 4. navigator.mimeTypes — paired with plugins
  const _mimes = [
    { type: 'application/pdf', suffixes: 'pdf', description: '' },
    { type: 'text/pdf', suffixes: 'pdf', description: '' },
  ];
  Object.defineProperty(navigator, 'mimeTypes', {
    get: () => Object.assign(
      Object.create(MimeTypeArray.prototype),
      {
        0: _mimes[0], 1: _mimes[1],
        length: 2,
        item: (i) => _mimes[i] ?? null,
        namedItem: (n) => _mimes.find(m => m.type === n) ?? null,
        [Symbol.iterator]: function* () { for (let i = 0; i < 2; i++) yield _mimes[i]; },
      }
    ),
    configurable: true,
  });

  // 5. navigator.languages — must match Accept-Language header
  Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en'],
    configurable: true,
  });

  // 6. navigator.vendor — real Chrome always "Google Inc."
  Object.defineProperty(navigator, 'vendor', {
    get: () => 'Google Inc.',
    configurable: true,
  });

  // 7. Permissions API — headless handles 'notifications' differently
  if (navigator.permissions && navigator.permissions.query) {
    const _origQuery = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = function(params) {
      if (params && params.name === 'notifications') {
        return Promise.resolve(
          Object.setPrototypeOf(
            { state: 'prompt', onchange: null },
            PermissionStatus.prototype,
          )
        );
      }
      return _origQuery(params);
    };
  }

  // 8. Hardware concurrency — 0 is a headless signal
  if (!navigator.hardwareConcurrency) {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
  }

  // 9. Device memory — undefined is a headless signal
  try {
    if (!navigator.deviceMemory) {
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    }
  } catch {} // read-only in some envs

  // 10. Screen color depth — 0 is a headless signal
  if (!screen.colorDepth) {
    Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
    Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
  }
})();`;

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
		// Linux VPS: no sandbox, no GPU
		"--no-sandbox",
		"--disable-setuid-sandbox",
		"--disable-dev-shm-usage",
		"--disable-gpu",
		// Remove the #1 automation signal at the Blink level
		"--disable-blink-features=AutomationControlled",
		// Window size must match viewport to avoid outlier screen stats
		"--window-size=1920,1080",
		// Locale — must match UA and Accept-Language header
		"--lang=en-US",
		// Suppress UI chrome that doesn't exist in headless
		"--mute-audio",
		"--hide-scrollbars",
		// Reduce noise / fingerprint surface
		"--no-first-run",
		"--no-default-browser-check",
		"--disable-background-networking",
		"--disable-sync",
		"--disable-translate",
		"--disable-extensions",
		"--disable-plugins-discovery",
		"--disable-client-side-phishing-detection",
		"--disable-component-update",
		"--metrics-recording-only",
		"--safebrowsing-disable-auto-update",
		"--disable-ipc-flooding-protection",
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
			userAgent: USER_AGENT,
			viewport: { width: 1920, height: 1080 },
			locale: "en-US",
			timezoneId: "America/New_York",
			extraHTTPHeaders: {
				"Accept-Language": "en-US,en;q=0.9",
			},
		};

		if (proxy) {
			contextOptions.proxy = { server: proxy };
		} else {
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
