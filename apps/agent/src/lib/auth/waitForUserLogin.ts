import type { Provider } from "@onescope/types";
import type { Page } from "playwright";
import { waitForAuthentication } from "./waitForAuthentication.js";

export async function waitForUserLogin(
	page: Page,
	provider: Provider,
	skipHealthCheck = false,
): Promise<void> {
	await waitForAuthentication(page, provider, 8 * 60 * 1000, skipHealthCheck);
}
