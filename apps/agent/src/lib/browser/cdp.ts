import { createServer } from "node:net";
import { spawn, type ChildProcess } from "node:child_process";
import { ExternalServiceError } from "@oneglanse/errors";
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
				server.close(() =>
					reject(new ExternalServiceError("cdp", "Could not get free port")),
				);
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
 * Gracefully terminate a Chromium process spawned via spawnChromiumCDP.
 * Sends SIGTERM first, then SIGKILL if the process hasn't exited after 250ms.
 */
export async function killChromiumProcess(proc: ChildProcess): Promise<void> {
	try {
		proc.kill("SIGTERM");
		await new Promise((r) => setTimeout(r, 250));
		if (proc.exitCode === null) {
			proc.kill("SIGKILL");
		}
	} catch {
		// Process may have already exited
	}
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

	throw new ExternalServiceError(
		"cdp",
		`endpoint not ready within ${timeoutMs}ms`,
		503,
		{ port, timeoutMs },
	);
}
