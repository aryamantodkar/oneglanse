import { Page } from "playwright";
import { logger } from "../utils/logger.js";
import { Provider } from "@onescope/types";

export function setupPage(
    page: Page,
    provider: Provider
) {
    logger.debug("Current URL:", page.url());

    page.setDefaultTimeout(0);
    page.setDefaultNavigationTimeout(120_000);

    page.on("console", msg =>
        {
            // console.log(`[${provider.toUpperCase()} PAGE]`, msg.text())
        }
    );
}