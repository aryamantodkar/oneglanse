import type { Page } from "playwright";
import { pageHealthCheck } from "../../../lib/browser/pageHealthCheck.js";

export async function isAnthropicAuthenticated(
	page: Page,
	skipHealthCheck = false,
): Promise<boolean> {
	const url = page.url();

	// Must be on claude.ai and NOT on login
	const isClaude =
		url.startsWith("https://claude.ai") &&
		!url.includes("/login") &&
		!url.includes("/signup") &&
		!url.includes("/auth");

	if (!isClaude) return false;

	// Skip health check during local auth flow
	if (skipHealthCheck) {
		return true;
	}

	// Deep page health check — catches bot detection, CAPTCHAs, rate limits, missing editor
	const health = await pageHealthCheck(page, "anthropic");
	return health.healthy;
}
