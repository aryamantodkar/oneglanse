import { Page } from "playwright";
import { pageHealthCheck } from "../../../lib/browser/pageHealthCheck.js";

export async function isOpenaiAuthenticated(page: Page, skipHealthCheck: boolean = false): Promise<boolean> {
    const url = page.url();

    const isChatGPT =
        (url.startsWith("https://chatgpt.com")) &&
        !url.includes("/auth") &&
        !url.includes("/login") &&
        !url.includes("/signup") &&
        !url.includes("/callback");

    if (!isChatGPT) return false;

    // Skip health check during local auth flow
    if (skipHealthCheck) {
        return true;
    }

    // Deep page health check — catches bot detection, CAPTCHAs, rate limits, missing editor
    const health = await pageHealthCheck(page, "openai");
    return health.healthy;
}