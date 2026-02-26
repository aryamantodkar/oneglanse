import { createServer } from "node:net";
import { spawn, type ChildProcess } from "node:child_process";
import { chromium } from "playwright";
import { STEALTH_CHROME_ARGS } from "./stealth.js";

/**
 * Find a random free TCP port on 127.0.0.1.
 */
export function getFreePort(): Promise<number> {
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
 * Spawn Chromium as a standalone process via --remote-debugging-port.
 * Chrome never sees Playwright's automation env vars or process hierarchy.
 */
export function spawnChromiumCDP(port: number, userDataDir: string): ChildProcess {
	const args = [
		`--remote-debugging-port=${port}`,
		"--headless=new",
		"--no-sandbox",
		"--disable-setuid-sandbox",
		"--disable-blink-features=AutomationControlled",
		...STEALTH_CHROME_ARGS,
		`--user-data-dir=${userDataDir}`,
	];

	return spawn(chromium.executablePath(), args, {
		stdio: "ignore",
		detached: false,
	});
}

/**
 * Poll the CDP /json/version endpoint until webSocketDebuggerUrl is available.
 */
export async function waitForCDPEndpoint(
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
