import { isAuthenticated } from "../../lib/auth/isAuthenticated.js";
import { setupPage } from "../../lib/browser/setupPage.js";
import { launchGoogle } from "./google.js";

export async function googleAgent() {
    const google = await launchGoogle();
    
    setupPage(google.page, "google");

    await google.page.waitForTimeout(2000);

    const auth = await isAuthenticated(google.page, "google");

    return { browser: google.browser, context: google.context, page: google.page, auth, proxy: google.proxy }
}
