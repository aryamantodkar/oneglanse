import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { access } from "node:fs/promises";
import { createServer } from "node:net";
import { logger } from "@oneglanse/utils";
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
	locale?: string;
	display?: string;
};

export type DisplayHandle = {
	display: string;
	cleanup: () => Promise<void>;
};

type CDPError = {
	message?: string;
};

type CDPEnvelope = {
	id?: number;
	method?: string;
	params?: Record<string, unknown>;
	result?: unknown;
	error?: CDPError;
	sessionId?: string;
};

type TargetInfo = {
	type?: string;
	url?: string;
};

type AttachedToTargetParams = {
	sessionId?: string;
	targetInfo?: TargetInfo;
	waitingForDebugger?: boolean;
};

type DetachedFromTargetParams = {
	sessionId?: string;
};

type ReceivedMessageFromTargetParams = {
	sessionId?: string;
	message?: string;
};

type AutoAttachFilterEntry = {
	type?: string;
	exclude: boolean;
};

type PendingCommand = {
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
};

type PendingExecutionContext = {
	resolve: () => void;
	reject: (error: Error) => void;
	timer: ReturnType<typeof setTimeout>;
};

const WORKER_TARGET_TYPES = new Set([
	"worker",
	"shared_worker",
	"service_worker",
]);
const AUTO_ATTACH_FILTER: AutoAttachFilterEntry[] = [
	{ type: "worker", exclude: false },
	{ type: "shared_worker", exclude: false },
	{ type: "service_worker", exclude: false },
	{ exclude: true },
];
const WORKER_CONTEXT_TIMEOUT_MS = 2_500;

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
		throw new Error(
			"No DISPLAY or Xvfb detected on Linux. Install Xvfb or provide a running display to avoid a headless fingerprint.",
		);
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

	if (!isHeadful) {
		args.push("--headless=new");
	}

	args.push(`--window-size=${windowSize.width},${windowSize.height}`);
	args.push(...buildChromeArgs(options?.locale));

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

function waitForWebSocketOpen(
	socket: WebSocket,
	timeoutMs = 5_000,
): Promise<void> {
	return new Promise((resolve, reject) => {
		if (socket.readyState === WebSocket.OPEN) {
			resolve();
			return;
		}

		const timer = setTimeout(() => {
			cleanup();
			reject(new Error(`CDP WebSocket did not open within ${timeoutMs}ms`));
		}, timeoutMs);

		const handleOpen = () => {
			cleanup();
			resolve();
		};
		const handleError = () => {
			cleanup();
			reject(new Error("CDP WebSocket failed before opening"));
		};
		const cleanup = () => {
			clearTimeout(timer);
			socket.removeEventListener("open", handleOpen);
			socket.removeEventListener("error", handleError);
		};

		socket.addEventListener("open", handleOpen);
		socket.addEventListener("error", handleError);
	});
}

function waitForWebSocketClose(socket: WebSocket): Promise<void> {
	return new Promise((resolve) => {
		if (socket.readyState === WebSocket.CLOSED) {
			resolve();
			return;
		}

		const handleClose = () => {
			socket.removeEventListener("close", handleClose);
			resolve();
		};

		socket.addEventListener("close", handleClose);
	});
}

async function readWebSocketMessageData(data: unknown): Promise<string> {
	if (typeof data === "string") {
		return data;
	}
	if (data instanceof ArrayBuffer) {
		return Buffer.from(data).toString("utf8");
	}
	if (ArrayBuffer.isView(data)) {
		return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString(
			"utf8",
		);
	}
	if (typeof Blob !== "undefined" && data instanceof Blob) {
		return data.text();
	}
	return String(data);
}

export async function attachWorkerStealthTargets(
	wsEndpoint: string,
	bootstrap: string,
): Promise<() => Promise<void>> {
	if (typeof WebSocket === "undefined") {
		return async () => {};
	}

	const socket = new WebSocket(wsEndpoint);
	const pendingCommands = new Map<number, PendingCommand>();
	const pendingExecutionContexts = new Map<string, PendingExecutionContext>();
	const activeAttachments = new Set<Promise<void>>();
	let nextId = 1;
	let closed = false;

	const rejectPendingCommand = (id: number, error: Error) => {
		const pending = pendingCommands.get(id);
		if (!pending) {
			return;
		}
		pendingCommands.delete(id);
		pending.reject(error);
	};

	const rejectPendingExecutionContext = (sessionId: string, error: Error) => {
		const pending = pendingExecutionContexts.get(sessionId);
		if (!pending) {
			return;
		}
		pendingExecutionContexts.delete(sessionId);
		clearTimeout(pending.timer);
		pending.reject(error);
	};

	const sendCommand = async (
		method: string,
		params: Record<string, unknown> = {},
		sessionId?: string,
	): Promise<unknown> => {
		if (closed || socket.readyState !== WebSocket.OPEN) {
			throw new Error("worker stealth CDP socket is not open");
		}

		const id = nextId++;
		const payload = sessionId
			? { id, method, params, sessionId }
			: { id, method, params };

		const result = new Promise<unknown>((resolve, reject) => {
			pendingCommands.set(id, { resolve, reject });
		});

		socket.send(JSON.stringify(payload));
		return result;
	};

	const waitForExecutionContext = (sessionId: string): Promise<void> => {
		const existing = pendingExecutionContexts.get(sessionId);
		if (existing) {
			clearTimeout(existing.timer);
			existing.reject(new Error("execution context waiter replaced"));
			pendingExecutionContexts.delete(sessionId);
		}

		return new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => {
				pendingExecutionContexts.delete(sessionId);
				reject(
					new Error(
						`worker execution context for session ${sessionId} was not created in time`,
					),
				);
			}, WORKER_CONTEXT_TIMEOUT_MS);
			pendingExecutionContexts.set(sessionId, { resolve, reject, timer });
		});
	};

	const resumeTarget = async (sessionId?: string) => {
		if (!sessionId || closed || socket.readyState !== WebSocket.OPEN) {
			return;
		}
		await sendCommand("Runtime.runIfWaitingForDebugger", {}, sessionId).catch(
			() => null,
		);
	};

	const handleAttachedTarget = async ({
		sessionId,
		targetInfo,
		waitingForDebugger,
	}: AttachedToTargetParams) => {
		if (!sessionId) {
			return;
		}

		const targetType = targetInfo?.type ?? "";
		const targetUrl = targetInfo?.url ?? "";
		const isWorkerTarget = WORKER_TARGET_TYPES.has(targetType);
		const isPageWrappedWorker = /^(blob:|data:)/i.test(targetUrl);

		if (!isWorkerTarget || isPageWrappedWorker) {
			if (waitingForDebugger) {
				await resumeTarget(sessionId);
			}
			return;
		}

		try {
			await sendCommand(
				"Target.setAutoAttach",
				{
					autoAttach: true,
					waitForDebuggerOnStart: true,
					flatten: true,
					filter: AUTO_ATTACH_FILTER,
				},
				sessionId,
			).catch(() => null);
			const executionContextReady = waitForExecutionContext(sessionId);
			await sendCommand("Runtime.enable", {}, sessionId);
			await executionContextReady;
			await sendCommand(
				"Runtime.evaluate",
				{
					expression: bootstrap,
					awaitPromise: false,
					includeCommandLineAPI: false,
					returnByValue: false,
					userGesture: false,
				},
				sessionId,
			);
		} catch (error) {
			logger.warn(
				`worker stealth injection failed for ${targetType} (${targetUrl || "unknown url"}): ${error instanceof Error ? error.message : String(error)}`,
			);
		} finally {
			if (waitingForDebugger) {
				await resumeTarget(sessionId);
			}
		}
	};

	const handleMessage = async (rawData: unknown) => {
		let payload: CDPEnvelope;
		try {
			payload = JSON.parse(
				await readWebSocketMessageData(rawData),
			) as CDPEnvelope;
		} catch {
			return;
		}

		if (typeof payload.id === "number") {
			const pending = pendingCommands.get(payload.id);
			if (!pending) {
				return;
			}
			pendingCommands.delete(payload.id);
			if (payload.error) {
				pending.reject(
					new Error(payload.error.message || `CDP ${payload.method} failed`),
				);
				return;
			}
			pending.resolve(payload.result);
			return;
		}

		if (
			payload.method === "Runtime.executionContextCreated" &&
			typeof payload.sessionId === "string"
		) {
			const pending = pendingExecutionContexts.get(payload.sessionId);
			if (!pending) {
				return;
			}
			pendingExecutionContexts.delete(payload.sessionId);
			clearTimeout(pending.timer);
			pending.resolve();
			return;
		}

		if (
			payload.method === "Target.detachedFromTarget" &&
			payload.params &&
			typeof (payload.params as DetachedFromTargetParams).sessionId === "string"
		) {
			rejectPendingExecutionContext(
				(payload.params as DetachedFromTargetParams).sessionId as string,
				new Error("worker target detached before stealth injection completed"),
			);
			return;
		}

		if (
			payload.method === "Target.attachedToTarget" &&
			payload.params &&
			typeof (payload.params as AttachedToTargetParams).sessionId === "string"
		) {
			const attachPromise = handleAttachedTarget(
				payload.params as AttachedToTargetParams,
			);
			activeAttachments.add(attachPromise);
			void attachPromise.finally(() => {
				activeAttachments.delete(attachPromise);
			});
			return;
		}

		if (
			payload.method === "Target.receivedMessageFromTarget" &&
			payload.params &&
			typeof (payload.params as ReceivedMessageFromTargetParams).message ===
				"string"
		) {
			const nested = payload.params as ReceivedMessageFromTargetParams;
			let nestedPayload: CDPEnvelope;
			try {
				nestedPayload = JSON.parse(nested.message as string) as CDPEnvelope;
			} catch {
				return;
			}

			if (
				nestedPayload.method === "Runtime.executionContextCreated" &&
				typeof nested.sessionId === "string"
			) {
				const pending = pendingExecutionContexts.get(nested.sessionId);
				if (!pending) {
					return;
				}
				pendingExecutionContexts.delete(nested.sessionId);
				clearTimeout(pending.timer);
				pending.resolve();
				return;
			}
		}
	};

	const handleSocketClose = () => {
		closed = true;
		for (const [id] of pendingCommands) {
			rejectPendingCommand(id, new Error("worker stealth CDP socket closed"));
		}
		for (const [sessionId] of pendingExecutionContexts) {
			rejectPendingExecutionContext(
				sessionId,
				new Error("worker stealth CDP socket closed"),
			);
		}
	};

	await waitForWebSocketOpen(socket);

	socket.addEventListener("close", handleSocketClose);
	socket.addEventListener("message", (event) => {
		void handleMessage(event.data);
	});

	try {
		await sendCommand("Target.setAutoAttach", {
			autoAttach: true,
			waitForDebuggerOnStart: true,
			flatten: true,
			filter: AUTO_ATTACH_FILTER,
		});
	} catch (error) {
		logger.warn(
			`worker stealth target filtering unavailable, disabling browser-level worker auto-attach: ${error instanceof Error ? error.message : String(error)}`,
		);
		socket.close();
		await waitForWebSocketClose(socket).catch(() => null);
		handleSocketClose();
		return async () => {};
	}

	return async () => {
		if (closed) {
			return;
		}

		try {
			if (socket.readyState === WebSocket.OPEN) {
				await sendCommand("Target.setAutoAttach", {
					autoAttach: false,
					waitForDebuggerOnStart: false,
					flatten: true,
				}).catch(() => null);
			}
		} finally {
			closed = true;
			for (const attachPromise of activeAttachments) {
				await attachPromise.catch(() => null);
			}
			socket.close();
			await waitForWebSocketClose(socket).catch(() => null);
			handleSocketClose();
		}
	};
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
