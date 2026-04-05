import { ExternalServiceError } from "@oneglanse/errors";
import {
	exponentialBackoff,
	logger,
} from "@oneglanse/utils";
import type { Provider } from "@oneglanse/types";
import type { Page } from "playwright";
import { getText } from "../../lib/input/response/getText.js";
import {
	extractResolvedResponseHtml,
	getSelectorProfile,
	invalidateSelectorProfileForPage,
} from "../../lib/selectors/index.js";
import { PROVIDER_CONFIGS } from "../providers/index.js";

const MAX_EXTRACTION_RETRIES = 2;
const INITIAL_EXTRACTION_RETRY_DELAY = 2_000;
const MAX_EXTRACTION_RETRY_DELAY = 5_000;
const MAX_DIAGNOSTIC_HTML_CHARS = 12_000;

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
	const profile = await getSelectorProfile(page, provider, "response", {
		allowModel: false,
	}).catch(() => null);
	return {
		selector: profile?.selectors.response[0] ?? "unresolved-response-selector",
		html: await extractResolvedResponseHtml(page, provider),
	};
}

export async function fetchPromptResponses(page: Page, provider: Provider): Promise<string> {
	const config = PROVIDER_CONFIGS[provider];

	await config.waitForResponse(page);

	// Retry extraction — keep retries short so we can rotate IPs faster on failure.
	for (let attempt = 1; attempt <= MAX_EXTRACTION_RETRIES; attempt++) {
		if (attempt > 1) await page.waitForTimeout(150);

		const response = await config.extractResponse(page);

		if (response && response.length > 0) {
			logger.log(`[${provider}] response extracted (${response.length} chars)`);
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
			// A selector can validate during streaming and become stale by the time the
			// final answer settles. Force one fresh selector resolution before the next
			// retry instead of repeating the same empty extraction.
			await invalidateSelectorProfileForPage(page, provider, "response");
			await getSelectorProfile(page, provider, "response", {
				forceRefresh: true,
			}).catch(() => null);
			await page.waitForTimeout(retryDelay);
		}
	}

	// Invalidate the cached response selector profile so the next attempt forces a
	// fresh LLM resolution. Without this, a wrong-but-valid cached selector would
	// produce the same empty extraction on every retry cycle.
	await invalidateSelectorProfileForPage(page, provider, "response");

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
		`extraction empty HTML snapshot (${provider}, selector=${selector}, url=${await page.getUrl().catch(() => page.url())}):\n${formatHtmlForLogs(diagnosticHtml || "<empty>")}`,
	);
	throw new ExternalServiceError(
		provider,
		`Markdown response extraction failed after ${MAX_EXTRACTION_RETRIES} retries`,
		502,
		{ visibleTextChars, retries: MAX_EXTRACTION_RETRIES },
	);
}
