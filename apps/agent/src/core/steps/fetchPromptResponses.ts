import { ExternalServiceError } from "@oneglanse/errors";
import {
	PROVIDER_MODEL_RESPONSE_SELECTORS,
	exponentialBackoff,
	logger,
} from "@oneglanse/utils";
import type { Provider } from "@oneglanse/types";
import type { Page } from "playwright";
import { env } from "../../env.js";
import { getText } from "../../lib/input/response/getText.js";
import { randomMouseJitter } from "../../lib/browser/humanBehavior.js";
import { PROVIDER_CONFIGS } from "../providers/index.js";

const MAX_EXTRACTION_RETRIES = env.MAX_EXTRACTION_RETRIES;
const INITIAL_EXTRACTION_RETRY_DELAY = env.EXTRACTION_RETRY_DELAY_MS;
const MAX_EXTRACTION_RETRY_DELAY = env.MAX_EXTRACTION_RETRY_DELAY_MS;
const MAX_DIAGNOSTIC_HTML_CHARS = 12_000;

function startJitterInterval(page: Page): () => void {
	const minMs = 4_000;
	const maxMs = 8_000;
	let cancelled = false;

	const scheduleNext = () => {
		if (cancelled) return;
		const delay = minMs + Math.floor(Math.random() * (maxMs - minMs));
		setTimeout(() => {
			if (cancelled) return;
			randomMouseJitter(page).catch(() => {});
			scheduleNext();
		}, delay);
	};

	scheduleNext();
	return () => {
		cancelled = true;
	};
}

function formatHtmlForLogs(html: string): string {
	const lines = html
		.replace(/>\s*</g, ">\n<")
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
	let indent = 0;

	return lines
		.map((line) => {
			if (/^<\//.test(line)) {
				indent = Math.max(indent - 1, 0);
			}

			const formatted = `${"  ".repeat(indent)}${line}`;
			const opensTag =
				/^<[^/!][^>]*[^/]>\s*$/.test(line) &&
				!/^<[^>]+>.*<\/[^>]+>$/.test(line);
			if (opensTag) {
				indent += 1;
			}

			return formatted;
		})
		.join("\n");
}

async function captureResponseHtmlForLogs(
	page: Page,
	provider: Provider,
): Promise<{ selector: string; html: string }> {
	for (const selector of PROVIDER_MODEL_RESPONSE_SELECTORS[provider] || []) {
		const nodes = page.locator(selector);
		const count = await nodes.count().catch(() => 0);
		if (count === 0) continue;

		for (let i = count - 1; i >= 0; i--) {
			const node = nodes.nth(i);
			const visible = await node.isVisible().catch(() => false);
			if (!visible) continue;

			const outerHtml = await node
				.evaluate((el) =>
					el instanceof HTMLElement ? el.outerHTML.trim() : "",
				)
				.catch(() => "");
			if (!outerHtml) continue;

			return { selector, html: outerHtml };
		}
	}

	for (const fallbackSelector of ["main", "body"]) {
		const node = page.locator(fallbackSelector).first();
		const visible = await node.isVisible().catch(() => false);
		if (!visible) continue;

		const outerHtml = await node
			.evaluate((el) =>
				el instanceof HTMLElement ? el.outerHTML.trim() : "",
			)
			.catch(() => "");
		if (!outerHtml) continue;

		return { selector: fallbackSelector, html: outerHtml };
	}

	return { selector: "none", html: "" };
}

export async function fetchPromptResponses(page: Page, provider: Provider): Promise<string> {
	const config = PROVIDER_CONFIGS[provider];

	const stopJitter = startJitterInterval(page);
	await config.waitForResponse(page);
	stopJitter();

	// Retry extraction — keep retries short so we can rotate IPs faster on failure.
	for (let attempt = 1; attempt <= MAX_EXTRACTION_RETRIES; attempt++) {
		await page.waitForTimeout(500);

		const response = await config.extractResponse(page);

		if (response && response.length > 0) {
			logger.debug(`response extracted (${response.length} chars)`);
			return response;
		}

		if (attempt < MAX_EXTRACTION_RETRIES) {
			const retryDelay =
				attempt <= 1
					? INITIAL_EXTRACTION_RETRY_DELAY
					: exponentialBackoff(
							attempt - 1,
							INITIAL_EXTRACTION_RETRY_DELAY,
							MAX_EXTRACTION_RETRY_DELAY,
						);
			logger.warn(
				`extraction empty, retrying in ${retryDelay / 1000}s (attempt ${attempt}/${MAX_EXTRACTION_RETRIES})`,
			);
			await page.waitForTimeout(retryDelay);
		}
	}

	// Diagnostic only. Plain text is never returned to avoid UI inconsistency.
	const visibleText = await getText(page, provider).catch(() => "");
	const visibleTextChars = visibleText?.trim().length ?? 0;
	const { selector, html } = await captureResponseHtmlForLogs(page, provider).catch(
		() => ({ selector: "capture_failed", html: "" }),
	);
	const diagnosticHtml =
		html.length > MAX_DIAGNOSTIC_HTML_CHARS
			? `${html.slice(0, MAX_DIAGNOSTIC_HTML_CHARS)}\n<!-- truncated -->`
			: html;
	logger.warn(
		`extraction empty HTML snapshot (${provider}, selector=${selector}, url=${page.url()}):\n${formatHtmlForLogs(diagnosticHtml || "<empty>")}`,
	);
	throw new ExternalServiceError(
		provider,
		`Markdown response extraction failed after ${MAX_EXTRACTION_RETRIES} retries`,
		502,
		{ visibleTextChars, retries: MAX_EXTRACTION_RETRIES },
	);
}
