import { ExternalServiceError } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import type { Page } from "playwright";

type BotPageState = {
	botDetected: boolean;
	reason: string | null;
};

export async function detectBotPage(
	page: Page,
	provider: Provider,
): Promise<void> {
	const state = await page
		.runDomOp<BotPageState>("detect-bot-page")
		.catch(() => ({ botDetected: false, reason: null }));

	if (state.botDetected) {
		throw new ExternalServiceError(
			provider,
			state.reason ?? "bot detection page detected",
		);
	}
}
