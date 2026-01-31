import { isAuthenticated } from "../../lib/auth/isAuthenticated.js";
import { setupPage } from "../../lib/browser/setupPage.js";
import { launchOpenAI } from "./openai.js";


export async function openaiAgent(sessionId: string) {
    const openai = await launchOpenAI(sessionId);

    setupPage(openai.page, "openai");

    await openai.page.waitForTimeout(2000);

    const auth = await isAuthenticated(openai.page, "openai");

    return { browser: openai.browser, context: openai.context, page: openai.page, auth }
}