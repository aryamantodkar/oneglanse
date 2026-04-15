import type { ProviderConfig } from "../../types.js";
import { resetProviderPage } from "../../_shared/resetProviderPage.js";
import {
	assertAIOverviewPageNotBlocked,
	dismissGoogleConsentDialog,
} from "./session.js";

export const AI_OVERVIEW_URL = "https://www.google.com/";

export async function resetAIOverviewPage(
	page: Parameters<ProviderConfig["waitForResponse"]>[0],
): Promise<void> {
	await resetProviderPage(page, "ai-overview", AI_OVERVIEW_URL, {
		postNavigationHook: async (currentPage) => {
			assertAIOverviewPageNotBlocked(currentPage);
			await dismissGoogleConsentDialog(currentPage);
		},
	});
}
