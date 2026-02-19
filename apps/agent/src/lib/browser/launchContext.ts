import path from "path";
import fs from "fs";
import { chromium as playwrightChromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { logger } from "../utils/logger.js";
import { Provider } from "@onescope/types";
import { AuthError } from "@onescope/errors";
import { getNextProxy, fetchProxies } from "./proxyPool.js";

playwrightChromium.use(StealthPlugin());

export async function launchContext(
  provider: Provider
) {
  const USER_DATA_DIR = path.resolve(
    process.env.VPS_AUTH_PROFILE_PATH ?? "/storage"
  );
  // google-ai-overview shares the same Google account session as google (Gemini)
  const authProvider = provider === "google-ai-overview" ? "google" : provider;
  const providerDir = path.join(USER_DATA_DIR, authProvider);
  const authFile = path.join(providerDir, `${authProvider}-auth.json`);

  if (!fs.existsSync(authFile)) {
    throw new AuthError(`AUTH_SESSION_MISSING: ${provider} not authenticated`);
  }

  logger.debug(`Loading authentication for ${provider} from: ${providerDir}${provider !== authProvider ? ` (using ${authProvider} session)` : ""}`);

  let proxy = getNextProxy();

  if (!proxy) {
    logger.warn(`[${provider}] Proxy pool exhausted, refreshing...`);
    try {
      await fetchProxies({ forceRefresh: true });
      proxy = getNextProxy();
    } catch (err: any) {
      logger.error(`[${provider}] Failed to refresh proxy pool:`, err?.message);
    }
  }

  if (proxy) {
    logger.log(`Using proxy: ${proxy}`);
  } else {
    logger.warn("No proxies available, launching without proxy");
  }

  const browser = await playwrightChromium.launch({
    headless: true,
    proxy: proxy
      ? { server: proxy }
      : undefined,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ],
  });

  const context = await browser.newContext({
    storageState: authFile,
    viewport: { width: 1920, height: 1080 },
  });

  return { browser, context, proxy };
}
