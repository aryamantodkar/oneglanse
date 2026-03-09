import { createServer, type Server, type Socket } from "node:net";
import { randomUUID } from "node:crypto";
import {
	ExternalServiceError,
	toErrorMessage,
} from "@oneglanse/errors";
import { logger } from "@oneglanse/utils";
import {
	type NativeEnvelope,
	type NativeEvent,
	type NativeResponse,
	isNativeEnvelope,
} from "./protocol.js";

type PendingRequest = {
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
	timer: NodeJS.Timeout;
};

function parseJsonLines(
	buffer: string,
): { messages: NativeEnvelope[]; remainder: string } {
	const messages: NativeEnvelope[] = [];
	let remainder = buffer;

	while (true) {
		const newlineIndex = remainder.indexOf("\n");
		if (newlineIndex === -1) break;
		const line = remainder.slice(0, newlineIndex).trim();
		remainder = remainder.slice(newlineIndex + 1);
		if (!line) continue;

		const payload = JSON.parse(line) as unknown;
		if (isNativeEnvelope(payload)) {
			messages.push(payload);
		}
	}

	return { messages, remainder };
}

export class NativeBridge {
	private readonly server: Server;
	private socket: Socket | null = null;
	private port = 0;
	private socketBuffer = "";
	private readonly pending = new Map<string, PendingRequest>();
	private readonly eventWaiters = new Map<
		string,
		Array<{ resolve: (payload: unknown) => void; timer: NodeJS.Timeout }>
	>();
	private readonly seenEvents = new Map<string, unknown>();

	private constructor(server: Server) {
		this.server = server;
	}

	static async start(): Promise<NativeBridge> {
		const bridge = new NativeBridge(createServer());
		await bridge.listen();
		return bridge;
	}

	getPort(): number {
		return this.port;
	}

	private async listen(): Promise<void> {
		this.server.on("connection", (socket) => {
			logger.log("[native-bridge] native host connected");
			this.socket?.destroy();
			this.socket = socket;
			this.socketBuffer = "";

			socket.setEncoding("utf8");
			socket.on("data", (chunk: string) => {
				this.handleSocketData(chunk);
			});
			socket.on("close", () => {
				if (this.socket === socket) {
					logger.warn("[native-bridge] native host disconnected");
					this.socket = null;
				}
			});
			socket.on("error", (error) => {
				logger.warn(
					`[native-bridge] socket error: ${toErrorMessage(error)}`,
				);
			});
		});

		await new Promise<void>((resolve, reject) => {
			this.server.once("error", reject);
			this.server.listen(0, "127.0.0.1", () => {
				const address = this.server.address();
				if (!address || typeof address === "string") {
					reject(new Error("bridge server did not expose a TCP port"));
					return;
				}
				this.port = address.port;
				resolve();
			});
		});
	}

	private handleSocketData(chunk: string): void {
		this.socketBuffer += chunk;
		try {
			const { messages, remainder } = parseJsonLines(this.socketBuffer);
			this.socketBuffer = remainder;
			for (const message of messages) {
				this.handleEnvelope(message);
			}
		} catch (error) {
			logger.warn(
				`[native-bridge] failed to parse host message: ${toErrorMessage(error)}`,
			);
			this.socketBuffer = "";
		}
	}

	private handleEnvelope(message: NativeEnvelope): void {
		if (message.kind === "response") {
			this.resolvePending(message);
			return;
		}

		if (message.kind === "event") {
			this.resolveEvent(message);
		}
	}

	private resolvePending(message: NativeResponse): void {
		const pending = this.pending.get(message.requestId);
		if (!pending) return;

		clearTimeout(pending.timer);
		this.pending.delete(message.requestId);
		if (message.ok) {
			pending.resolve(message.result);
			return;
		}

		pending.reject(
			new Error(message.error || "native request failed without an error"),
		);
	}

	private resolveEvent(message: NativeEvent): void {
		this.seenEvents.set(message.event, message.payload);
		const waiters = this.eventWaiters.get(message.event);
		if (!waiters?.length) return;
		this.eventWaiters.delete(message.event);
		for (const waiter of waiters) {
			clearTimeout(waiter.timer);
			waiter.resolve(message.payload);
		}
	}

	async waitForEvent(event: string, timeoutMs: number): Promise<unknown> {
		if (this.seenEvents.has(event)) {
			return this.seenEvents.get(event);
		}

		return await new Promise<unknown>((resolve, reject) => {
			const timer = setTimeout(() => {
				const waiters = this.eventWaiters.get(event) || [];
				this.eventWaiters.set(
					event,
					waiters.filter((waiter) => waiter.resolve !== resolve),
				);
				reject(new Error(`timed out waiting for native event: ${event}`));
			}, timeoutMs);

			const waiters = this.eventWaiters.get(event) || [];
			waiters.push({ resolve, timer });
			this.eventWaiters.set(event, waiters);
		});
	}

	private async ensureSocket(timeoutMs = 20_000): Promise<Socket> {
		if (this.socket) return this.socket;

		await this.waitForEvent("host-connected", timeoutMs);
		if (!this.socket) {
			throw new ExternalServiceError(
				"browser",
				"native host signalled readiness but no bridge socket is attached",
			);
		}
		return this.socket;
	}

	async request<T>(
		method: string,
		params?: unknown,
		timeoutMs = 60_000,
	): Promise<T> {
		const socket = await this.ensureSocket();
		const requestId = randomUUID();
		const payload = JSON.stringify({
			kind: "request",
			requestId,
			method,
			params,
		} satisfies NativeEnvelope);

		return await new Promise<T>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(requestId);
				reject(
					new Error(
						`native request timed out (${method}, ${timeoutMs}ms)`,
					),
				);
			}, timeoutMs);

			this.pending.set(requestId, {
				resolve: (value) => resolve(value as T),
				reject,
				timer,
			});
			socket.write(`${payload}\n`, (error) => {
				if (!error) return;
				clearTimeout(timer);
				this.pending.delete(requestId);
				reject(error);
			});
		});
	}

	async close(): Promise<void> {
		for (const [, pending] of this.pending) {
			clearTimeout(pending.timer);
			pending.reject(new Error("native bridge closed"));
		}
		this.pending.clear();

		for (const [, waiters] of this.eventWaiters) {
			for (const waiter of waiters) {
				clearTimeout(waiter.timer);
			}
		}
		this.eventWaiters.clear();

		this.socket?.destroy();
		this.socket = null;

		await new Promise<void>((resolve) => {
			this.server.close(() => resolve());
		});
	}
}
