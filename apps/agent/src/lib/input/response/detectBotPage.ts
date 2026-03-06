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
		.evaluate((): BotPageState => {
			const bodyText = (document.body?.innerText || "").replace(/\s+/g, " ").trim();
			const title = (document.title || "").trim();
			const url = window.location.href;

			const signals: Array<{ matched: boolean; reason: string }> = [
				{
					matched:
						/sorry/i.test(url) ||
						/our systems have detected unusual traffic/i.test(bodyText),
					reason: "bot detection: unusual traffic / sorry page",
				},
				{
					matched: /captcha|recaptcha|turnstile|verify you are human/i.test(bodyText),
					reason: "bot detection: captcha or human verification challenge",
				},
				{
					matched:
						Boolean(document.querySelector('form#captcha-form, iframe[src*="recaptcha"]')) ||
						/challenge/i.test(title),
					reason: "bot detection: challenge UI present",
				},
			];

			const hit = signals.find((signal) => signal.matched);
			return {
				botDetected: Boolean(hit),
				reason: hit?.reason ?? null,
			};
		})
		.catch(() => ({ botDetected: false, reason: null }));

	if (state.botDetected) {
		throw new ExternalServiceError(
			provider,
			state.reason ?? "bot detection page detected",
		);
	}
}
