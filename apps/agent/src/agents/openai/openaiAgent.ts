import { isAuthenticated } from "../../lib/auth/isAuthenticated.js";
import { setupPage } from "../../lib/browser/setupPage.js";
import { launchOpenAI } from "./openai.js";


type AgentFactoryOptions = {
    proxyPoolId?: string;
};

export async function openaiAgent(options: AgentFactoryOptions = {}) {
    const openai = await launchOpenAI({ proxyPoolId: options.proxyPoolId });

    setupPage(openai.page, "openai");

    await openai.page.waitForTimeout(2000);

    const auth = await isAuthenticated(openai.page, "openai");

    return { browser: openai.browser, context: openai.context, page: openai.page, auth, proxy: openai.proxy }
}
