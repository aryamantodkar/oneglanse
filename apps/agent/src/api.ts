import { timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { gunzipSync } from "node:zlib";
import { AUTH_PROVIDER_LIST } from "@oneglanse/types";
import { readProviderAuthStatuses, saveAuthSession } from "@oneglanse/services";
import { logger } from "@oneglanse/utils";
import { env } from "./env.js";

function safeTokenCompare(expected: string, actual: string): boolean {
	if (expected.length === 0 || expected.length !== actual.length) {
		return false;
	}

	return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

function isAuthorized(authorizationHeader: string | undefined): boolean {
	const expectedToken = env.AGENT_AUTH_UPLOAD_TOKEN?.trim();
	if (!expectedToken) {
		return false;
	}

	const token = authorizationHeader?.replace(/^Bearer\s+/i, "").trim() ?? "";
	return safeTokenCompare(expectedToken, token);
}

const server = createServer((req, res) => {
	if (req.method === "GET" && req.url === "/health") {
		void (async () => {
			const authStatuses = await readProviderAuthStatuses();
			res.setHeader("Content-Type", "application/json");
			res.statusCode = 200;
			res.end(
				JSON.stringify({
					status: "ok",
					timestamp: new Date().toISOString(),
					authProviders: authStatuses,
				}),
			);
		})();
		return;
	}

	if (req.method === "POST" && req.url === "/auth/sessions") {
		if (!isAuthorized(req.headers.authorization)) {
			res.statusCode = 401;
			res.end(JSON.stringify({ error: "Unauthorized" }));
			return;
		}

		const chunks: Buffer[] = [];
		let totalBytes = 0;
		let aborted = false;

		req.on("data", (chunk) => {
			const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
			chunks.push(buffer);
			totalBytes += buffer.length;
			if (totalBytes > 5_000_000) {
				aborted = true;
				res.statusCode = 413;
				res.end(JSON.stringify({ error: "Payload too large" }));
				req.destroy();
			}
		});

		req.on("end", () => {
			void (async () => {
				if (aborted) return;

				try {
					const rawBody = Buffer.concat(chunks);
					const body =
						typeof req.headers["content-encoding"] === "string" &&
						/\bgzip\b/i.test(req.headers["content-encoding"])
							? gunzipSync(rawBody).toString("utf8")
							: rawBody.toString("utf8");
					const parsed = JSON.parse(body) as {
						provider?: string;
						session?: unknown;
					};
					if (
						!parsed.provider ||
						!AUTH_PROVIDER_LIST.includes(parsed.provider as (typeof AUTH_PROVIDER_LIST)[number]) ||
						!parsed.session ||
						typeof parsed.session !== "object"
					) {
						res.statusCode = 400;
						res.end(JSON.stringify({ error: "Invalid auth session payload" }));
						return;
					}

					await saveAuthSession(
						parsed.provider as (typeof AUTH_PROVIDER_LIST)[number],
						parsed.session as never,
					);

					res.setHeader("Content-Type", "application/json");
					res.statusCode = 200;
					res.end(JSON.stringify({ ok: true }));
				} catch (error) {
					res.statusCode = 400;
					res.end(
						JSON.stringify({
							error: error instanceof Error ? error.message : String(error),
						}),
					);
				}
			})();
		});

		return;
	}

	res.statusCode = 404;
	res.end("Not Found");
});

server.listen(env.AGENT_API_PORT, env.AGENT_API_HOST, () => {
	logger.log(
		`[agent] auth API listening on http://${env.AGENT_API_HOST}:${env.AGENT_API_PORT}`,
	);
});
