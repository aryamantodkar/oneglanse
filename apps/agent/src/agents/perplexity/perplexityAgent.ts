import { isAuthenticated } from "../../lib/auth/isAuthenticated.js";
import { setupPage } from "../../lib/browser/setupPage.js";
import { launchPerplexity } from "./perplexity.js";

export async function perplexityAgent() {
    const perplexity = await launchPerplexity();
    
    setupPage(perplexity.page, "perplexity");

    await perplexity.page.waitForTimeout(2000);

    const auth = await isAuthenticated(perplexity.page, "perplexity");

    return { browser: perplexity.browser, context: perplexity.context, page: perplexity.page, auth }
}