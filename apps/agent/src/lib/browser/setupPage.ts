import type { Provider } from "@onescope/types";
import type { Page } from "playwright";
import { logger } from "../utils/logger.js";

export function setupPage(page: Page, provider: Provider) {
	logger.debug("Current URL:", page.url());

	page.setDefaultTimeout(0);
	page.setDefaultNavigationTimeout(0);

	page.on("console", (msg) => {
		// console.log(`[${provider.toUpperCase()} PAGE]`, msg.text())
	});
}
