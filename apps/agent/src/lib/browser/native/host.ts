#!/usr/bin/env node

import { connect, type Socket } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import {
	ONESCOPE_NATIVE_PORT_ENV,
	type NativeEnvelope,
	isNativeEnvelope,
} from "./protocol.js";

const port = Number(process.env[ONESCOPE_NATIVE_PORT_ENV] || "");
if (!Number.isInteger(port) || port <= 0) {
	process.stderr.write(
		`Missing or invalid ${ONESCOPE_NATIVE_PORT_ENV} for Onescope native host\n`,
	);
	process.exit(1);
}

function encodeNativeMessage(payload: unknown): Buffer {
	const body = Buffer.from(JSON.stringify(payload), "utf8");
	const header = Buffer.alloc(4);
	header.writeUInt32LE(body.length, 0);
	return Buffer.concat([header, body]);
}

async function connectToBridge(portNumber: number): Promise<Socket> {
	let lastError: unknown = null;
	for (let attempt = 0; attempt < 50; attempt += 1) {
		try {
			const socket = await new Promise<Socket>((resolve, reject) => {
				const candidate = connect({ host: "127.0.0.1", port: portNumber }, () =>
					resolve(candidate),
				);
				candidate.once("error", reject);
			});
			return socket;
		} catch (error) {
			lastError = error;
			await delay(200);
		}
	}

	throw lastError instanceof Error
		? lastError
		: new Error("failed to connect to Onescope native bridge");
}

function wireBridge(socket: Socket): void {
	let bridgeBuffer = "";
	socket.setEncoding("utf8");
	socket.on("data", (chunk: string) => {
		bridgeBuffer += chunk;
		while (true) {
			const newlineIndex = bridgeBuffer.indexOf("\n");
			if (newlineIndex === -1) break;
			const line = bridgeBuffer.slice(0, newlineIndex).trim();
			bridgeBuffer = bridgeBuffer.slice(newlineIndex + 1);
			if (!line) continue;

			try {
				const message = JSON.parse(line) as unknown;
				if (!isNativeEnvelope(message)) continue;
				process.stdout.write(encodeNativeMessage(message));
			} catch {
				// Drop malformed bridge frames.
			}
		}
	});
}

function wireStdio(socket: Socket): void {
	let stdinBuffer = Buffer.alloc(0);

	process.stdin.on("data", (chunk: Buffer) => {
		stdinBuffer = Buffer.concat([stdinBuffer, chunk]);
		while (stdinBuffer.length >= 4) {
			const bodyLength = stdinBuffer.readUInt32LE(0);
			if (stdinBuffer.length < bodyLength + 4) break;
			const body = stdinBuffer.subarray(4, bodyLength + 4);
			stdinBuffer = stdinBuffer.subarray(bodyLength + 4);

			try {
				const message = JSON.parse(body.toString("utf8")) as unknown;
				if (!isNativeEnvelope(message)) continue;
				socket.write(`${JSON.stringify(message satisfies NativeEnvelope)}\n`);
			} catch {
				// Ignore malformed extension frames.
			}
		}
	});

	process.stdin.on("end", () => {
		socket.end();
	});
}

try {
	const socket = await connectToBridge(port);
	socket.write(
		`${JSON.stringify({ kind: "event", event: "host-connected" } satisfies NativeEnvelope)}\n`,
	);
	wireBridge(socket);
	wireStdio(socket);

	socket.on("close", () => process.exit(0));
	socket.on("error", () => process.exit(1));
} catch (error) {
	process.stderr.write(
		`Failed to start Onescope native host: ${error instanceof Error ? error.message : String(error)}\n`,
	);
	process.exit(1);
}
