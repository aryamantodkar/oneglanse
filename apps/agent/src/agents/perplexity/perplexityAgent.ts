import { isAuthenticated } from "../../lib/auth/isAuthenticated.js";
import { setupPage } from "../../lib/browser/setupPage.js";
import { launchPerplexity } from "./perplexity.js";

type AgentFactoryOptions = {
    proxyPoolId?: string;
};

export async function perplexityAgent(options: AgentFactoryOptions = {}) {
    const perplexity = await launchPerplexity({ proxyPoolId: options.proxyPoolId });
    
    setupPage(perplexity.page, "perplexity");

    await perplexity.page.waitForTimeout(2000);

    const auth = await isAuthenticated(perplexity.page, "perplexity");

    return { browser: perplexity.browser, context: perplexity.context, page: perplexity.page, auth, proxy: perplexity.proxy }
}
