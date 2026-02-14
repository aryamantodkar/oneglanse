import { isAuthenticated } from "../../lib/auth/isAuthenticated.js";
import { setupPage } from "../../lib/browser/setupPage.js";
import { launchAnthropic } from "./anthropic.js";


type AgentFactoryOptions = {
    proxyPoolId?: string;
};

export async function anthropicAgent(options: AgentFactoryOptions = {}) {
    const anthropic = await launchAnthropic({ proxyPoolId: options.proxyPoolId });
    
    setupPage(anthropic.page, "anthropic");

    await anthropic.page.waitForTimeout(2000);

    const auth = await isAuthenticated(anthropic.page, "anthropic");

    return { browser: anthropic.browser, context: anthropic.context, page: anthropic.page, auth, proxy: anthropic.proxy }
}
