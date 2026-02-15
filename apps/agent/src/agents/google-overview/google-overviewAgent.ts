import { setupPage } from "../../lib/browser/setupPage.js";
import { launchGoogleOverview } from "./google-overview.js";

export async function googleOverviewAgent() {
  const googleOverview = await launchGoogleOverview();

  setupPage(googleOverview.page, "google-overview");

  await googleOverview.page.waitForTimeout(2000);

  // No authentication needed for AI Overview
  const auth = true;

  return {
    browser: googleOverview.browser,
    context: googleOverview.context,
    page: googleOverview.page,
    auth,
    proxy: googleOverview.proxy
  };
}
