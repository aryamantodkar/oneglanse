import { ExternalServiceError } from "@oneglanse/errors";
import { logger } from "@oneglanse/utils";
import type { Provider } from "@oneglanse/types";
import type { Page } from "playwright";
import { getText } from "../../lib/input/response/getText.js";
import {
	extractResolvedResponseHtml,
	invalidateSelectorProfileForPage,
} from "../../lib/selectors/index.js";
import { PROVIDER_CONFIGS } from "../providers/index.js";

const MAX_EXTRACTION_RETRIES = 2;
const EXTRACTION_RETRY_DELAY_MS = 1_500;
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

export async function fetchPromptResponses(page: Page, provider: Provider): Promise<string> {
	const config = PROVIDER_CONFIGS[provider];

	await config.waitForResponse(page);
	await page
		.evaluate(() => {
			const root =
				document.scrollingElement ?? document.documentElement ?? document.body;
			root.scrollTo(0, root.scrollHeight);
		}, null)
		.catch(() => null);
	await page.waitForTimeout(200);

	for (let attempt = 1; attempt <= MAX_EXTRACTION_RETRIES; attempt++) {
		if (attempt > 1) await page.waitForTimeout(EXTRACTION_RETRY_DELAY_MS);

		const response = await config.extractResponse(page);

		if (response && response.length > 0) {
			logger.log(`[${provider}] response extracted (${response.length} chars)`);
			return response;
		}

		logger.warn(
			`extraction empty (attempt ${attempt}/${MAX_EXTRACTION_RETRIES})`,
		);
	}

	// Invalidate cached response selector so the next attempt forces fresh resolution
	await invalidateSelectorProfileForPage(page, provider, "response");

	// Diagnostic logging
	const visibleText = await getText(page, provider).catch(() => "");
	const visibleTextChars = visibleText?.trim().length ?? 0;
	const diagnosticHtml = await extractResolvedResponseHtml(page, provider).catch(() => "");
	const truncated =
		diagnosticHtml.length > MAX_DIAGNOSTIC_HTML_CHARS
			? `${diagnosticHtml.slice(0, MAX_DIAGNOSTIC_HTML_CHARS)}\n<!-- truncated -->`
			: diagnosticHtml;
	logger.warn(
		`extraction empty HTML snapshot (${provider}, url=${await page.getUrl().catch(() => page.url())}):\n${formatHtmlForLogs(truncated || "<empty>")}`,
	);

	throw new ExternalServiceError(
		provider,
		`Markdown response extraction failed after ${MAX_EXTRACTION_RETRIES} retries`,
		502,
		{ visibleTextChars, retries: MAX_EXTRACTION_RETRIES },
	);
}
