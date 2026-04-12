import {
	BaseError,
	ExternalServiceError,
	toErrorMessage,
} from "@oneglanse/errors";
import { logger } from "@oneglanse/utils";
import type { Page } from "playwright";

export async function extractAIOverviewResponse(page: Page): Promise<string> {
	try {
		const result = await page.runDomOp<{
			success: boolean;
			html?: string;
			error?: string;
		}>("ai-overview-response-html");

		if (!result || !result.success) {
			const message = result?.error || "unknown extraction failure";
			logger.warn(`AI Overview extraction failed: ${message}`);
			throw new ExternalServiceError("ai-overview", message);
		}

		return result.html || "";
	} catch (error) {
		const msg = toErrorMessage(error);
		logger.error(`AI Overview extraction error: ${msg}`);
		if (error instanceof BaseError) throw error;
		throw new ExternalServiceError("ai-overview", msg, 500, undefined, error);
	}
}
