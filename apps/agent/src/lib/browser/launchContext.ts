import path from "path";
import fs from "fs";
import { chromium as playwrightChromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { logger } from "../utils/logger.js";
import { Provider } from "@onescope/types";
import { AuthError } from "@onescope/errors";

playwrightChromium.use(StealthPlugin());

export async function launchContext(provider: Provider) {
  const USER_DATA_DIR = path.resolve(
    process.env.VPS_AUTH_PROFILE_PATH ?? "/storage"
  );
  const providerDir = path.join(USER_DATA_DIR, provider);
    
  if (!fs.existsSync(providerDir)) {
    throw new AuthError(`${provider} not authenticated`);
  }

  logger.debug(`Loading authentication for ${provider} from: ${providerDir}`);
  
  const browser = await playwrightChromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ],
  });

  const contextOptions: Parameters<typeof browser.newContext>[0] = {
    storageState: path.join(providerDir, `${provider}-auth.json`),
    viewport: { width: 1920, height: 1080 },
  };

  if (process.env.PROXY_SERVER) {
    contextOptions.proxy = {
      server: process.env.PROXY_SERVER,
    };
    logger.debug(`Using proxy: ${process.env.PROXY_SERVER}`);
  }

  const context = await browser.newContext(contextOptions);
  
  return { browser, context };
}