import type { ProviderConfig } from "../../types.js";
import { resetProviderPage } from "../../_shared/resetProviderPage.js";
import { handleGeminiConsentPage } from "./session.js";

export const GEMINI_URL = "https://gemini.google.com/";

export async function resetGeminiPage(
	page: Parameters<ProviderConfig["waitForResponse"]>[0],
): Promise<void> {
	await resetProviderPage(page, "gemini", GEMINI_URL, {
		postNavigationHook: async (currentPage) => {
			await handleGeminiConsentPage(currentPage);
		},
	});
}
