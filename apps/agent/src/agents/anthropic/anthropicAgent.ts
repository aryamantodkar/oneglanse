import { isAuthenticated } from "../../lib/auth/isAuthenticated.js";
import { setupPage } from "../../lib/browser/setupPage.js";
import { launchAnthropic } from "./anthropic.js";


export async function anthropicAgent() {
    const anthropic = await launchAnthropic();
    
    setupPage(anthropic.page, "anthropic");

    await anthropic.page.waitForTimeout(2000);

    const auth = await isAuthenticated(anthropic.page, "anthropic");

    return { browser: anthropic.browser, context: anthropic.context, page: anthropic.page, auth, proxy: anthropic.proxy }
}