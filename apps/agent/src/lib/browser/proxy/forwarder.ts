import {
	type IncomingHttpHeaders,
	type IncomingMessage,
	type OutgoingHttpHeaders,
	type ServerResponse,
	createServer,
	request as httpRequest,
} from "node:http";
import { logger } from "@oneglanse/utils";
import { request as httpsRequest } from "node:https";
import { type Socket, connect as netConnect } from "node:net";
import type { Duplex } from "node:stream";
import { connect as tlsConnect } from "node:tls";

export type ProxyScheme = "http" | "https";

export type UpstreamProxyConfig = {
	scheme: ProxyScheme;
	host: string;
	port: number;
	username?: string;
	password?: string;
	serverUrl: string;
	logProxy: string;
};

type TrackedSocket = Socket | Duplex;

const SOCKET_TIMEOUT_MS = 30_000;

function buildBasicAuthHeader(proxy: UpstreamProxyConfig): string | null {
	if (!proxy.username && !proxy.password) return null;
	const token = Buffer.from(
		`${proxy.username ?? ""}:${proxy.password ?? ""}`,
	).toString("base64");
	return `Basic ${token}`;
}

function sanitizeHeaders(headers: IncomingHttpHeaders): OutgoingHttpHeaders {
	const nextHeaders: OutgoingHttpHeaders = { ...headers };
	delete nextHeaders["proxy-authorization"];
	delete nextHeaders["proxy-connection"];
	delete nextHeaders["Proxy-Authorization"];
	delete nextHeaders["Proxy-Connection"];
	return nextHeaders;
}

function formatHttpTarget(request: IncomingMessage): URL {
	if (!request.url) {
		throw new Error("Proxy request missing URL");
	}

	if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(request.url)) {
		return new URL(request.url);
	}

	if (!request.headers.host) {
		throw new Error("Proxy request missing Host header");
	}

	return new URL(`http://${request.headers.host}${request.url}`);
}

function parseAuthority(authority: string): { host: string; port: number } {
	if (authority.startsWith("[")) {
		const closingBracket = authority.indexOf("]");
		if (closingBracket === -1) {
			throw new Error(`Invalid authority: ${authority}`);
		}

		const host = authority.slice(1, closingBracket);
		const portPart = authority.slice(closingBracket + 1);
		const port = portPart.startsWith(":") ? Number(portPart.slice(1)) : 443;
		if (!Number.isFinite(port)) {
			throw new Error(`Invalid authority port: ${authority}`);
		}
		return { host, port };
	}

	const separator = authority.lastIndexOf(":");
	if (separator === -1) {
		return { host: authority, port: 443 };
	}

	const host = authority.slice(0, separator);
	const port = Number(authority.slice(separator + 1));
	if (!host || !Number.isFinite(port)) {
		throw new Error(`Invalid authority: ${authority}`);
	}

	return { host, port };
}

function connectTcp(host: string, port: number): Promise<Socket> {
	return new Promise((resolve, reject) => {
		const socket = netConnect({ host, port });

		const onError = (error: Error) => {
			cleanup();
			reject(error);
		};
		const onConnect = () => {
			cleanup();
			socket.setNoDelay(true);
			socket.setTimeout(SOCKET_TIMEOUT_MS, () => {
				socket.destroy(new Error("socket timeout"));
			});
			resolve(socket);
		};
		const cleanup = () => {
			socket.off("error", onError);
			socket.off("connect", onConnect);
		};

		socket.once("error", onError);
		socket.once("connect", onConnect);
	});
}

function connectTls(host: string, port: number): Promise<Socket> {
	return new Promise((resolve, reject) => {
		const socket = tlsConnect({
			host,
			port,
			servername: host,
			// Proxy providers (e.g. BrightData) may use custom CA certs.
			// rejectUnauthorized applies only to the proxy TLS hop, not to the
			// end-to-end TLS inside the CONNECT tunnel (which the browser validates).
			rejectUnauthorized: false,
		});

		const onError = (error: Error) => {
			cleanup();
			reject(error);
		};
		const onSecureConnect = () => {
			cleanup();
			socket.setNoDelay(true);
			socket.setTimeout(SOCKET_TIMEOUT_MS, () => {
				socket.destroy(new Error("socket timeout"));
			});
			resolve(socket);
		};
		const cleanup = () => {
			socket.off("error", onError);
			socket.off("secureConnect", onSecureConnect);
		};

		socket.once("error", onError);
		socket.once("secureConnect", onSecureConnect);
	});
}

/**
 * Read from socket until any of the given delimiters is found.
 * Handles both CRLF (\r\n) and LF-only (\n) proxy responses — some proxy
 * providers (e.g. Thordata) return HTTP responses with \n instead of \r\n.
 */
function readUntilAny(socket: Socket, ...delimiters: string[]): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const delimiterBuffers = delimiters.map((d) => Buffer.from(d));
		const chunks: Buffer[] = [];
		let total = 0;

		const onData = (chunk: Buffer) => {
			chunks.push(chunk);
			total += chunk.length;
			const payload = Buffer.concat(chunks, total);

			for (const delimiterBuffer of delimiterBuffers) {
				const index = payload.indexOf(delimiterBuffer);
				if (index === -1) continue;

				cleanup();
				const end = index + delimiterBuffer.length;
				const head = payload.subarray(0, end);
				const tail = payload.subarray(end);
				if (tail.length > 0) {
					socket.unshift(tail);
				}
				resolve(head);
				return;
			}
		};
		const onError = (error: Error) => {
			cleanup();
			reject(error);
		};
		const onClose = () => {
			cleanup();
			reject(new Error("socket closed before response headers were received"));
		};
		const cleanup = () => {
			socket.off("data", onData);
			socket.off("error", onError);
			socket.off("close", onClose);
		};

		socket.on("data", onData);
		socket.once("error", onError);
		socket.once("close", onClose);
	});
}

async function createTunnelSocket(
	proxy: UpstreamProxyConfig,
	targetHost: string,
	targetPort: number,
): Promise<Socket> {
	const socket =
		proxy.scheme === "https"
			? await connectTls(proxy.host, proxy.port)
			: await connectTcp(proxy.host, proxy.port);

	const authHeader = buildBasicAuthHeader(proxy);
	const requestLines = [
		`CONNECT ${targetHost}:${targetPort} HTTP/1.1`,
		`Host: ${targetHost}:${targetPort}`,
		"Proxy-Connection: Keep-Alive",
	];

	if (authHeader) {
		requestLines.push(`Proxy-Authorization: ${authHeader}`);
	}

	requestLines.push("", "");
	socket.write(requestLines.join("\r\n"));

	// Accept both CRLF (\r\n\r\n) and LF-only (\n\n) header terminators.
	// Some proxy providers (e.g. Thordata) use non-standard LF-only responses.
	const responseHead = await readUntilAny(socket, "\r\n\r\n", "\n\n");
	const statusLine = responseHead.toString("latin1").split(/\r?\n/, 1)[0] ?? "";
	if (!/^HTTP\/1\.[01] 200\b/i.test(statusLine)) {
		socket.destroy();
		throw new Error(`Proxy CONNECT failed: ${statusLine || "no response"}`);
	}

	return socket;
}

function handleProxyError(
	response: ServerResponse,
	statusCode: number,
	error: unknown,
): void {
	if (response.headersSent) {
		response.destroy(error instanceof Error ? error : undefined);
		return;
	}

	response.writeHead(statusCode, { "Content-Type": "text/plain" });
	response.end(error instanceof Error ? error.message : "proxy error");
}

async function handleHttpProxyRequest(
	request: IncomingMessage,
	response: ServerResponse,
	proxy: UpstreamProxyConfig,
	trackSocket: (socket: TrackedSocket) => void,
): Promise<void> {
	const target = formatHttpTarget(request);

	const proxyAuthHeader = buildBasicAuthHeader(proxy);
	const transport = proxy.scheme === "https" ? httpsRequest : httpRequest;
	const upstreamRequest = transport(
		{
			host: proxy.host,
			port: proxy.port,
			method: request.method,
			path: target.toString(),
			headers: {
				...sanitizeHeaders(request.headers),
				...(proxyAuthHeader ? { "Proxy-Authorization": proxyAuthHeader } : {}),
			},
			agent: false,
			// Proxy providers may use custom CA certs; only disable for proxy hop.
			rejectUnauthorized: false,
		},
		(upstreamResponse) => {
			response.writeHead(
				upstreamResponse.statusCode ?? 502,
				upstreamResponse.statusMessage,
				upstreamResponse.headers,
			);
			upstreamResponse.pipe(response);
		},
	);

	upstreamRequest.on("socket", (socket) => {
		trackSocket(socket as Socket);
	});

	upstreamRequest.on("error", (error) => {
		handleProxyError(response, 502, error);
	});

	request.pipe(upstreamRequest);
}

function relaySockets(
	clientSocket: TrackedSocket,
	upstreamSocket: TrackedSocket,
): void {
	const destroyPair = () => {
		clientSocket.destroy();
		upstreamSocket.destroy();
	};

	clientSocket.on("error", destroyPair);
	upstreamSocket.on("error", destroyPair);
	clientSocket.on("close", () => upstreamSocket.destroy());
	upstreamSocket.on("close", () => clientSocket.destroy());

	clientSocket.pipe(upstreamSocket);
	upstreamSocket.pipe(clientSocket);
}

/**
 * Quick TCP reachability check for an upstream proxy.
 * Returns true if a connection can be established within timeoutMs, false otherwise.
 * Uses a 2s default — fast enough to not block launch, long enough for residential proxies.
 */
export function checkProxyReachable(
	host: string,
	port: number,
	timeoutMs = 2_000,
): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = netConnect({ host, port });
		const timer = setTimeout(() => {
			socket.destroy();
			resolve(false);
		}, timeoutMs);
		socket.once("connect", () => {
			clearTimeout(timer);
			socket.destroy();
			resolve(true);
		});
		socket.once("error", () => {
			clearTimeout(timer);
			resolve(false);
		});
	});
}
