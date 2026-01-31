import dotenv from "dotenv";
import { chromium } from "playwright-extra";
import path from "path";
import fs from "fs";
import { waitForUserLogin } from "../lib/auth/waitForUserLogin.js";
import { logger } from "../lib/utils/logger.js";
import { Provider } from "@onescope/types";
import { PROVIDERS } from "@onescope/utils";

if (fs.existsSync("apps/agent/.env")) {
  dotenv.config({ path: "apps/agent/.env" });
} else if (fs.existsSync(".env")) {
  dotenv.config();
}

if (!process.env.LOCAL_AUTH_PROFILE_PATH) {
  throw new Error("LOCAL_AUTH_PROFILE_PATH is not set");
}

const USER_DATA_DIR = path.resolve(process.env.LOCAL_AUTH_PROFILE_PATH);

export async function loginToProvider(provider: Provider): Promise<void> {
  const config = PROVIDERS[provider];
  const providerDir = path.join(USER_DATA_DIR, provider);
  const authFile = path.join(providerDir, `${provider}-auth.json`);

  if (!fs.existsSync(providerDir)) {
    fs.mkdirSync(providerDir, { recursive: true });
  }

  logger.log(`\n🚀 Starting ${provider} login...`);

  const browser = await chromium.launch({ headless: false, args: [
    "--disable-blink-features=AutomationControlled",
    "--no-sandbox",
    "--disable-setuid-sandbox",
  ]});

  const contextOptions: Parameters<typeof browser.newContext>[0] = {
    viewport: null,
  };
  
  if (fs.existsSync(authFile)) {
    contextOptions.storageState = authFile;
    contextOptions.proxy = {
      server: process.env.PROXY_SERVER as string
    }
  }
  
  const loginContext = await browser.newContext(contextOptions);

  try {
    const loginPage = await loginContext.newPage();

    const ipInfo = await loginPage.evaluate(async () => {
        const res = await fetch("https://api.ipify.org?format=json", {
            cache: "no-store",
        });
        return res.json();
    });
    
    logger.log("🌐 Runtime IP:", ipInfo);

    await loginPage.goto(config.url, {
      waitUntil: "domcontentloaded",
    });

    await waitForUserLogin(loginPage, provider);

    await loginContext.storageState({
      path: authFile,
    });

    logger.success(`${config.name} auth saved to: ${providerDir}`);
  } catch (err) {
    logger.error(`Failed to login to ${config.name}:`, err);
    throw err;
  } finally {
    await loginContext.close();
    await browser.close()
  }
}

export async function loginToAll(): Promise<void> {
  logger.log("🔐 Starting login process for all providers...\n");

  for (const provider of Object.keys(PROVIDERS) as Provider[]) {
    try {
      await loginToProvider(provider);
      logger.log(`\n${"=".repeat(50)}\n`);
    } catch (err) {
      logger.error(`Failed to complete ${provider} login. Continuing...\n`);
    }
  }

  logger.success("All logins complete!");
}

export function checkAuthStatus(): void {
  logger.log("\n📊 Authentication Status:\n");

  for (const [key, config] of Object.entries(PROVIDERS)) {
    const authPath = path.join(USER_DATA_DIR, config.name);
    const exists = fs.existsSync(authPath);
    const status = exists ? "Auth session already exists in storage." : "❌ Not authenticated";
    logger.log(`${config.name}: ${status}`);
    
    logger.log(`Revalidating session...`);
    if (exists) {
      const stats = fs.statSync(authPath);
      logger.log(`Last updated: ${stats.mtime.toLocaleString()}`);
    }
  }
  logger.log();
}

async function runHeadedLogin(): Promise<void> {
  checkAuthStatus();

  await loginToAll();
}

if (process.env.RUN_INTERACTIVE_LOGIN === "true") {
  runHeadedLogin().catch(err => {
    logger.error("Login flow failed", err);
    process.exit(1);
  });
}