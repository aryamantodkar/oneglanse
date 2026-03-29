import type { Page } from "playwright";
import {
	BaseError,
	ExternalServiceError,
	toErrorMessage,
} from "@oneglanse/errors";
import { SELECTORS, logger } from "@oneglanse/utils";

export type AIOverviewExtractionResult =
	| { kind: "response"; html: string }
	| { kind: "no_ai_overview"; reason: string }
	| { kind: "selector_error"; reason: string };

export async function extractAIOverviewResponse(
	page: Page,
): Promise<AIOverviewExtractionResult> {
	try {
		const result = await page.runDomOp<{
			success: boolean;
			html?: string;
			error?: string;
		}>("ai-overview-response-html", { selectors: SELECTORS.aiOverview });

		if (!result || !result.success) {
			const message = result?.error || "unknown extraction failure";
			logger.warn(`AI Overview extraction failed: ${message}`);
			if (message.startsWith("no-ai-overview:")) {
				return { kind: "no_ai_overview", reason: message };
			}
			return { kind: "selector_error", reason: message };
		}

		const html = result.html || "";
		logger.debug(`✅ Extracted AI Overview HTML (${html.length} chars)`);
		return { kind: "response", html };
	} catch (error) {
		const msg = toErrorMessage(error);
		logger.error(`AI Overview extraction error: ${msg}`);
		if (error instanceof BaseError) throw error;
		throw new ExternalServiceError("ai-overview", msg, 500, undefined, error);
	}
}
