import { isAuthenticated } from "../../lib/auth/isAuthenticated.js";
import { setupPage } from "../../lib/browser/setupPage.js";
import { launchAiOverview } from "./ai-overview-agent.js";

export async function aiOverviewAgent() {
  const aiOverview = await launchAiOverview();

  setupPage(aiOverview.page, "google-ai-overview");

  await aiOverview.page.waitForTimeout(5000);

  return {
    browser: aiOverview.browser,
    context: aiOverview.context,
    page: aiOverview.page,
    auth: true,
    proxy: aiOverview.proxy
  };
}
