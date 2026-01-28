import path from "path";
import fs from "fs";
import { chromium as playwrightChromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { logger } from "../utils/logger.js";
import { Provider } from "@onescope/types";
import { AuthError } from "@onescope/errors";

playwrightChromium.use(StealthPlugin());

if (!process.env.VPS_AUTH_PROFILE_PATH) {
  throw new Error("AUTH_VPS_PATH is not set");
}

const USER_DATA_DIR = path.resolve(process.env.VPS_AUTH_PROFILE_PATH);

export async function launchContext(provider: Provider) {
  const providerDir = path.join(USER_DATA_DIR, provider);
    
  if (!fs.existsSync(providerDir)) {
    throw new AuthError(`${provider} not authenticated`);
  }

  logger.debug(`Loading authentication for ${provider} from: ${providerDir}`);
    
  const browser = await playwrightChromium.launch({ headless: true, args: [
    "--disable-blink-features=AutomationControlled",
    "--no-sandbox",
    "--disable-setuid-sandbox",
  ]});

  // Only use proxy if USE_PROXY env var is set to true
  const contextOptions: any = {
    storageState: path.join(providerDir, `${provider}-auth.json`),
    viewport: { width: 1920, height: 1080 }
  };

  contextOptions.proxy = {
    server: process.env.PROXY_SERVER || 'socks5://127.0.0.1:1080'
  };
  logger.debug(`Using proxy: ${contextOptions.proxy.server}`);

  const context = await browser.newContext(contextOptions);
  
  return { browser, context };
}