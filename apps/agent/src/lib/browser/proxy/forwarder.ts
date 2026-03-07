import {
	type IncomingHttpHeaders,
	type IncomingMessage,
	type OutgoingHttpHeaders,
	type ServerResponse,
	createServer,
	request as httpRequest,
} from "node:http";
import { request as httpsRequest } from "node:https";
import { type Socket, isIP, connect as netConnect } from "node:net";
import type { Duplex } from "node:stream";
import { connect as tlsConnect } from "node:tls";

export type ProxyScheme = "http" | "https" | "socks4" | "socks5";

export type UpstreamProxyConfig = {
	scheme: ProxyScheme;
	host: string;
	port: number;
	username?: string;
	password?: string;
	serverUrl: string;
	logProxy: string;
};

export type ProxyForwarderHandle = {
	serverUrl: string;
	close: () => Promise<void>;
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

function readExact(socket: Socket, expectedBytes: number): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		let total = 0;

		const onData = (chunk: Buffer) => {
			chunks.push(chunk);
			total += chunk.length;

			if (total < expectedBytes) return;

			cleanup();
			const payload = Buffer.concat(chunks, total);
			const head = payload.subarray(0, expectedBytes);
			const tail = payload.subarray(expectedBytes);
			if (tail.length > 0) {
				socket.unshift(tail);
			}
			resolve(head);
		};
		const onError = (error: Error) => {
			cleanup();
			reject(error);
		};
		const onClose = () => {
			cleanup();
			reject(new Error("socket closed before enough data was received"));
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

function encodeSocks5Address(host: string, port: number): Buffer {
	const ipVersion = isIP(host);

	if (ipVersion === 4) {
		const octets = host.split(".").map((part) => Number(part));
		return Buffer.from([0x01, ...octets, (port >> 8) & 0xff, port & 0xff]);
	}

	if (ipVersion === 6) {
		const [headRaw = "", tailRaw = ""] = host.split("::");
		const parseHextets = (section: string): number[] =>
			section
				.split(":")
				.filter(Boolean)
				.flatMap((part) => {
					if (part.includes(".")) {
						const octets = part.split(".").map((value) => Number(value));
						if (
							octets.length !== 4 ||
							octets.some(
								(value) => !Number.isInteger(value) || value < 0 || value > 255,
							)
						) {
							throw new Error(`invalid embedded IPv4 address: ${part}`);
						}

						const [first, second, third, fourth] = octets;
						if (
							first === undefined ||
							second === undefined ||
							third === undefined ||
							fourth === undefined
						) {
							throw new Error(`invalid embedded IPv4 address: ${part}`);
						}
						return [(first << 8) | second, (third << 8) | fourth];
					}

					const value = Number.parseInt(part, 16);
					if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
						throw new Error(`invalid IPv6 segment: ${part}`);
					}

					return [value];
				});

		const head = parseHextets(headRaw);
		const tail = parseHextets(tailRaw);
		const zeroFillCount = host.includes("::")
			? 8 - head.length - tail.length
			: 0;
		if (zeroFillCount < 0) {
			throw new Error(`invalid IPv6 address: ${host}`);
		}

		const words = host.includes("::")
			? [...head, ...Array.from({ length: zeroFillCount }, () => 0), ...tail]
			: [...head, ...tail];
		if (words.length !== 8) {
			throw new Error(`invalid IPv6 address: ${host}`);
		}

		const expanded = Buffer.alloc(16);
		words.forEach((word, index) => {
			expanded[index * 2] = (word >> 8) & 0xff;
			expanded[index * 2 + 1] = word & 0xff;
		});
		return Buffer.concat([
			Buffer.from([0x04]),
			expanded,
			Buffer.from([(port >> 8) & 0xff, port & 0xff]),
		]);
	}

	const hostBuffer = Buffer.from(host);
	return Buffer.concat([
		Buffer.from([0x03, hostBuffer.length]),
		hostBuffer,
		Buffer.from([(port >> 8) & 0xff, port & 0xff]),
	]);
}

async function connectViaSocks5(
	proxy: UpstreamProxyConfig,
	targetHost: string,
	targetPort: number,
): Promise<Socket> {
	const socket = await connectTcp(proxy.host, proxy.port);
	const methods = proxy.username || proxy.password ? [0x00, 0x02] : [0x00];

	socket.write(Buffer.from([0x05, methods.length, ...methods]));
	const greeting = await readExact(socket, 2);

	if (greeting[0] !== 0x05 || greeting[1] === 0xff) {
		socket.destroy();
		throw new Error("SOCKS5 proxy rejected authentication methods");
	}

	if (greeting[1] === 0x02) {
		const username = Buffer.from(proxy.username ?? "");
		const password = Buffer.from(proxy.password ?? "");
		socket.write(
			Buffer.concat([
				Buffer.from([0x01, username.length]),
				username,
				Buffer.from([password.length]),
				password,
			]),
		);
		const authReply = await readExact(socket, 2);
		if (authReply[1] !== 0x00) {
			socket.destroy();
			throw new Error("SOCKS5 proxy authentication failed");
		}
	}

	socket.write(
		Buffer.concat([
			Buffer.from([0x05, 0x01, 0x00]),
			encodeSocks5Address(targetHost, targetPort),
		]),
	);

	const responseHeader = await readExact(socket, 4);
	if (responseHeader[1] !== 0x00) {
		socket.destroy();
		throw new Error(`SOCKS5 connect failed with code ${responseHeader[1]}`);
	}

	const atyp = responseHeader[3];
	if (atyp === 0x01) {
		await readExact(socket, 6);
	} else if (atyp === 0x03) {
		const length = await readExact(socket, 1);
		const lengthByte = length.at(0);
		if (lengthByte === undefined) {
			socket.destroy();
			throw new Error("SOCKS5 domain response was missing a length byte");
		}
		await readExact(socket, lengthByte + 2);
	} else if (atyp === 0x04) {
		await readExact(socket, 18);
	}

	return socket;
}

async function connectViaSocks4(
	proxy: UpstreamProxyConfig,
	targetHost: string,
	targetPort: number,
): Promise<Socket> {
	if (proxy.password) {
		throw new Error("SOCKS4 proxies do not support passwords");
	}

	const socket = await connectTcp(proxy.host, proxy.port);
	const username = Buffer.from(proxy.username ?? "");
	const targetIpVersion = isIP(targetHost);
	if (targetIpVersion === 6) {
		throw new Error("SOCKS4 proxies do not support IPv6 targets");
	}
	const ipBytes =
		targetIpVersion === 4
			? Buffer.from(targetHost.split(".").map((part) => Number(part)))
			: Buffer.from([0x00, 0x00, 0x00, 0x01]);
	const domainSuffix =
		targetIpVersion === 4 ? Buffer.alloc(0) : Buffer.from(`${targetHost}\0`);

	socket.write(
		Buffer.concat([
			Buffer.from([0x04, 0x01, (targetPort >> 8) & 0xff, targetPort & 0xff]),
			ipBytes,
			username,
			Buffer.from([0x00]),
			domainSuffix,
		]),
	);

	const response = await readExact(socket, 8);
	if (response[1] !== 0x5a) {
		socket.destroy();
		throw new Error(`SOCKS4 connect failed with code ${response[1]}`);
	}

	return socket;
}

async function createTunnelSocket(
	proxy: UpstreamProxyConfig,
	targetHost: string,
	targetPort: number,
): Promise<Socket> {
	if (proxy.scheme === "socks5") {
		return connectViaSocks5(proxy, targetHost, targetPort);
	}

	if (proxy.scheme === "socks4") {
		return connectViaSocks4(proxy, targetHost, targetPort);
	}

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

	if (proxy.scheme === "socks4" || proxy.scheme === "socks5") {
		const tunnelSocket = await createTunnelSocket(
			proxy,
			target.hostname,
			Number(target.port || 80),
		);
		trackSocket(tunnelSocket);

		const upstreamRequest = httpRequest(
			{
				method: request.method,
				host: target.hostname,
				port: Number(target.port || 80),
				path: `${target.pathname}${target.search}`,
				headers: {
					...sanitizeHeaders(request.headers),
					host: target.host,
				},
				agent: false,
				createConnection: () => tunnelSocket,
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

		upstreamRequest.on("error", (error) => {
			tunnelSocket.destroy();
			handleProxyError(response, 502, error);
		});

		request.pipe(upstreamRequest);
		return;
	}

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

export async function createProxyForwarder(
	proxy: UpstreamProxyConfig,
): Promise<ProxyForwarderHandle> {
	const sockets = new Set<TrackedSocket>();
	const server = createServer();

	const trackSocket = (socket: TrackedSocket) => {
		sockets.add(socket);
		socket.on("close", () => {
			sockets.delete(socket);
		});
	};

	server.on("connection", trackSocket);
	server.on("clientError", (error, socket) => {
		socket.destroy(error);
	});
	server.on("request", (request, response) => {
		handleHttpProxyRequest(request, response, proxy, trackSocket).catch(
			(error) => {
				handleProxyError(response, 502, error);
			},
		);
	});
	server.on("connect", (request, clientSocket, head) => {
		trackSocket(clientSocket);
		try {
			const { host, port } = parseAuthority(request.url ?? "");

			void createTunnelSocket(proxy, host, port)
				.then((upstreamSocket) => {
					trackSocket(upstreamSocket);
					clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
					if (head.length > 0) {
						upstreamSocket.write(head);
					}
					relaySockets(clientSocket, upstreamSocket);
				})
				.catch((error) => {
					clientSocket.write(
						`HTTP/1.1 502 Bad Gateway\r\nContent-Type: text/plain\r\nContent-Length: ${
							error instanceof Error ? Buffer.byteLength(error.message) : 11
						}\r\n\r\n${error instanceof Error ? error.message : "proxy error"}`,
					);
					clientSocket.destroy();
				});
		} catch (error) {
			clientSocket.write(
				`HTTP/1.1 400 Bad Request\r\nContent-Type: text/plain\r\nContent-Length: ${
					error instanceof Error ? Buffer.byteLength(error.message) : 11
				}\r\n\r\n${error instanceof Error ? error.message : "proxy error"}`,
			);
			clientSocket.destroy();
		}
	});

	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			server.off("error", reject);
			resolve();
		});
	});

	const address = server.address();
	if (!address || typeof address === "string") {
		throw new Error("Could not bind local proxy forwarder");
	}

	return {
		serverUrl: `http://127.0.0.1:${address.port}`,
		close: async () => {
			for (const socket of sockets) {
				socket.destroy();
			}
			await new Promise<void>((resolve) => {
				server.close(() => resolve());
			});
		},
	};
}
