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
  const authFile = path.join(providerDir, `${provider}-auth.json`);
    
  if (!fs.existsSync(providerDir)) {
    throw new AuthError(`${provider} not authenticated`);
  }

  if (!fs.existsSync(authFile)) {
    throw new AuthError(`${provider} auth session not found.`);
  }

  logger.debug(`Loading authentication for ${provider} from: ${providerDir}`);

  const browser = await playwrightChromium.launch({
    headless: true,
    proxy: process.env.PROXY_SERVER
      ? {
          server: process.env.PROXY_SERVER as string,
          username: process.env.PROXY_USERNAME,
          password: process.env.PROXY_PASSWORD,
        }
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

  return { browser, context };
}