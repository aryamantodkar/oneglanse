import { createServer } from "node:net";
import { spawn, type ChildProcess } from "node:child_process";
import { ExternalServiceError } from "@oneglanse/errors";
import { STEALTH_CHROME_ARGS } from "./stealth.js";

const SELENIUMBASE_READY_MARKER = "SELENIUMBASE_CDP_READY";

export function getFreePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (!address || typeof address === "string") {
				server.close(() =>
					reject(new ExternalServiceError("browser", "Could not get free port")),
				);
				return;
			}
			const port = address.port;
			server.close(() => resolve(port));
		});
		server.on("error", reject);
	});
}

const SELENIUMBASE_CDP_BRIDGE_SCRIPT = `
import argparse
import inspect
import os
import signal
import sys
import time

parser = argparse.ArgumentParser()
parser.add_argument("--port", type=int, required=True)
parser.add_argument("--user-data-dir", required=True)
parser.add_argument("--proxy", default="")
args = parser.parse_args()

def _log(message: str) -> None:
    print(message, file=sys.stderr, flush=True)

try:
    from seleniumbase import Driver
except Exception as exc:
    _log("SELENIUMBASE_IMPORT_ERROR: " + repr(exc))
    raise SystemExit(86)

signature = inspect.signature(Driver)
params = set(signature.parameters.keys())
kwargs = {}
has_auth_proxy = bool(args.proxy and "@" in args.proxy)

if "uc" in params and not has_auth_proxy:
    kwargs["uc"] = True
if not has_auth_proxy and "headless2" in params:
    kwargs["headless2"] = True
elif "headless" in params:
    kwargs["headless"] = True
if "headed" in params:
    kwargs["headed"] = False
if args.proxy and "proxy" in params:
    kwargs["proxy"] = args.proxy
browser_binary = os.getenv("SELENIUMBASE_BROWSER_BINARY", "").strip()
if browser_binary and "binary_location" in params:
    kwargs["binary_location"] = browser_binary

chrome_args = [
    f"--remote-debugging-port={args.port}",
    f"--user-data-dir={args.user_data_dir}",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-blink-features=AutomationControlled",
]
chrome_args.extend(${JSON.stringify(STEALTH_CHROME_ARGS)} )

if args.proxy and "proxy" not in params:
    if has_auth_proxy:
        _log("SELENIUMBASE_PROXY_ERROR: authenticated proxy requires Driver proxy parameter support.")
        raise SystemExit(88)
    chrome_args.append(f"--proxy-server={args.proxy}")

arg_field = None
if "chromium_arg" in params:
    arg_field = "chromium_arg"
elif "chrome_arg" in params:
    arg_field = "chrome_arg"
elif "browser_args" in params:
    arg_field = "browser_args"

if not arg_field:
    _log("SELENIUMBASE_ARG_ERROR: Driver does not expose a chromium/chrome arg parameter.")
    raise SystemExit(87)

kwargs[arg_field] = chrome_args

try:
    driver = Driver(**kwargs)
except TypeError:
    if isinstance(kwargs[arg_field], list):
        kwargs[arg_field] = ",".join(kwargs[arg_field])
        driver = Driver(**kwargs)
    else:
        raise
except Exception as exc:
    _log("SELENIUMBASE_DRIVER_ERROR: " + repr(exc))
    raise

running = True
def _shutdown(*_args):
    global running
    running = False

signal.signal(signal.SIGTERM, _shutdown)
signal.signal(signal.SIGINT, _shutdown)

_log("${SELENIUMBASE_READY_MARKER}")
print("${SELENIUMBASE_READY_MARKER}", flush=True)
while running:
    time.sleep(0.5)

try:
    driver.quit()
except Exception:
    pass
`;

export function spawnSeleniumBaseCDP(
	port: number,
	userDataDir: string,
	proxyServer?: string,
): ChildProcess {
	const launchArgs = [
		"-u",
		"-c",
		SELENIUMBASE_CDP_BRIDGE_SCRIPT,
		"--port",
		String(port),
		"--user-data-dir",
		userDataDir,
		...(proxyServer ? ["--proxy", proxyServer] : []),
	];

	return spawn("python3", launchArgs, {
		stdio: ["ignore", "pipe", "pipe"],
		detached: false,
	});
}

export async function killChromiumProcess(proc: ChildProcess): Promise<void> {
	const waitForExit = (timeoutMs: number) =>
		new Promise<void>((resolve) => {
			if (proc.exitCode !== null) {
				resolve();
				return;
			}

			const onExit = () => {
				clearTimeout(timer);
				resolve();
			};

			const timer = setTimeout(() => {
				proc.off("exit", onExit);
				resolve();
			}, timeoutMs);

			proc.once("exit", onExit);
		});

	try {
		proc.kill("SIGTERM");
		await waitForExit(250);
		if (proc.exitCode === null) await waitForExit(1000);
		if (proc.exitCode === null) proc.kill("SIGKILL");
	} catch {
		// Process may have already exited.
	}
}

export async function waitForCDPEndpoint(
	port: number,
	options?: {
		timeoutMs?: number;
		process?: ChildProcess | null;
		getProcessLogs?: () => string;
	},
): Promise<string> {
	const timeoutMs = options?.timeoutMs ?? 45_000;
	const url = `http://localhost:${port}/json/version`;
	const deadline = Date.now() + timeoutMs;
	let sawReadyMarker = false;

	while (Date.now() < deadline) {
		const processExited =
			options?.process &&
			(options.process.exitCode !== null || options.process.signalCode !== null);
		if (processExited && options?.process) {
			const logText = options.getProcessLogs?.() ?? "";
			const details = logText ? `: ${logText}` : "";
			const exitState =
				options.process.exitCode !== null
					? `code ${options.process.exitCode}`
					: `signal ${options.process.signalCode}`;
			const hint =
				options.process.exitCode === 86
					? " (seleniumbase import failed; install seleniumbase in runtime)"
					: options.process.exitCode === 87
						? " (seleniumbase Driver args mismatch; check installed seleniumbase version)"
						: options.process.exitCode === 88
							? " (seleniumbase does not support authenticated proxy arguments in this runtime)"
						: "";
			throw new ExternalServiceError(
				"browser",
				`SeleniumBase process exited before CDP was ready (${exitState})${hint}${details}`,
				503,
				{
					port,
					timeoutMs,
					exitCode: options.process.exitCode,
					signalCode: options.process.signalCode,
				},
			);
		}

		const logText = options?.getProcessLogs?.() ?? "";
		if (logText.includes(SELENIUMBASE_READY_MARKER)) {
			sawReadyMarker = true;
		}
		if (!sawReadyMarker) {
			await new Promise((resolve) => setTimeout(resolve, 200));
			continue;
		}

		try {
			const response = await fetch(url);
			if (response.ok) {
				const json = (await response.json()) as { webSocketDebuggerUrl?: string };
				if (json.webSocketDebuggerUrl) return json.webSocketDebuggerUrl;
			}
		} catch {
			// Browser not ready yet.
		}
		await new Promise((resolve) => setTimeout(resolve, 200));
	}

	const logText = options?.getProcessLogs?.() ?? "";
	const details = logText ? ` Last logs: ${logText}` : "";
	throw new ExternalServiceError(
		"browser",
		`CDP endpoint not ready within ${timeoutMs}ms.${details}`,
		503,
		{ port, timeoutMs },
	);
}
