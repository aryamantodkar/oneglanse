import path from "path";
import fs from "fs";
import { chromium as playwrightChromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { logger } from "../utils/logger.js";
import { Provider } from "@onescope/types";
import { AuthError } from "@onescope/errors";

playwrightChromium.use(StealthPlugin());

// Consistent user-agent across login (Mac) and runtime (VPS) to prevent session invalidation
export const BROWSER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export async function launchContext(provider: Provider) {
  const USER_DATA_DIR = path.resolve(
    process.env.VPS_AUTH_PROFILE_PATH ?? "/storage"
  );
  const providerDir = path.join(USER_DATA_DIR, provider);
    
  if (!fs.existsSync(providerDir)) {
    throw new AuthError(`${provider} not authenticated`);
  }

  logger.debug(`Loading authentication for ${provider} from: ${providerDir}`);
  
  const launchOptions: any = {
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ],
  };

  // Proxy must be set at browser level in Playwright (not context level)
  if (process.env.PROXY_SERVER) {
    launchOptions.proxy = {
      server: process.env.PROXY_SERVER,
    };
    logger.debug(`Using proxy: ${process.env.PROXY_SERVER}`);
  }

  const browser = await playwrightChromium.launch(launchOptions);

  const context = await browser.newContext({
    storageState: path.join(providerDir, `${provider}-auth.json`),
    viewport: { width: 1920, height: 1080 },
    userAgent: BROWSER_USER_AGENT,
  });
  
  return { browser, context };
}