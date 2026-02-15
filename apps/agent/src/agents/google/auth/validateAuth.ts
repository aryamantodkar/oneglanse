import { Page } from "playwright";
import { pageHealthCheck } from "../../../lib/browser/pageHealthCheck.js";

export async function isGoogleAuthenticated(page: Page): Promise<boolean> {
    const url = page.url();

    // Must be on gemini.google.com and NOT on login/auth pages
    const isGemini =
        url.startsWith("https://gemini.google.com/") &&
        !url.includes("/login") &&
        !url.includes("/signup") &&
        !url.includes("/auth");

    if (!isGemini) return false;

    // Deep page health check — catches bot detection, CAPTCHAs, rate limits, missing editor
    const health = await pageHealthCheck(page, "google");
    return health.healthy;
}