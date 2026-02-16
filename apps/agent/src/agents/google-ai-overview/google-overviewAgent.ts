import { isAuthenticated } from "../../lib/auth/isAuthenticated.js";
import { setupPage } from "../../lib/browser/setupPage.js";
import { launchGoogleOverview } from "./google-overview.js";

export async function googleOverviewAgent() {
  const googleOverview = await launchGoogleOverview();

  setupPage(googleOverview.page, "google-ai-overview");

  await googleOverview.page.waitForTimeout(2000);

  // Check authentication (uses Google account - same as Gemini)
  const auth = await isAuthenticated(googleOverview.page, "google-ai-overview");

  return {
    browser: googleOverview.browser,
    context: googleOverview.context,
    page: googleOverview.page,
    auth,
    proxy: googleOverview.proxy
  };
}
